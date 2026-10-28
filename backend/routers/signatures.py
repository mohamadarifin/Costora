"""Signature templates: upload once (name, position, image), then pick as approver on HPP / Packaging."""

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from lib.auth import current_user, now_iso, require
from lib.db import db
from models.schemas import Signature, SignatureUpdate, UserBrief, new_id
from routers.attachments import upload_dir

router = APIRouter(prefix="/signatures", tags=["signatures"])
IMG_EXT = {".png", ".jpg", ".jpeg", ".webp"}

HPP_SLOTS = [("dibuat", "Dibuat"), ("diperiksa", "Diperiksa"), ("diketahui", "Diketahui")]
PACKAGING_SLOTS = [("marketing", "Marketing"), ("dibuat_rnd", "Dibuat R&D"), ("mengetahui_rnd", "Mengetahui R&D")]


def approval_status(approvals: dict, slots: list[tuple[str, str]], signed: dict | None = None) -> str:
    """draft = no signer chosen; partial = waiting for signatures; approved = all slots assigned AND signed."""
    signed = signed or {}
    if not any(approvals.get(k) for k, _ in slots):
        return "draft"
    return "approved" if all(approvals.get(k) and signed.get(k) for k, _ in slots) else "partial"


async def resolve_signatures(approvals: dict, slots: list[tuple[str, str]], signed: dict | None = None) -> list[dict]:
    """[{label, name, position, path|None}] for the PDF signature block."""
    ids = [v for v in approvals.values() if v]
    docs = {d["id"]: d for d in await db.signatures.find({"id": {"$in": ids}}, {"_id": 0}).to_list(50)}
    out = []
    for key, label in slots:
        d = docs.get(approvals.get(key) or "")
        is_signed = bool(d and (signed or {}).get(key))
        path = upload_dir() / d["stored_name"] if is_signed else None
        pos = (d.get("position", "") if d else "") + ("" if is_signed or not d else " (menunggu tanda tangan)")
        out.append({"key": key, "label": label, "name": d["name"] if d else "", "position": pos.strip(),
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


async def _check_user(user_id: str | None):
    if user_id and not await db.users.find_one({"id": user_id}, {"_id": 1}):
        raise HTTPException(status_code=422, detail="Akun pengguna tidak ditemukan")


@router.get("/users", response_model=list[UserBrief])
async def signer_users(_: dict = Depends(require("signature:manage"))):
    return await db.users.find({"active": True}, {"_id": 0, "id": 1, "name": 1, "email": 1}).sort("name", 1).to_list(500)


@router.put("/{id}", response_model=Signature)
async def update_signature(id: str, body: SignatureUpdate, _: dict = Depends(require("signature:manage"))):
    await _check_user(body.user_id)
    res = await db.signatures.update_one({"id": id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tanda tangan tidak ditemukan")
    return await db.signatures.find_one({"id": id}, {"_id": 0})


@router.post("", response_model=Signature)
async def create_signature(name: str = Form(...), position: str = Form(default=""), user_id: str = Form(default=""),
                           file: UploadFile = File(...), user: dict = Depends(require("signature:manage"))):
    await _check_user(user_id or None)
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
    sig = Signature(id=sid, name=name.strip(), position=position.strip(), user_id=user_id or None, stored_name=stored, content_type=file.content_type or "",
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
        async for doc in coll.find({"approvals": {"$exists": True}}, {"_id": 0, "id": 1, "approvals": 1, "approval_signed": 1}):
            if id in (doc.get("approvals") or {}).values():
                appr = {k: (None if v == id else v) for k, v in doc["approvals"].items()}
                signed = {k: v for k, v in (doc.get("approval_signed") or {}).items() if appr.get(k)}
                slots = HPP_SLOTS if coll is db.hpp else PACKAGING_SLOTS
                await coll.update_one({"id": doc["id"]}, {"$set": {"approvals": appr, "approval_signed": signed,
                                                                   "approval_status": approval_status(appr, slots, signed)}})
    return {"ok": True}
