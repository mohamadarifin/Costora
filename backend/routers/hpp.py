import os
import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from lib.auth import now_iso, require
from lib.db import db
from lib.hpp_calc import compute
from lib.pdf import hpp_pdf
from models.schemas import Hpp, HppIn, HppSummary, new_id
from lib.approvals import sync_approvals
from routers.signatures import HPP_SLOTS, approval_status, resolve_signatures, validate_approvals

router = APIRouter(prefix="/hpp", tags=["hpp"])
SUMMARY_PROJ = {"_id": 0, "lines": 0}


def build_hpp(body: HppIn, user_name: str, source: str = "manual", existing: dict | None = None, signed: dict | None = None) -> Hpp:
    lines, totals = compute(body.lines, body.markup)
    data = body.model_dump()
    data["lines"] = lines
    now = now_iso()
    return Hpp(**data, id=(existing or {}).get("id", new_id()), month=body.date[:7], totals=totals,
               approval_status=approval_status(body.approvals, HPP_SLOTS, signed), approval_signed=signed or {},
               source=(existing or {}).get("source", source), created_by=(existing or {}).get("created_by", user_name),
               created_at=(existing or {}).get("created_at", now), updated_at=now)


def hpp_filter(q: str = "", buyer: str = "", month: str = "", year: str = "") -> dict:
    flt: dict = {}
    if buyer:
        flt["buyer"] = buyer
    if month:
        flt["month"] = month
    elif year:
        flt["month"] = {"$regex": f"^{re.escape(year)}-"}
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        flt["$or"] = [{"code_item": rx}, {"buyer": rx}, {"colour": rx}, {"type": rx}]
    return flt


@router.get("", response_model=list[HppSummary])
async def list_hpp(q: str = "", buyer: str = "", month: str = "", year: str = "", _: dict = Depends(require("hpp:read"))):
    return await db.hpp.find(hpp_filter(q, buyer, month, year), SUMMARY_PROJ).sort([("date", -1), ("updated_at", -1)]).to_list(2000)


@router.get("/buyers", response_model=list[str])
async def buyers(_: dict = Depends(require("hpp:read"))):
    a = await db.hpp.distinct("buyer")
    b = await db.packaging.distinct("buyer")
    return sorted({x for x in a + b if x}, key=str.lower)


@router.get("/{id}", response_model=Hpp)
async def get_hpp(id: str, _: dict = Depends(require("hpp:read"))):
    doc = await db.hpp.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="HPP tidak ditemukan")
    return doc


@router.post("", response_model=Hpp)
async def create_hpp(body: HppIn, user: dict = Depends(require("hpp:write"))):
    body.approvals = await validate_approvals(body.approvals, HPP_SLOTS)
    h = build_hpp(body, user["name"])
    await db.hpp.insert_one(h.model_dump())
    await sync_approvals("hpp", h.id, f"{h.code_item} · {h.buyer}", HPP_SLOTS, h.approvals, {}, {}, user)
    return h


@router.put("/{id}", response_model=Hpp)
async def update_hpp(id: str, body: HppIn, user: dict = Depends(require("hpp:write"))):
    existing = await db.hpp.find_one({"id": id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="HPP tidak ditemukan")
    body.approvals = await validate_approvals(body.approvals, HPP_SLOTS)
    signed = await sync_approvals("hpp", id, f"{body.code_item} · {body.buyer}", HPP_SLOTS, body.approvals,
                                  {} if existing.get("approval_rejection") else (existing.get("approvals") or {}),
                                  {} if existing.get("approval_rejection") else (existing.get("approval_signed") or {}), user)
    h = build_hpp(body, user["name"], existing=existing, signed=signed)
    await db.hpp.replace_one({"id": id}, h.model_dump())
    return h


@router.post("/{id}/duplicate", response_model=Hpp)
async def duplicate_hpp(id: str, user: dict = Depends(require("hpp:write"))):
    existing = await db.hpp.find_one({"id": id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="HPP tidak ditemukan")
    body = HppIn(**{**existing, "code_item": f"{existing['code_item']} (copy)", "approvals": {},
                    "lines": [{**ln, "id": new_id()} for ln in existing["lines"]]})
    h = build_hpp(body, user["name"])
    await db.hpp.insert_one(h.model_dump())
    return h


@router.delete("/{id}")
async def delete_hpp(id: str, _: dict = Depends(require("hpp:write"))):
    res = await db.hpp.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="HPP tidak ditemukan")
    await db.packaging.update_many({"hpp_id": id}, {"$set": {"hpp_id": None}})
    upload_dir = Path(os.environ.get("UPLOAD_DIR", "/app/backend/uploads"))
    async for att in db.attachments.find({"owner_type": "hpp", "owner_id": id}, {"_id": 0}):
        (upload_dir / att["stored_name"]).unlink(missing_ok=True)
    await db.attachments.delete_many({"owner_type": "hpp", "owner_id": id})
    return {"ok": True}


@router.get("/{id}/pdf")
async def hpp_pdf_route(id: str, _: dict = Depends(require("hpp:read"))):
    doc = await db.hpp.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="HPP tidak ditemukan")
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", doc["code_item"])[:60]
    sigs = await resolve_signatures(doc.get("approvals") or {}, HPP_SLOTS, doc.get("approval_signed") or {})
    img = await db.attachments.find_one({"owner_type": "hpp", "owner_id": id, "content_type": {"$regex": "^image/(png|jpe?g)"}}, {"_id": 0})
    upload_dir = Path(os.environ.get("UPLOAD_DIR", "/app/backend/uploads"))
    img_path = str(upload_dir / img["stored_name"]) if img and (upload_dir / img["stored_name"]).exists() else None
    return Response(hpp_pdf(doc, sigs, img_path), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="HPP_{safe}.pdf"'})
