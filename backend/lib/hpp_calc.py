"""HPP computation — mirrors the 'Rattan Bench 1' sheet formulas."""

import math

from models.schemas import HppLine, HppTotals

SECTIONS: list[tuple[str, str]] = [
    ("material", "Bahan Material"),
    ("additional", "Bahan Additional Material"),
    ("finishing", "Bahan Finishing"),
    ("packing", "Bahan Packing"),
    ("cushion", "Cushion"),
    ("upah_kerja", "Upah Kerja"),
    ("outsourcing", "Out Sourcing"),
]
SECTION_LABELS = dict(SECTIONS)


def line_total(line: HppLine) -> float:
    if line.mode == "div":
        return line.price / line.volume if line.volume else 0.0
    return line.volume * line.price


def compute(lines: list[HppLine], markup: float) -> tuple[list[HppLine], HppTotals]:
    sections = {k: 0.0 for k, _ in SECTIONS}
    out: list[HppLine] = []
    for line in lines:
        total = round(line_total(line), 2)
        out.append(line.model_copy(update={"total": total}))
        sections[line.section] += total
    sections = {k: round(v, 2) for k, v in sections.items()}
    net = round(sum(sections.values()), 2)
    rounding = float(math.ceil(round(net, 4) / 1000) * 1000)  # ROUNDUP(net,-3)
    ongkos = round((net - sections["upah_kerja"]) * markup + rounding, 2)  # ONGKOS BAHAN + 32%
    hpp_total = round(rounding * (1 + markup), 2)  # HPP TOTAL + 32%
    return out, HppTotals(sections=sections, net_cost=net, rounding=rounding, ongkos_bahan=ongkos, hpp_total=hpp_total)
