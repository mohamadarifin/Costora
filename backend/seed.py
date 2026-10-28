"""Idempotent seed: users, materials (DATA BASE HPP), labor (TENAGA KERJA % PER TAHUN), sample HPP + packaging.
Run: cd /app/backend && python seed.py  (add --reset to wipe & reload master data)"""

import asyncio
import sys
from pathlib import Path

import openpyxl

from lib.auth import hash_password, now_iso
from lib.db import db, ensure_indexes
from models.schemas import LaborGroup, LaborItem, Material, PackagingIn, new_id
from routers.imports import import_parsed
from routers.packaging import build_packaging
from lib.excel_import import num, parse_workbook

XLSX = Path(__file__).parent / "seed_data" / "HPP_AGUSTUS_2026.xlsx"

USERS = [
    ("admin@balagi.com", "Administrator", "admin", "admin123"),
    ("marketing@balagi.com", "Vivian (Marketing)", "marketing", "marketing123"),
    ("rnd@balagi.com", "Tim R&D", "rnd", "rnd123"),
    ("ucu@balagi.com", "Ucu Moch.R", "rnd", "ucu123"),
    ("haryanto@balagi.com", "Haryanto S", "rnd", "haryanto123"),
]
SIGNER_LINKS = {"Sholehudin M": "rnd@balagi.com", "Ucu Moch.R": "ucu@balagi.com", "Haryanto S": "haryanto@balagi.com"}

CATEGORY_NAMES = {"PRICE MATERIAL RAW": "Material Raw", "Sub Material ( Supplies )": "Supplies", "Foam & Pabric": "Foam & Fabric",
                  "Out Sourching": "Out Sourcing", "TOTAL PRICE CUSHION": "Cushion"}


def _t(v) -> str:
    return "" if v is None else str(v).strip()


def parse_materials(wb) -> list[Material]:
    ws = wb["DATA BASE HPP"]
    out: list[Material] = []
    category = "Material Raw"
    for r in range(8, ws.max_row + 1):
        a, b, c, d, e, f, g = (ws.cell(r, col).value for col in range(1, 8))
        name = _t(a)
        if not name:
            continue
        if name.upper() == "ITEM":
            continue
        is_label = all(x is None for x in (b, c, d, e, f))
        if is_label:
            category = CATEGORY_NAMES.get(name, name.strip().title() if name.isupper() else name.strip())
            continue
        out.append(Material(category=category, item=name, size=_t(b), price=num(d) or 0, price2=num(e), price_raw=num(c),
                            unit=_t(f), note=_t(g), order=len(out) + 1))
    return out


def parse_labor(wb) -> list[LaborGroup]:
    ws = wb["TENAGA KERJA % PER TAHUN"]
    years = {col: str(int(ws.cell(3, col).value)) for col in range(4, 17) if isinstance(ws.cell(3, col).value, (int, float))}
    groups: list[LaborGroup] = []
    cur: LaborGroup | None = None
    sub = ""
    for r in range(4, ws.max_row + 1):
        a, b, c = ws.cell(r, 1).value, _t(ws.cell(r, 2).value), _t(ws.cell(r, 3).value)
        q = _t(ws.cell(r, 17).value)
        rates = {y: num(ws.cell(r, col).value) for col, y in years.items()}
        has_vals = any(v is not None for v in rates.values())
        if b.upper() == "KENAIKAN %":
            cur = LaborGroup(name="?", no=int(a) if isinstance(a, (int, float)) else len(groups) + 1, order=len(groups) + 1,
                             increases={y: v or 0.0 for y, v in rates.items()})
            groups.append(cur)
            sub = ""
            continue
        if cur is None or not (b or c or has_vals):
            continue
        if b and cur.name == "?":
            cur.name = b.title() if b.isupper() else b
        if b and not has_vals:
            sub = b.title() if b.isupper() else b
            continue
        if not has_vals:
            continue
        unit = "" if (q.startswith("=") or num(q) is not None) else q
        label = (f"{sub} - {c}" if sub and c else c) or b or (unit if unit else "") or sub or cur.name
        cur.items.append(LaborItem(label=label, unit=unit, rates={y: (round(v, 2) if v is not None else None) for y, v in rates.items()}))
    return [g for g in groups if g.items]


def make_signature_png(name: str, path: Path, seed: int = 0) -> None:
    """Sample handwriting-like signature (placeholder until real scans are uploaded)."""
    import math
    import random
    from PIL import Image, ImageDraw
    rnd = random.Random(seed + 7)
    img = Image.new("RGBA", (420, 160), (255, 255, 255, 0))
    dr = ImageDraw.Draw(img)
    pts = []
    for i in range(400):
        t = i / 400
        x = 30 + 340 * t + 18 * math.sin(t * math.pi * (5 + seed))
        y = 82 - 38 * math.sin(t * math.pi * (3.5 + seed * 0.6)) * (1 - t * 0.6) + 10 * math.cos(t * math.pi * 9)
        pts.append((x, y))
    dr.line(pts, fill=(12, 40, 90, 255), width=4, joint="curve")
    dr.line([(60, 122), (330, 112)], fill=(12, 40, 90, 255), width=3)
    dr.text((300, 128), name.split()[0], fill=(12, 40, 90, 200))
    img.save(path)


