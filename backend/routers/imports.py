from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from lib.auth import require
from lib.db import db
from lib.excel_import import parse_workbook
from lib.dates import today_iso
from models.schemas import HppIn, HppLine, ImportResult, PackagingIn
from routers.attachments import save_upload
from routers.hpp import build_hpp
from routers.packaging import build_packaging

router = APIRouter(prefix="/import", tags=["import"])


async def material_index() -> dict[str, dict]:
    idx: dict[str, dict] = {}
    async for m in db.materials.find({}, {"_id": 0, "id": 1, "item": 1, "price": 1}).sort("order", 1):
        idx.setdefault(m["item"].strip().lower(), m)
    return idx


async def import_parsed(parsed: dict, user_name: str, buyer_override: str = "", labor_year: int | None = None) -> tuple[dict, dict]:
    h = parsed["header"]
    idx = await material_index()
    lines = []
    for ln in parsed["lines"]:
        m = idx.get(ln["item"].strip().lower())
        lines.append(HppLine(**ln, material_id=m["id"] if m else None))
    date = h.get("date") or today_iso()
    buyer = buyer_override.strip() or h.get("buyer") or "Tanpa Buyer"
    body = HppIn(code_item=h.get("code_item") or "Item Import", colour=h.get("colour", ""), buyer=buyer, type=h.get("type", ""),
                 date=date, tw=h.get("tw", 0), td=h.get("td", 0), th=h.get("th", 0),
                 labor_year=labor_year or int(date[:4]), lines=lines, notes=f"Import dari sheet '{parsed.get('sheet', '')}'")
    hpp = build_hpp(body, user_name, source="import")
    await db.hpp.insert_one(hpp.model_dump())

    pk = parsed.get("packaging") or {}
    dims = f"Dimensi: W {hpp.tw * 1000:.0f} mm x D {hpp.td * 1000:.0f} mm x H {hpp.th * 1000:.0f} mm"
    pdate = pk.get("date") if isinstance(pk.get("date"), str) and len(pk.get("date", "")) == 10 else date
    pbody = PackagingIn(
        hpp_id=hpp.id, buyer=buyer_override.strip() or pk.get("buyer") or buyer, item_name=pk.get("item_name") or hpp.code_item,
        color=pk.get("color") or hpp.colour, po_no=pk.get("po_no", ""), date=pdate, etd=str(pk.get("etd", "")),
        produksi_sample=pk.get("produksi_sample", ""), ros_rop=pk.get("ros_rop", ""), keterangan=pk.get("keterangan", ""),
        checks=pk.get("checks", []), details=pk.get("details", {}), marking=bool(pk.get("marking", False)),
        label=bool(pk.get("label", False)), notes=pk.get("notes") or dims)
    pack = build_packaging(pbody, user_name, source="import")
    await db.packaging.insert_one(pack.model_dump())
    return hpp.model_dump(), pack.model_dump()


@router.get("/template")
async def template(_: dict = Depends(require("import"))):
    path = Path(__file__).parent.parent / "seed_data" / "HPP_AGUSTUS_2026.xlsx"
    return FileResponse(path, filename="Contoh_Format_HPP_Buyer.xlsx",
                        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@router.post("/buyer", response_model=ImportResult)
async def import_buyer(file: UploadFile = File(...), attachments: list[UploadFile] = File(default=[]),
                       buyer: str = Form(default=""), labor_year: int | None = Form(default=None),
                       user: dict = Depends(require("import"))):
    if not (file.filename or "").lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=422, detail="File HPP harus berformat .xlsx")
    try:
        parsed = parse_workbook(await file.read())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    hpp, pack = await import_parsed(parsed, user["name"], buyer, labor_year)
    count = 0
    for f in attachments:
        if f.filename:
            await save_upload(f, "hpp", hpp["id"], user["name"])
            count += 1
    warnings = list(parsed["warnings"])
    if parsed.get("packaging") is None:
        warnings.append("Sheet PACKAGING tidak ditemukan — Packaging Form dibuat dari data header HPP, silakan lengkapi.")
    return ImportResult(hpp_id=hpp["id"], packaging_id=pack["id"], lines_imported=len(hpp["lines"]), attachments=count, warnings=warnings)
