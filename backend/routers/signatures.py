"""Signature templates: upload once (name, position, image), then pick as approver on HPP / Packaging."""

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from lib.auth import current_user, now_iso, require
from lib.db import db
from models.schemas import Signature, new_id
from routers.attachments import upload_dir

router = APIRouter(prefix="/signatures", tags=["signatures"])
IMG_EXT = {".png", ".jpg", ".jpeg", ".webp"}

HPP_SLOTS = [("dibuat", "Dibuat"), ("diperiksa", "Diperiksa"), ("diketahui", "Diketahui")]
PACKAGING_SLOTS = [("marketing", "Marketing"), ("dibuat_rnd", "Dibuat R&D"), ("mengetahui_rnd", "Mengetahui R&D")]


def approval_status(approvals: dict, slots: list[tuple[str, str]]) -> str:
    filled = sum(1 for k, _ in slots if approvals.get(k))
    return "approved" if filled == len(slots) else ("partial" if filled else "draft")


async def resolve_signatures(approvals: dict, slots: list[tuple[str, str]]) -> list[dict]:
    """[{label, name, position, path|None}] for the PDF signature block."""
    ids = [v for v in approvals.values() if v]
    docs = {d["id"]: d for d in await db.signatures.find({"id": {"$in": ids}}, {"_id": 0}).to_list(50)}
    out = []
    for key, label in slots:
        d = docs.get(approvals.get(key) or "")
        path = upload_dir() / d["stored_name"] if d else None
        out.append({"key": key, "label": label, "name": d["name"] if d else "", "position": d.get("position", "") if d else "",
                    "path": str(path) if path and path.exists() else None})
    return out


async def validate_approvals(approvals: dict, slots: list[tuple[str, str]]) -> dict:
    allowed = {k for k, _ in slots}
    clean = {k: v for k, v in approvals.items() if k in allowed and v}
    if clean and await db.signatures.count_documents({"id": {"$in": list(clean.values())}}) != len(set(clean.values())):
        raise HTTPException(status_code=422, detail="Tanda tangan approval tidak ditemukan")
    return clean


@router.get("", response_model=list[Signature])
async def list_signatures(_: dict = Depends(current_user)):
    return await db.signatures.find({}, {"_id": 0}).sort("name", 1).to_list(500)


@router.post("", response_model=Signature)
async def create_signature(name: str = Form(...), position: str = Form(default=""), file: UploadFile = File(...),
                           user: dict = Depends(require("signature:manage"))):
    if not name.strip():
        raise HTTPException(status_code=422, detail="Nama wajib diisi")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in IMG_EXT:
        raise HTTPException(status_code=422, detail="Tanda tangan harus berupa gambar PNG/JPG/WEBP")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Gambar melebihi 5 MB")
    sid = new_id()
    stored = f"sig_{sid}{ext}"
    (upload_dir() / stored).write_bytes(data)
    sig = Signature(id=sid, name=name.strip(), position=position.strip(), stored_name=stored, content_type=file.content_type or "",
                    created_by=user["name"], created_at=now_iso())
    await db.signatures.insert_one(sig.model_dump())
    return sig


@router.get("/{id}/image")
async def signature_image(id: str, _: dict = Depends(current_user)):
    d = await db.signatures.find_one({"id": id}, {"_id": 0})
    path = upload_dir() / d["stored_name"] if d else None
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Tanda tangan tidak ditemukan")
    return FileResponse(path, media_type=d.get("content_type") or None)


@router.delete("/{id}")
async def delete_signature(id: str, _: dict = Depends(require("signature:manage"))):
    d = await db.signatures.find_one({"id": id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Tanda tangan tidak ditemukan")
    (upload_dir() / d["stored_name"]).unlink(missing_ok=True)
    await db.signatures.delete_one({"id": id})
    for coll in (db.hpp, db.packaging):  # unlink from any approvals that referenced it
        async for doc in coll.find({"approvals": {"$exists": True}}, {"_id": 0, "id": 1, "approvals": 1}):
            if id in (doc.get("approvals") or {}).values():
                appr = {k: (None if v == id else v) for k, v in doc["approvals"].items()}
                slots = HPP_SLOTS if coll is db.hpp else PACKAGING_SLOTS
                await coll.update_one({"id": doc["id"]}, {"$set": {"approvals": appr, "approval_status": approval_status(appr, slots)}})
    return {"ok": True}
