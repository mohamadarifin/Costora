from fastapi import APIRouter, Depends, HTTPException

from lib.auth import hash_password, now_iso, require
from lib.db import db
from models.schemas import UserCreate, UserOut, UserUpdate, new_id

router = APIRouter(prefix="/users", tags=["users"])
PROJ = {"_id": 0, "password_hash": 0}


@router.get("", response_model=list[UserOut])
async def list_users(_: dict = Depends(require("user:manage"))):
    return await db.users.find({}, PROJ).sort("created_at", 1).to_list(500)


@router.post("", response_model=UserOut)
async def create_user(body: UserCreate, _: dict = Depends(require("user:manage"))):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email sudah terdaftar")
    doc = {"id": new_id(), "email": email, "name": body.name, "role": body.role, "active": True,
           "password_hash": hash_password(body.password), "created_at": now_iso()}
    await db.users.insert_one(doc)
    return UserOut(**doc)


@router.put("/{id}", response_model=UserOut)
async def update_user(id: str, body: UserUpdate, me: dict = Depends(require("user:manage"))):
    if id == me["id"] and (body.role != "admin" or not body.active):
        raise HTTPException(status_code=400, detail="Tidak dapat menurunkan/menonaktifkan akun sendiri")
    upd = {"name": body.name, "role": body.role, "active": body.active}
    if body.password:
        if len(body.password) < 6:
            raise HTTPException(status_code=422, detail="Password minimal 6 karakter")
        upd["password_hash"] = hash_password(body.password)
    res = await db.users.update_one({"id": id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    return await db.users.find_one({"id": id}, PROJ)


@router.delete("/{id}")
async def delete_user(id: str, me: dict = Depends(require("user:manage"))):
    if id == me["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    res = await db.users.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    return {"ok": True}
