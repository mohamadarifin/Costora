"""PDF rendering (reportlab) for HPP sheets, packaging forms and reports."""

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from lib.hpp_calc import SECTIONS
from lib.packaging_options import DETAIL_LABELS, GROUPS

BROWN = colors.HexColor("#065F46")
GOLD = colors.HexColor("#B8963E")
HEAD_BG = colors.HexColor("#E7F3EC")
TOTAL_BG = colors.HexColor("#D1FAE5")
COPYRIGHT = "© FinDev — Sistem HPP PT Balagi Rattan"
COMPANY = "PT BALAGI RATTAN"
ADDRESS = "Jl. Raya Kanci KM 9 Kec. Astanajapura, Cirebon 45181, Jawa Barat, Indonesia"

_ss = getSampleStyleSheet()
H1 = ParagraphStyle("h1", parent=_ss["Heading1"], fontSize=15, textColor=BROWN, spaceAfter=2)
H2 = ParagraphStyle("h2", parent=_ss["Heading3"], fontSize=10.5, spaceBefore=8, spaceAfter=3)
SMALL = ParagraphStyle("small", parent=_ss["Normal"], fontSize=8, textColor=colors.HexColor("#57534E"))
CELL = ParagraphStyle("cell", parent=_ss["Normal"], fontSize=8, leading=10)


def rp(v: float | None) -> str:
    return "Rp " + f"{round(v or 0):,.0f}".replace(",", ".")


def fnum(v: float | None) -> str:
    v = v or 0
    s = f"{v:,.2f}".rstrip("0").rstrip(".")
    return s.replace(",", "#").replace(".", ",").replace("#", ".")


def _grid(data, widths, header=True, total_rows: tuple[int, ...] = ()):
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#BDB5AA")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    if header:
        style += [("BACKGROUND", (0, 0), (-1, 0), HEAD_BG), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold")]
    for r in total_rows:
        style += [("BACKGROUND", (0, r), (-1, r), TOTAL_BG), ("FONTNAME", (0, r), (-1, r), "Helvetica-Bold")]
    t.setStyle(TableStyle(style))
    return t


def _build(story, pagesize=A4) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=pagesize, leftMargin=14 * mm, rightMargin=14 * mm, topMargin=12 * mm, bottomMargin=12 * mm)
    def footer(canvas, d):
        canvas.saveState()
        canvas.setStrokeColor(GOLD)
        canvas.line(d.leftMargin, 9 * mm, d.pagesize[0] - d.rightMargin, 9 * mm)
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#57534E"))
        canvas.drawString(d.leftMargin, 6 * mm, COPYRIGHT)
        canvas.drawRightString(d.pagesize[0] - d.rightMargin, 6 * mm, f"Hal. {d.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()


def signature_block(sigs: list[dict], width: float = 182 * mm) -> Table:
    """3-column approval block: label, signature image, name, position."""
    col = width / max(len(sigs), 1)
    labels, images, names = [], [], []
    for sg in sigs:
        labels.append(f"{sg['label']} :")
        if sg.get("path"):
            try:
                im = Image(sg["path"])
                ratio = min((col - 8 * mm) / im.imageWidth, (18 * mm) / im.imageHeight)
                im.drawWidth, im.drawHeight = im.imageWidth * ratio, im.imageHeight * ratio
                images.append(im)
            except Exception:
                images.append("")
        else:
            images.append("")
        nm = f"<b>{sg.get('name') or '(belum dipilih)'}</b>" + (f"<br/>{sg['position']}" if sg.get("position") else "")
        names.append(Paragraph(nm, ParagraphStyle("sig", parent=CELL, alignment=1)))
    t = Table([labels, images, names], colWidths=[col] * len(sigs), rowHeights=[6 * mm, 22 * mm, None])
    t.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                           ("FONTSIZE", (0, 0), (-1, 0), 9), ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#BDB5AA")),
                           ("INNERGRID", (0, 0), (-1, 0), 0.4, colors.HexColor("#BDB5AA")),
                           ("LINEBEFORE", (1, 0), (-1, -1), 0.4, colors.HexColor("#BDB5AA"))]))
    return t


