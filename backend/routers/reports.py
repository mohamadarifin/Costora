from collections import defaultdict
from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from lib.auth import require
from lib.dates import today_iso
from lib.db import db
from lib.hpp_calc import SECTION_LABELS
from lib.pdf import report_pdf
from models.schemas import BuyerPoint, BuyerReportRow, Dashboard, Kpis, MonthPoint, MonthReportRow, SectionPoint
from routers.hpp import SUMMARY_PROJ, hpp_filter

router = APIRouter(tags=["reports"])
BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]


def month_label(m: str) -> str:
    try:
        return f"{BULAN[int(m[5:7]) - 1]} {m[:4]}"
    except (ValueError, IndexError):
        return m


async def _packaging_counts(key: str, flt: dict) -> dict[str, int]:
    rows = await db.packaging.aggregate([{"$match": flt}, {"$group": {"_id": f"${key}", "n": {"$sum": 1}}}]).to_list(5000)
    return {r["_id"]: r["n"] for r in rows}


@router.get("/dashboard", response_model=Dashboard)
async def dashboard(year: str = "", _: dict = Depends(require("report:read"))):
    flt = hpp_filter(year=year)
    items = await db.hpp.find(flt, SUMMARY_PROJ).sort([("date", -1), ("updated_at", -1)]).to_list(5000)
    current_month = today_iso()[:7]
    monthly: dict[str, list] = defaultdict(lambda: [0, 0.0])
    buyers: dict[str, list] = defaultdict(lambda: [0, 0.0])
    sections: dict[str, float] = defaultdict(float)
    for it in items:
        t = it["totals"]
        monthly[it["month"]][0] += 1
        monthly[it["month"]][1] += t["hpp_total"]
        buyers[it["buyer"]][0] += 1
        buyers[it["buyer"]][1] += t["hpp_total"]
        for k, v in t.get("sections", {}).items():
            sections[k] += v
    total = sum(it["totals"]["hpp_total"] for it in items)
    pk_flt = {"month": flt["month"]} if "month" in flt else {}
    kpis = Kpis(hpp_count=len(items), buyer_count=len(buyers), packaging_count=await db.packaging.count_documents(pk_flt),
                material_count=await db.materials.count_documents({}), total_hpp=round(total, 2),
                avg_hpp=round(total / len(items), 2) if items else 0, month_hpp_count=monthly.get(current_month, [0])[0],
                current_month=current_month)
    return Dashboard(
        kpis=kpis,
        monthly=[MonthPoint(month=m, count=v[0], total_hpp=round(v[1], 2)) for m, v in sorted(monthly.items())],
        buyers=sorted([BuyerPoint(buyer=b, count=v[0], total_hpp=round(v[1], 2)) for b, v in buyers.items()], key=lambda x: -x.total_hpp)[:10],
        sections=[SectionPoint(section=SECTION_LABELS.get(k, k), total=round(v, 2)) for k, v in sections.items() if v > 0],
        recent=items[:8],
    )


async def buyer_report(year: str, month: str) -> list[BuyerReportRow]:
    items = await db.hpp.find(hpp_filter(year=year, month=month), SUMMARY_PROJ).sort("date", 1).to_list(5000)
    pk = await _packaging_counts("buyer", {"month": month} if month else ({"month": {"$regex": f"^{year}-"}} if year else {}))
    groups: dict[str, list] = defaultdict(list)
    for it in items:
        groups[it["buyer"]].append(it)
    rows = []
    for b, its in groups.items():
        tn = sum(i["totals"]["net_cost"] for i in its)
        th = sum(i["totals"]["hpp_total"] for i in its)
        rows.append(BuyerReportRow(buyer=b, count=len(its), total_net=round(tn, 2), total_hpp=round(th, 2),
                                   avg_hpp=round(th / len(its), 2), packaging_count=pk.get(b, 0), items=its))
    return sorted(rows, key=lambda r: -r.total_hpp)


async def month_report(year: str, buyer: str) -> list[MonthReportRow]:
    items = await db.hpp.find(hpp_filter(year=year, buyer=buyer), SUMMARY_PROJ).sort("date", 1).to_list(5000)
    pflt: dict = {}
    if buyer:
        pflt["buyer"] = buyer
    if year:
        pflt["month"] = {"$regex": f"^{year}-"}
    pk = await _packaging_counts("month", pflt)
    groups: dict[str, list] = defaultdict(list)
    for it in items:
        groups[it["month"]].append(it)
    rows = []
    for m, its in sorted(groups.items()):
        rows.append(MonthReportRow(month=m, count=len(its), buyer_count=len({i["buyer"] for i in its}),
                                   total_net=round(sum(i["totals"]["net_cost"] for i in its), 2),
                                   total_hpp=round(sum(i["totals"]["hpp_total"] for i in its), 2), packaging_count=pk.get(m, 0), items=its))
    return rows


@router.get("/reports/buyer", response_model=list[BuyerReportRow])
async def report_buyer(year: str = "", month: str = "", _: dict = Depends(require("report:read"))):
    return await buyer_report(year, month)


@router.get("/reports/month", response_model=list[MonthReportRow])
async def report_month(year: str = "", buyer: str = "", _: dict = Depends(require("report:read"))):
    return await month_report(year, buyer)


@router.get("/reports/pdf")
async def report_pdf_route(kind: Literal["buyer", "month"], year: str = "", month: str = "", buyer: str = "",
                           _: dict = Depends(require("report:read"))):
    period = month_label(month) if month else (f"Tahun {year}" if year else "Semua periode")
    if kind == "buyer":
        rows = await buyer_report(year, month)
        groups = [{"name": r.buyer, "count": r.count, "total_net": r.total_net, "total_hpp": r.total_hpp,
                   "packaging_count": r.packaging_count, "items": [i.model_dump() for i in r.items]} for r in rows]
        pdf = report_pdf("LAPORAN HPP PER BUYER", f"Periode: {period}", groups, "BUYER")
    else:
        rows_m = await month_report(year, buyer)
        groups = [{"name": month_label(r.month), "count": r.count, "total_net": r.total_net, "total_hpp": r.total_hpp,
                   "packaging_count": r.packaging_count, "items": [i.model_dump() for i in r.items]} for r in rows_m]
        pdf = report_pdf("LAPORAN HPP PER BULAN", f"Periode: {period}" + (f" — Buyer: {buyer}" if buyer else ""), groups, "BULAN")
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="Laporan_HPP_{kind}.pdf"'})
