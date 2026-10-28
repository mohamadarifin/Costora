"""Session auth (httpOnly JWT cookie) + RBAC. Role is always re-read from the users collection."""

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request

from lib.db import db

COOKIE = "hpp_session"
ALGO = "HS256"

_READ = {"material:read", "labor:read", "hpp:read", "packaging:read", "report:read"}
PERMS: dict[str, set[str]] = {
    "admin": _READ | {"material:write", "labor:write", "hpp:write", "packaging:write", "import", "attachment:write", "user:manage", "signature:manage"},
    "rnd": _READ | {"material:write", "labor:write", "hpp:write", "packaging:write", "import", "attachment:write", "signature:manage"},
    "marketing": _READ | {"packaging:write", "import", "attachment:write"},
}


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    calc = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()
    return hmac.compare_digest(calc, digest)


def make_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=12)
    return jwt.encode({"sub": user_id, "exp": exp}, _secret(), algorithm=ALGO)


async def current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Belum login")
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sesi tidak valid")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="Akun tidak aktif")
    return user


def require(perm: str):
    async def dep(user: dict = Depends(current_user)) -> dict:
        if perm not in PERMS.get(user.get("role", ""), set()):
            raise HTTPException(status_code=403, detail="Akses ditolak untuk peran Anda")
        return user

    return dep


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
