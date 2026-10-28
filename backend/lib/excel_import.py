"""Parse a buyer workbook in the 'Rattan Bench 1' format (+ optional 'PACKAGING' sheet)."""

import re
from datetime import date, datetime
from io import BytesIO
from typing import Any

import openpyxl

from lib.packaging_options import OPTION_LABELS

TRUTHY = {"x", "v", "✓", "√", "✔", "☑", "ya", "yes", "1", "true", "ada"}


def num(v: Any) -> float | None:
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip().replace(" ", "").replace("Rp", "")
        if not s:
            return None
        if s.count(",") == 1 and "." not in s:
            s = s.replace(",", ".")
        else:
            s = s.replace(",", "")
        try:
            return float(s)
        except ValueError:
            return None
    return None


def to_date(v: Any) -> str | None:
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, str):
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %b %Y", "%d %B %Y"):
            try:
                return datetime.strptime(v.strip(), fmt).date().isoformat()
            except ValueError:
                continue
    return None


def _txt(v: Any) -> str:
    return "" if v is None else str(v).strip()


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.upper().replace(":", "")).strip()


def section_key(label: str) -> str | None:
    s = label.upper()
    for needle, key in (("ADDITIONAL", "additional"), ("FINISHING", "finishing"), ("PACKING", "packing"),
                        ("CUSHION", "cushion"), ("UPAH", "upah_kerja"), ("OUT SOUR", "outsourcing"),
                        ("MATERIAL", "material")):
        if needle in s:
            return key
    return None


def _find_hpp_sheet(wb):
    for ws in wb.worksheets:
        for r in range(1, 16):
            if _norm(_txt(ws.cell(r, 2).value)) == "CODE ITEM":
                return ws
    for ws in wb.worksheets:
        for r in range(1, min(ws.max_row, 600) + 1):
            if _norm(_txt(ws.cell(r, 1).value)).startswith("TOTAL PRICE"):
                return ws
    return None


def _parse_hpp(ws, warnings: list[str]) -> dict:
    header: dict[str, Any] = {"code_item": "", "colour": "", "buyer": "", "type": "", "date": None, "tw": 0.0, "td": 0.0, "th": 0.0}
    keymap = {"CODE ITEM": "code_item", "COLOUR": "colour", "COLOR": "colour", "BUYER": "buyer", "TYPE": "type", "DATE": "date"}
    for r in range(1, 16):
        label = _norm(_txt(ws.cell(r, 2).value))
        if label in keymap:
            val = ws.cell(r, 3).value
            header[keymap[label]] = to_date(val) if keymap[label] == "date" else _txt(val)
        if label.startswith("DIMENTION") or label.startswith("DIMENSION"):
            for col, k in ((4, "tw"), (5, "td"), (6, "th")):
                header[k] = num(ws.cell(r + 1, col).value) or 0.0

    lines: list[dict] = []
    current: str | None = None
    for r in range(1, ws.max_row + 1):
        a = ws.cell(r, 1).value
        au = _norm(_txt(a))
        if "TOTAL NET COST" in au:
            break
        if au.startswith("TOTAL PRICE"):
            current = section_key(au)
            continue
        if current is None:
            continue
        item = _txt(ws.cell(r, 2).value)
        vol = num(ws.cell(r, 3).value)
        if not item or not vol or item.upper() == "ITEM" or item.startswith("#"):
            continue
        price = num(ws.cell(r, 5).value) or 0.0
        total = num(ws.cell(r, 6).value)
        mode = "mul"
        if total and price and vol and abs(total - price / vol) + 0.01 < abs(total - price * vol):
            mode = "div"
        spec = "" if au in ("SPECIFICATION", "NOTE") else _txt(a)
        lines.append({"section": current, "spec": spec, "item": item, "volume": vol,
                      "unit": _txt(ws.cell(r, 4).value), "price": price, "mode": mode})
    if not lines:
        warnings.append("Tidak ada baris dengan volume terisi yang ditemukan di sheet HPP.")
    return {"header": header, "lines": lines}


def _right_value(ws, r: int, c: int) -> Any:
    for cc in range(c + 1, min(c + 8, ws.max_column + 1)):
        v = ws.cell(r, cc).value
        if v is not None and _txt(v) not in ("", ":"):
            return v
    return None


def _parse_packaging(ws) -> dict:
    labels = [("ITEM NAME", "item_name"), ("BUYER", "buyer"), ("COLOUR", "color"), ("COLOR", "color"),
              ("NO. PO", "po_no"), ("NO PO", "po_no"), ("ETD", "etd"), ("DATE", "date"),
              ("PRODUKSI/SAMPLE", "produksi_sample"), ("PRODUKSI", "produksi_sample"), ("NO. ROS", "ros_rop"),
              ("NO ROS", "ros_rop"), ("KETERANGAN", "keterangan"), ("NOTES", "notes"), ("LIST PROTECT", "list_protect"),
              ("MARKING", "marking"), ("LABEL", "label")]
    opt_norm = {_norm(v).split("(")[0].strip(): k for k, v in OPTION_LABELS.items()}
    out: dict[str, Any] = {"checks": [], "details": {}}
    for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row, 200)):
        for cell in row:
            t = _norm(_txt(cell.value))
            if not t:
                continue
            for lab, key in labels:
                if t == lab or (t.startswith(lab) and len(t) <= len(lab) + 12):
                    v = _right_value(ws, cell.row, cell.column)
                    if v is None and key == "notes":
                        v = ws.cell(cell.row + 1, cell.column).value
                    if v is None or key in out:
                        break
                    if key in ("date", "etd"):
                        out[key] = to_date(v) or _txt(v)
                    elif key in ("marking", "label"):
                        out[key] = _txt(v).lower() in TRUTHY
                    elif key == "list_protect":
                        out["details"]["list_protect"] = _txt(v)
                    else:
                        out[key] = _txt(v)
                    break
            base = t.split("(")[0].strip()
            if base in opt_norm:
                neighbours = [ws.cell(cell.row, cell.column - 1).value if cell.column > 1 else None,
                              ws.cell(cell.row, cell.column + 1).value]
                if any(n is True or _txt(n).lower() in TRUTHY for n in neighbours):
                    if opt_norm[base] not in out["checks"]:
                        out["checks"].append(opt_norm[base])
    return out


def parse_workbook(data: bytes) -> dict:
    """Returns {header, lines, packaging|None, warnings}. Raises ValueError when no HPP sheet is found."""
    try:
        wb = openpyxl.load_workbook(BytesIO(data), data_only=True)
    except Exception as exc:  # corrupt / not xlsx
        raise ValueError(f"File Excel tidak dapat dibaca: {exc}") from exc
    warnings: list[str] = []
    ws = _find_hpp_sheet(wb)
    if ws is None:
        raise ValueError("Sheet HPP (format 'Rattan Bench 1' dengan label CODE ITEM / TOTAL PRICE) tidak ditemukan.")
    parsed = _parse_hpp(ws, warnings)
    parsed["sheet"] = ws.title
    parsed["packaging"] = None
    for other in wb.worksheets:
        if "PACK" in other.title.upper():
            parsed["packaging"] = _parse_packaging(other)
            break
    parsed["warnings"] = warnings
    return parsed