async def main(reset: bool):
    await ensure_indexes()
    for email, name, role, pw in USERS:
        if not await db.users.find_one({"email": email}):
            await db.users.insert_one({"id": new_id(), "email": email, "name": name, "role": role, "active": True,
                                       "password_hash": hash_password(pw), "created_at": now_iso()})
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    if reset:
        await db.materials.delete_many({})
        await db.labor_groups.delete_many({})
    if await db.materials.count_documents({}) == 0:
        mats = parse_materials(wb)
        await db.materials.insert_many([m.model_dump() for m in mats])
        print(f"materials: {len(mats)}")
    if await db.labor_groups.count_documents({}) == 0:
        groups = parse_labor(wb)
        await db.labor_groups.insert_many([g.model_dump() for g in groups])
        print(f"labor groups: {len(groups)}")
    if not await db.hpp.find_one({"source": "seed"}):
        parsed = parse_workbook(XLSX.read_bytes())
        hpp, pack = await import_parsed(parsed, "Seed", labor_year=2026)
        await db.hpp.update_one({"id": hpp["id"]}, {"$set": {"source": "seed"}})
        await db.packaging.update_one({"id": pack["id"]}, {"$set": {"source": "seed", "checks": ["nobox_loosepack"], "produksi_sample": "TBA"}})
        print(f"sample HPP: {hpp['code_item']} net={hpp['totals']['net_cost']} hpp={hpp['totals']['hpp_total']}")
        sofa = PackagingIn(buyer="Pacific Urban System", item_name="Sofa", color="Natural", po_no="TBA", date="2026-10-21",
                           etd="2026-10-21", produksi_sample="TBA", ros_rop="TBA", keterangan="Untuk HPP", checks=["nobox_loosepack"],
                           notes="Indoor.\nDimensi : W 3400 mm x D 2181 mm x H 700 mm", sign_marketing="Vivian")
        p = build_packaging(sofa, "Seed", source="seed")
        await db.packaging.insert_one(p.model_dump())
    if await db.signatures.count_documents({}) == 0:
        from routers.attachments import upload_dir
        from models.schemas import Signature
        ids = []
        for i, (nm, pos) in enumerate([("Sholehudin M", "Staff R&D"), ("Ucu Moch.R", "Supervisor R&D"), ("Haryanto S", "Manager R&D")]):
            sid = new_id()
            stored = f"sig_{sid}.png"
            make_signature_png(nm, upload_dir() / stored, seed=i)
            await db.signatures.insert_one(Signature(id=sid, name=nm, position=pos, stored_name=stored, content_type="image/png",
                                                     created_by="Seed", created_at=now_iso()).model_dump())
            ids.append(sid)
        h = await db.hpp.find_one({"source": "seed"}, {"_id": 0, "id": 1})
        if h:
            await db.hpp.update_one({"id": h["id"]}, {"$set": {"approvals": dict(zip(["dibuat", "diperiksa", "diketahui"], ids)), "approval_status": "approved"}})
        print("signatures: 3 (contoh)")
    if await db.signatures.count_documents({"user_id": {"$ne": None}}) == 0:  # migration: link signers + demo approval states
        from lib.approvals import notify
        users = {u["email"]: u for u in await db.users.find({}, {"_id": 0}).to_list(50)}
        sigs = {}
        for nm, email in SIGNER_LINKS.items():
            await db.signatures.update_one({"name": nm}, {"$set": {"user_id": users[email]["id"]}})
            sigs[nm] = await db.signatures.find_one({"name": nm}, {"_id": 0})
        stamp = now_iso()
        await db.hpp.update_many({"source": "seed"}, {"$set": {"approval_signed": {"dibuat": stamp, "diperiksa": stamp, "diketahui": stamp},
                                                               "approval_status": "approved"}})
        pk = await db.packaging.find_one({"source": "seed", "hpp_id": {"$ne": None}}, {"_id": 0})
        if pk and all(sigs.values()):
            appr = {"marketing": sigs["Sholehudin M"]["id"], "dibuat_rnd": sigs["Ucu Moch.R"]["id"], "mengetahui_rnd": sigs["Haryanto S"]["id"]}
            await db.packaging.update_one({"id": pk["id"]}, {"$set": {"approvals": appr, "approval_signed": {"marketing": stamp}, "approval_status": "partial"}})
            admin = users["admin@balagi.com"]
            title = f"{pk['item_name']} · {pk['buyer']}"
            for slot, nm, label in (("dibuat_rnd", "Ucu Moch.R", "Dibuat R&D"), ("mengetahui_rnd", "Haryanto S", "Mengetahui R&D")):
                await notify(users[SIGNER_LINKS[nm]]["id"], "request", "packaging", pk["id"], slot, "Permintaan tanda tangan · Packaging Form",
                             f"{admin['name']} meminta Anda menandatangani sebagai “{label}” pada {title}.", requested_by=admin["id"])
        print("signers linked + demo approval requests")
    print("seed done")


if __name__ == "__main__":
    asyncio.run(main("--reset" in sys.argv))
