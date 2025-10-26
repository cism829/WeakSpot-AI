from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.chat import File as FileModel
from fastapi.responses import StreamingResponse
import io

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/upload/{room_id}/{user_id}")
async def upload_file(room_id: int, user_id: str, upload: UploadFile = File(...), db: Session = Depends(get_db)):
    file_data = await upload.read()
    cid = int(user_id)

    new_file = FileModel(
        filename = upload.filename,
        content_type = upload.content_type,
        data = file_data,
        user_id = cid,
        room_id = room_id,
    )

    db.add(new_file)
    db.commit()
    db.refresh(new_file)

    return {"file_id": new_file.file_id, "filename": new_file.filename}

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