def _letterhead(title: str) -> list:
    return [Paragraph(COMPANY, H1), Paragraph(ADDRESS, SMALL), Spacer(1, 4), Paragraph(f"<b>{title}</b>", H2)]


def hpp_pdf(h: dict, sigs: list[dict] | None = None, image_path: str | None = None) -> bytes:
    story = _letterhead("PERHITUNGAN HPP")
    if image_path:
        try:
            im = Image(image_path)
            ratio = min((60 * mm) / im.imageWidth, (40 * mm) / im.imageHeight)
            im.drawWidth, im.drawHeight = im.imageWidth * ratio, im.imageHeight * ratio
            im.hAlign = "LEFT"
            story += [im, Spacer(1, 4)]
        except Exception:
            pass
    meta = [
        ["CODE ITEM", h.get("code_item", ""), "BUYER", h.get("buyer", "")],
        ["COLOUR", h.get("colour", ""), "TYPE", h.get("type", "")],
        ["DATE", h.get("date", ""), "DIMENSI (M) TW/TD/TH", f"{fnum(h.get('tw'))} / {fnum(h.get('td'))} / {fnum(h.get('th'))}"],
    ]
    story.append(_grid(meta, [28 * mm, 60 * mm, 38 * mm, 56 * mm], header=False))
    totals = h.get("totals", {})
    sect_totals = totals.get("sections", {})
    for key, label in SECTIONS:
        lines = [ln for ln in h.get("lines", []) if ln["section"] == key]
        if not lines:
            continue
        story.append(Paragraph(f"TOTAL PRICE {label.upper()} — {rp(sect_totals.get(key))}", H2))
        data = [["SPEC", "ITEM", "VOLUME", "UNIT", "PRICE / UNIT", "TOTAL"]]
        for ln in lines:
            data.append([Paragraph(ln.get("spec", ""), CELL), Paragraph(ln["item"], CELL), fnum(ln["volume"]), ln.get("unit", ""),
                         rp(ln["price"]) + (" ÷ vol" if ln.get("mode") == "div" else ""), rp(ln["total"])])
        story.append(_grid(data, [30 * mm, 52 * mm, 18 * mm, 18 * mm, 32 * mm, 32 * mm]))
    story.append(Spacer(1, 8))
    pct = round(h.get("markup", 0.32) * 100)
    summary = [
        ["TOTAL NET COST", rp(totals.get("net_cost"))],
        ["ROUNDING TOTAL NET COST", rp(totals.get("rounding"))],
        [f"ONGKOS BAHAN + {pct} %", rp(totals.get("ongkos_bahan"))],
        [f"HPP TOTAL + {pct} %", rp(totals.get("hpp_total"))],
    ]
    story.append(_grid(summary, [120 * mm, 62 * mm], header=False, total_rows=(3,)))
    if sigs:
        story += [Spacer(1, 10), signature_block(sigs)]
    return _build(story)


