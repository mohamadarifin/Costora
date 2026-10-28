import re

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require
from lib.db import db
from models.schemas import CategoryCount, Material, MaterialIn, MaterialPage

router = APIRouter(prefix="/materials", tags=["materials"])


@router.get("", response_model=MaterialPage)
async def list_materials(q: str = "", category: str = "", skip: int = 0, limit: int = 50,
                         _: dict = Depends(require("material:read"))):
    flt: dict = {}
    if category:
        flt["category"] = category
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        flt["$or"] = [{"item": rx}, {"size": rx}, {"category": rx}, {"note": rx}]
    total = await db.materials.count_documents(flt)
    items = await db.materials.find(flt, {"_id": 0}).sort("order", 1).skip(max(skip, 0)).limit(min(max(limit, 1), 500)).to_list(500)
    return MaterialPage(items=items, total=total)


@router.get("/categories", response_model=list[CategoryCount])
async def categories(_: dict = Depends(require("material:read"))):
    rows = await db.materials.aggregate([
        {"$group": {"_id": "$category", "count": {"$sum": 1}, "o": {"$min": "$order"}}},
        {"$sort": {"o": 1}},
    ]).to_list(500)
    return [CategoryCount(category=r["_id"], count=r["count"]) for r in rows]


@router.post("", response_model=Material)
async def create_material(body: MaterialIn, _: dict = Depends(require("material:write"))):
    last = await db.materials.find_one({}, {"order": 1}, sort=[("order", -1)])
    mat = Material(**body.model_dump(), order=(last or {}).get("order", 0) + 1)
    await db.materials.insert_one(mat.model_dump())
    return mat


@router.put("/{id}", response_model=Material)
async def update_material(id: str, body: MaterialIn, _: dict = Depends(require("material:write"))):
    res = await db.materials.update_one({"id": id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Material tidak ditemukan")
    return await db.materials.find_one({"id": id}, {"_id": 0})


@router.delete("/{id}")
async def delete_material(id: str, _: dict = Depends(require("material:write"))):
    res = await db.materials.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Material tidak ditemukan")
    return {"ok": True}
