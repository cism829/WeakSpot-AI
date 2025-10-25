from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.file import File as FileModel
from fastapi.responses import StreamingResponse
import io
from app.schemas.study_groups import FileUploadOut, FileUploadIn
from app.core.db import get_db
import base64
import os

router = APIRouter(prefix="/fileupload", tags=["fileupload"])


MAX_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", 10 * 1024 * 1024))  # default 10 MB

@router.post("/upload-json/{room_id}/{user_id}", response_model=FileUploadOut)
async def upload_file_json(room_id: int, user_id: int, payload: FileUploadIn, db: Session = Depends(get_db)):
    try:
        data = base64.b64decode(payload.data_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 data")

    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large.")

    rec = FileModel(
        filename=payload.filename,
        content_type=payload.content_type or "application/octet-stream",
        data=data,
        user_id=user_id,
        room_id=room_id,
    )
    db.add(rec); db.commit(); db.refresh(rec)
    return {"file_id": rec.file_id, "filename": rec.filename}

@router.get("/download/{file_id}")
def download_file(file_id: int, db: Session = Depends(get_db)):
    file = db.query(FileModel).filter(FileModel.file_id == file_id).first()
    if not file:
        return {"error": "File not found"}

    return StreamingResponse(
        io.BytesIO(file.data),
        media_type=file.content_type,
        headers={"Content-Disposition": f"attachment; filename={file.filename}"}
    )