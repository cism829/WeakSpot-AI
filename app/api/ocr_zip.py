import io, zipfile, secrets, uuid
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from openai import OpenAI
from app.services.chunking import chunk_and_store
from app.core.db import get_db
from app.core.config import settings
from app.core.security import get_current_user
from app.services.ocr import preprocess, ocr_bytes
from app.models.note import Note  
from app.services.ocr_repair import has_ocr_gap, suggest_repair_for_text
from app.models.note_repair import NoteRepair

router = APIRouter(prefix="/ocr", tags=["ocr"])

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}

def _is_image(path: Path) -> bool:
    return path.suffix.lower() in IMAGE_EXTS

def _safe_extract_zip(zf: zipfile.ZipFile, dest: Path) -> list[Path]:
    extracted: list[Path] = []
    root = dest.resolve()
    for member in zf.infolist():
        if member.is_dir():
            continue
        member_path = Path(member.filename)
        if member_path.is_absolute():
            continue
        if any(part in ("__MACOSX",) for part in member_path.parts):
            continue
        final_path = (root / member_path).resolve()
        if not str(final_path).startswith(str(root)):
            continue
        final_path.parent.mkdir(parents=True, exist_ok=True)
        with zf.open(member) as src, open(final_path, "wb") as dst:
            dst.write(src.read())
        extracted.append(final_path)
    return extracted

def _cleanup_tree(root: Path) -> None:
    try:
        for p in sorted(root.rglob("*"), reverse=True):
            p.unlink() if p.is_file() else p.rmdir()
        root.rmdir()
    except Exception:
        pass

@router.post("/zip")
async def ocr_from_zip(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    # 1) validate zip
    fname = (file.filename or "upload.zip").lower()
    if not fname.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip file.")
    data = await file.read()
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid or corrupted zip file.")

    # 2) extract safely
    tmp_root = Path("tmp") / f"zip_{secrets.token_hex(8)}"
    tmp_root.mkdir(parents=True, exist_ok=True)
    extracted = _safe_extract_zip(zf, tmp_root)
    if not extracted:
        _cleanup_tree(tmp_root)
        raise HTTPException(status_code=400, detail="Zip contained no files.")

    # 3) image files only
    img_paths = [p for p in extracted if _is_image(p)]
    if not img_paths:
        _cleanup_tree(tmp_root)
        raise HTTPException(status_code=400, detail="Zip has no supported image files.")

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    created, failures = [], []


    for path in sorted(img_paths):
        try:
            jpeg_bytes = preprocess(path)
            text = ocr_bytes(client, jpeg_bytes)

            note = Note(
                user_id=getattr(user, "user_id"),
                og_text=text,
                status="ocr_done",
            )
            db.add(note)
            db.flush()          # get note.note_id
            db.refresh(note)

            #ocr repair
            repair_id_to_return = None
            
            if has_ocr_gap(note.og_text or ""):
                result = suggest_repair_for_text(
                    note.og_text,
                    subject=getattr(settings, "SUBJECT", None)
                )

                rep = NoteRepair(
                    note_id=note.note_id,
                    original_text=note.og_text,
                    suggested_text=result.get("suggested_text"),
                    suggestion_log=result.get("log", []),
                    status='pending',
                )

                db.add(rep)
                db.flush()
                db.refresh(rep)
                repair_id_to_return = str(rep.repair_id)

            created.append({
                "note_id": str(note.note_id),
                "repair_id": repair_id_to_return
            })


            # embeddings and chunks
            chunk_and_store(db, note, client, embed_model="text-embedding-3-small", max_chars=800, overlap=80)


            created.append({"note_id": str(note.note_id)})
        except Exception as e:
            print("OCR/insert failure for", path.name, "->", e)
            failures.append({"file": path.name, "error": str(e)})

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise
    finally:
        _cleanup_tree(tmp_root)

    return {
        "processed": len(img_paths),
        "created_notes": len(created),
        "created": created,
        "failures": failures,
    }
