from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require
from lib.db import db
from models.schemas import AddYearIn, LaborGroup, LaborGroupIn

router = APIRouter(prefix="/labor", tags=["labor"])


@router.get("", response_model=list[LaborGroup])
async def list_groups(_: dict = Depends(require("labor:read"))):
    return await db.labor_groups.find({}, {"_id": 0}).sort("order", 1).to_list(500)


@router.post("", response_model=LaborGroup)
async def create_group(body: LaborGroupIn, _: dict = Depends(require("labor:write"))):
    last = await db.labor_groups.find_one({}, {"order": 1, "no": 1}, sort=[("order", -1)])
    g = LaborGroup(**body.model_dump(), order=(last or {}).get("order", 0) + 1, no=(last or {}).get("no", 0) + 1)
    await db.labor_groups.insert_one(g.model_dump())
    return g


@router.put("/{id}", response_model=LaborGroup)
async def update_group(id: str, body: LaborGroupIn, _: dict = Depends(require("labor:write"))):
    res = await db.labor_groups.update_one({"id": id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Kelompok upah tidak ditemukan")
    return await db.labor_groups.find_one({"id": id}, {"_id": 0})


@router.delete("/{id}")
async def delete_group(id: str, _: dict = Depends(require("labor:write"))):
    res = await db.labor_groups.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kelompok upah tidak ditemukan")
    return {"ok": True}


@router.post("/years", response_model=list[LaborGroup])
async def add_year(body: AddYearIn, _: dict = Depends(require("labor:write"))):
    """Add a year column: % kenaikan copied from previous year, rate = prev * (1 + %)."""
    y, prev = str(body.year), str(body.year - 1)
    groups = await db.labor_groups.find({}, {"_id": 0}).to_list(500)
    for g in groups:
        inc = g["increases"].get(y, g["increases"].get(prev, 0.0))
        g["increases"][y] = inc
        for it in g["items"]:
            if it["rates"].get(y) is None:
                p = it["rates"].get(prev)
                it["rates"][y] = round(p * (1 + inc), 2) if p is not None else None
        await db.labor_groups.update_one({"id": g["id"]}, {"$set": {"increases": g["increases"], "items": g["items"]}})
    return sorted(groups, key=lambda g: g["order"])
