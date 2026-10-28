import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from lib.auth import now_iso, require
from lib.db import db
from lib.pdf import packaging_pdf
from models.schemas import Packaging, PackagingIn, new_id
from lib.approvals import sync_approvals
from routers.signatures import PACKAGING_SLOTS, approval_status, resolve_signatures, validate_approvals

router = APIRouter(prefix="/packaging", tags=["packaging"])


def build_packaging(body: PackagingIn, user_name: str, source: str = "manual", existing: dict | None = None,
                    signed: dict | None = None) -> Packaging:
    now = now_iso()
    ex = existing or {}
    return Packaging(**body.model_dump(), id=ex.get("id", new_id()), month=body.date[:7], source=ex.get("source", source),
                     approval_status=approval_status(body.approvals, PACKAGING_SLOTS, signed), approval_signed=signed or {},
                     created_by=ex.get("created_by", user_name), created_at=ex.get("created_at", now), updated_at=now)


async def _check_hpp(hpp_id: str | None):
    if hpp_id and not await db.hpp.find_one({"id": hpp_id}, {"_id": 1}):
        raise HTTPException(status_code=422, detail="HPP terkait tidak ditemukan")


@router.get("", response_model=list[Packaging])
async def list_packaging(q: str = "", buyer: str = "", month: str = "", hpp_id: str = "", _: dict = Depends(require("packaging:read"))):
    flt: dict = {}
    if buyer:
        flt["buyer"] = buyer
    if month:
        flt["month"] = month
    if hpp_id:
        flt["hpp_id"] = hpp_id
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        flt["$or"] = [{"buyer": rx}, {"item_name": rx}, {"po_no": rx}, {"color": rx}]
    return await db.packaging.find(flt, {"_id": 0}).sort([("date", -1), ("updated_at", -1)]).to_list(2000)


@router.get("/{id}", response_model=Packaging)
async def get_packaging(id: str, _: dict = Depends(require("packaging:read"))):
    doc = await db.packaging.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Packaging form tidak ditemukan")
    return doc


@router.post("", response_model=Packaging)
async def create_packaging(body: PackagingIn, user: dict = Depends(require("packaging:write"))):
    await _check_hpp(body.hpp_id)
    body.approvals = await validate_approvals(body.approvals, PACKAGING_SLOTS)
    p = build_packaging(body, user["name"])
    await db.packaging.insert_one(p.model_dump())
    await sync_approvals("packaging", p.id, f"{p.item_name or 'Packaging'} · {p.buyer}", PACKAGING_SLOTS, p.approvals, {}, {}, user)
    return p


@router.post("/from-hpp/{hpp_id}", response_model=Packaging)
async def create_from_hpp(hpp_id: str, user: dict = Depends(require("packaging:write"))):
    h = await db.hpp.find_one({"id": hpp_id}, {"_id": 0, "lines": 0})
    if not h:
        raise HTTPException(status_code=404, detail="HPP tidak ditemukan")
    dims = f"Dimensi: W {h['tw'] * 1000:.0f} mm x D {h['td'] * 1000:.0f} mm x H {h['th'] * 1000:.0f} mm"
    body = PackagingIn(hpp_id=hpp_id, buyer=h["buyer"], item_name=h["code_item"], color=h.get("colour", ""), date=h["date"], notes=dims)
    p = build_packaging(body, user["name"])
    await db.packaging.insert_one(p.model_dump())
    return p


@router.put("/{id}", response_model=Packaging)
async def update_packaging(id: str, body: PackagingIn, user: dict = Depends(require("packaging:write"))):
    existing = await db.packaging.find_one({"id": id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Packaging form tidak ditemukan")
    await _check_hpp(body.hpp_id)
    body.approvals = await validate_approvals(body.approvals, PACKAGING_SLOTS)
    signed = await sync_approvals("packaging", id, f"{body.item_name or 'Packaging'} · {body.buyer}", PACKAGING_SLOTS, body.approvals,
                                  {} if existing.get("approval_rejection") else (existing.get("approvals") or {}),
                                  {} if existing.get("approval_rejection") else (existing.get("approval_signed") or {}), user)
    p = build_packaging(body, user["name"], existing=existing, signed=signed)
    await db.packaging.replace_one({"id": id}, p.model_dump())
    return p


@router.delete("/{id}")
async def delete_packaging(id: str, _: dict = Depends(require("packaging:write"))):
    res = await db.packaging.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Packaging form tidak ditemukan")
    await db.attachments.delete_many({"owner_type": "packaging", "owner_id": id})
    return {"ok": True}


@router.get("/{id}/pdf")
async def packaging_pdf_route(id: str, _: dict = Depends(require("packaging:read"))):
    doc = await db.packaging.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Packaging form tidak ditemukan")
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", f"{doc['buyer']}_{doc.get('item_name', '')}")[:60]
    sigs = await resolve_signatures(doc.get("approvals") or {}, PACKAGING_SLOTS, doc.get("approval_signed") or {})
    return Response(packaging_pdf(doc, sigs), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="Packaging_{safe}.pdf"'})
