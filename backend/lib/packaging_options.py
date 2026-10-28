"""Packaging Form checkbox options (mirrored in frontend/src/lib/packaging.ts)."""

GROUPS: list[tuple[str, list[tuple[str, str]]]] = [
    ("Complement", [("cushion", "Cushion"), ("glass", "Glass"), ("accessories", "Accessories")]),
    ("No Box", [
        ("nobox_single_closed", "Single face (Closed)"),
        ("nobox_loosepack", "Loosepack (Single face + Plastic)"),
        ("nobox_single_normal", "Single face (Normal)"),
        ("nobox_lainnya", "Lainnya"),
    ]),
    ("With Box", [
        ("wb_bag", "Bag"), ("wb_polyfoam", "Polyfoam"), ("wb_styrofoam", "Styrofoam"),
        ("wb_single_face", "Single face"), ("wb_plastic", "Plastic"),
    ]),
    ("Craft", [("craft_100", "100 lbs"), ("craft_150", "150 lbs"), ("craft_200", "200 lbs"), ("craft_275", "275 lbs")]),
    ("Pcs/box", [("pcs_a1", "A1"), ("pcs_a2", "A2"), ("pcs_a_other", "A...")]),
    ("Protect", [
        ("pr_carton", "Carton (100/150/200/275 lbs)"),
        ("pr_styrofoam", "Styrofoam (1 cm/2 cm/...)"),
        ("pr_plywood", "Plywood (...cm/...pcs)"),
        ("pr_empty_box", "Empty Box (100/150/200/275 lbs)"),
    ]),
]

OPTION_LABELS: dict[str, str] = {k: v for _, opts in GROUPS for k, v in opts}

DETAIL_LABELS: dict[str, str] = {
    "cushion_tebal": "Cushion - Tebal",
    "cushion_warna_cover": "Cushion - Warna Cover",
    "cushion_jenis_bahan": "Cushion - Jenis bahan",
    "glass_tebal": "Glass - Tebal",
    "glass_jenis": "Glass - Polos/Tempered",
    "nobox_lainnya_text": "No box - Lainnya",
    "pcs_a_other_text": "Pcs/box - A...",
    "pr_carton_spec": "Carton spec",
    "pr_styrofoam_spec": "Styrofoam spec",
    "pr_plywood_spec": "Plywood spec",
    "pr_empty_box_spec": "Empty box spec",
    "list_protect": "List protect",
}
