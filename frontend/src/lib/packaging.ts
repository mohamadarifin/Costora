// Packaging Form checkbox options — mirrors backend/lib/packaging_options.py
export const PACKAGING_GROUPS: { title: string; options: { key: string; label: string }[] }[] = [
  { title: "Complement", options: [{ key: "cushion", label: "Cushion" }, { key: "glass", label: "Glass" }, { key: "accessories", label: "Accessories" }] },
  {
    title: "No Box",
    options: [
      { key: "nobox_single_closed", label: "Single face (Closed)" },
      { key: "nobox_loosepack", label: "Loosepack (Single face + Plastic)" },
      { key: "nobox_single_normal", label: "Single face (Normal)" },
      { key: "nobox_lainnya", label: "Lainnya" },
    ],
  },
  {
    title: "With Box",
    options: [
      { key: "wb_bag", label: "Bag" }, { key: "wb_polyfoam", label: "Polyfoam" }, { key: "wb_styrofoam", label: "Styrofoam" },
      { key: "wb_single_face", label: "Single face" }, { key: "wb_plastic", label: "Plastic" },
    ],
  },
  { title: "Craft", options: [{ key: "craft_100", label: "100 lbs" }, { key: "craft_150", label: "150 lbs" }, { key: "craft_200", label: "200 lbs" }, { key: "craft_275", label: "275 lbs" }] },
  { title: "Pcs/box", options: [{ key: "pcs_a1", label: "A1" }, { key: "pcs_a2", label: "A2" }, { key: "pcs_a_other", label: "A..." }] },
  {
    title: "Protect",
    options: [
      { key: "pr_carton", label: "Carton (100/150/200/275 lbs)" },
      { key: "pr_styrofoam", label: "Styrofoam (1 cm/2 cm/...)" },
      { key: "pr_plywood", label: "Plywood (...cm/...pcs)" },
      { key: "pr_empty_box", label: "Empty Box (100/150/200/275 lbs)" },
    ],
  },
];

// detail text inputs shown next to a checkbox key
export const DETAIL_FIELDS: Record<string, { key: string; label: string }[]> = {
  cushion: [{ key: "cushion_tebal", label: "Tebal" }, { key: "cushion_warna_cover", label: "Warna Cover" }, { key: "cushion_jenis_bahan", label: "Jenis bahan" }],
  glass: [{ key: "glass_tebal", label: "Tebal" }, { key: "glass_jenis", label: "Polos/tempered" }],
  nobox_lainnya: [{ key: "nobox_lainnya_text", label: "Lainnya" }],
  pcs_a_other: [{ key: "pcs_a_other_text", label: "Ukuran A..." }],
  pr_carton: [{ key: "pr_carton_spec", label: "Spesifikasi" }],
  pr_styrofoam: [{ key: "pr_styrofoam_spec", label: "Spesifikasi" }],
  pr_plywood: [{ key: "pr_plywood_spec", label: "Spesifikasi" }],
  pr_empty_box: [{ key: "pr_empty_box_spec", label: "Spesifikasi" }],
};
