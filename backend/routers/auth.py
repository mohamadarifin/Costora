from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import COOKIE, current_user, make_token, verify_password
from lib.db import db
from models.schemas import LoginIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
async def login(body: LoginIn, response: Response):
    user = await db.users.find_one({"email": body.email.strip().lower()}, {"_id": 0})
    if not user or not user.get("active", True) or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    response.set_cookie(COOKIE, make_token(user["id"]), httponly=True, samesite="lax", max_age=12 * 3600, path="/")
    return UserOut(**user)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(current_user)):
    return UserOut(**user)
