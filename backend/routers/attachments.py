import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from lib.auth import current_user, now_iso, require
from lib.db import db
from models.schemas import Attachment, new_id

router = APIRouter(prefix="/attachments", tags=["attachments"])
MAX_BYTES = 15 * 1024 * 1024
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".pdf", ".xlsx", ".xls"}


def upload_dir() -> Path:
    p = Path(os.environ.get("UPLOAD_DIR", "/app/backend/uploads"))
    p.mkdir(parents=True, exist_ok=True)
    return p


async def owner_exists(owner_type: str, owner_id: str) -> bool:
    coll = db.hpp if owner_type == "hpp" else db.packaging
    return bool(await coll.find_one({"id": owner_id}, {"_id": 1}))


async def save_upload(f: UploadFile, owner_type: str, owner_id: str, user_name: str) -> Attachment:
    name = Path(f.filename or "file").name
    ext = Path(name).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=422, detail=f"Tipe file {ext or '?'} tidak didukung (gambar, PDF, Excel)")
    data = await f.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"{name} melebihi 15 MB")
    att_id = new_id()
    stored = f"{att_id}{ext}"
    (upload_dir() / stored).write_bytes(data)
    att = Attachment(id=att_id, owner_type=owner_type, owner_id=owner_id, filename=name, content_type=f.content_type or "",
                     size=len(data), stored_name=stored, uploaded_by=user_name, created_at=now_iso())
    await db.attachments.insert_one(att.model_dump())
    return att


@router.get("", response_model=list[Attachment])
async def list_attachments(owner_type: str, owner_id: str, _: dict = Depends(current_user)):
    return await db.attachments.find({"owner_type": owner_type, "owner_id": owner_id}, {"_id": 0}).sort("created_at", 1).to_list(200)


@router.post("", response_model=list[Attachment])
async def upload(owner_type: str = Form(...), owner_id: str = Form(...), files: list[UploadFile] = File(...),
                 user: dict = Depends(require("attachment:write"))):
    if owner_type not in ("hpp", "packaging") or not await owner_exists(owner_type, owner_id):
        raise HTTPException(status_code=404, detail="Data tujuan lampiran tidak ditemukan")
    return [await save_upload(f, owner_type, owner_id, user["name"]) for f in files]


@router.get("/{id}/file")
async def download(id: str, _: dict = Depends(current_user)):
    att = await db.attachments.find_one({"id": id}, {"_id": 0})
    if not att:
        raise HTTPException(status_code=404, detail="Lampiran tidak ditemukan")
    path = upload_dir() / att["stored_name"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="File lampiran hilang")
    return FileResponse(path, media_type=att.get("content_type") or None, filename=att["filename"], content_disposition_type="inline")


@router.delete("/{id}")
async def delete_attachment(id: str, _: dict = Depends(require("attachment:write"))):
    att = await db.attachments.find_one({"id": id}, {"_id": 0})
    if not att:
        raise HTTPException(status_code=404, detail="Lampiran tidak ditemukan")
    (upload_dir() / att["stored_name"]).unlink(missing_ok=True)
    await db.attachments.delete_one({"id": id})
    return {"ok": True}