def packaging_pdf(p: dict, sigs: list[dict] | None = None) -> bytes:
    story = _letterhead("PACKAGING FORM — Research & Development")
    meta = [
        ["Buyer", p.get("buyer", ""), "Date", p.get("date", "")],
        ["Item Name", p.get("item_name", ""), "ETD", p.get("etd", "")],
        ["Color", p.get("color", ""), "Produksi/sample", p.get("produksi_sample", "")],
        ["No. PO", p.get("po_no", ""), "No. ROS / ROP", p.get("ros_rop", "")],
        ["Keterangan", Paragraph(p.get("keterangan", ""), CELL), "", ""],
    ]
    t = _grid(meta, [28 * mm, 63 * mm, 32 * mm, 59 * mm], header=False)
    t.setStyle(TableStyle([("SPAN", (1, 4), (3, 4))]))
    story.append(t)
    checks = set(p.get("checks", []))
    for group, opts in GROUPS:
        story.append(Paragraph(group, H2))
        row = [f"[{'X' if k in checks else '  '}] {label}" for k, label in opts]
        while len(row) % 3:
            row.append("")
        story.append(_grid([row[i:i + 3] for i in range(0, len(row), 3)], [61 * mm] * 3, header=False))
    details = [[DETAIL_LABELS.get(k, k), Paragraph(v, CELL)] for k, v in p.get("details", {}).items() if v]
    if details:
        story.append(Paragraph("Detail", H2))
        story.append(_grid(details, [50 * mm, 132 * mm], header=False))
    story.append(Paragraph("Marking", H2))
    story.append(_grid([["Marking", "Ada" if p.get("marking") else "Tidak", "Label", "Ada" if p.get("label") else "Tidak"]],
                       [30 * mm, 61 * mm, 30 * mm, 61 * mm], header=False))
    story.append(Paragraph("*Jika ada Marking dan Label mohon lampirkan ukuran dan tata letaknya.", SMALL))
    story.append(Paragraph("Notes", H2))
    story.append(_grid([[Paragraph((p.get("notes") or "-").replace("\n", "<br/>"), CELL)]], [182 * mm], header=False))
    story.append(Spacer(1, 14))
    if sigs and any(sg.get("name") for sg in sigs):
        fallback = {"marketing": p.get("sign_marketing", ""), "dibuat_rnd": p.get("sign_dibuat_rnd", ""), "mengetahui_rnd": p.get("sign_mengetahui_rnd", "")}
        story.append(signature_block([{**sg, "name": sg.get("name") or fallback.get(sg["key"], "")} for sg in sigs]))
        return _build(story)
    sign = [["Marketing,", "Dibuat R&D,", "Mengetahui R&D,"], ["\n\n\n", "", ""],
            [p.get("sign_marketing", ""), p.get("sign_dibuat_rnd", ""), p.get("sign_mengetahui_rnd", "")]]
    st = Table(sign, colWidths=[61 * mm] * 3)
    st.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("FONTSIZE", (0, 0), (-1, -1), 9),
                            ("LINEABOVE", (0, 2), (-1, 2), 0.6, colors.black)]))
    story.append(st)
    return _build(story)


def report_pdf(title: str, subtitle: str, groups: list[dict], group_label: str) -> bytes:
    """groups: [{name, count, total_net, total_hpp, packaging_count, items:[summary dicts]}]"""
    story = _letterhead(title)
    story.append(Paragraph(subtitle, SMALL))
    story.append(Spacer(1, 6))
    data = [[group_label, "JML HPP", "PACKAGING", "TOTAL NET COST", "TOTAL HPP", "RATA-RATA HPP"]]
    for g in groups:
        avg = g["total_hpp"] / g["count"] if g["count"] else 0
        data.append([Paragraph(g["name"], CELL), str(g["count"]), str(g["packaging_count"]), rp(g["total_net"]), rp(g["total_hpp"]), rp(avg)])
    tc = sum(g["count"] for g in groups)
    th = sum(g["total_hpp"] for g in groups)
    data.append(["TOTAL", str(tc), str(sum(g["packaging_count"] for g in groups)), rp(sum(g["total_net"] for g in groups)), rp(th), rp(th / tc if tc else 0)])
    story.append(_grid(data, [70 * mm, 22 * mm, 24 * mm, 45 * mm, 45 * mm, 45 * mm], total_rows=(len(data) - 1,)))
    for g in groups:
        story.append(Paragraph(f"{group_label}: {g['name']}", H2))
        rows = [["TANGGAL", "CODE ITEM", "BUYER", "COLOUR", "TYPE", "NET COST", "HPP TOTAL"]]
        for it in g["items"]:
            rows.append([it["date"], Paragraph(it["code_item"], CELL), Paragraph(it["buyer"], CELL), it.get("colour", ""), it.get("type", ""),
                         rp(it["totals"]["net_cost"]), rp(it["totals"]["hpp_total"])])
        story.append(_grid(rows, [24 * mm, 62 * mm, 45 * mm, 30 * mm, 24 * mm, 34 * mm, 34 * mm]))
    return _build(story, landscape(A4))
