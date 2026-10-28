import type { Role, SectionKey } from "./types";

export const rp = (v: number | null | undefined) =>
  "Rp " + Math.round(v ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

export const fnum = (v: number | null | undefined, digits = 2) =>
  (v ?? 0).toLocaleString("id-ID", { maximumFractionDigits: digits });

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const monthLabel = (m: string) => {
  const idx = Number(m.slice(5, 7)) - 1;
  return idx >= 0 && idx < 12 ? `${BULAN[idx]} ${m.slice(0, 4)}` : m;
};
export const monthShort = (m: string) => {
  const idx = Number(m.slice(5, 7)) - 1;
  return idx >= 0 && idx < 12 ? `${BULAN[idx].slice(0, 3)} ${m.slice(2, 4)}` : m;
};

export const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "material", label: "Bahan Material" },
  { key: "additional", label: "Bahan Additional Material" },
  { key: "finishing", label: "Bahan Finishing" },
  { key: "packing", label: "Bahan Packing" },
  { key: "cushion", label: "Cushion" },
  { key: "upah_kerja", label: "Upah Kerja" },
  { key: "outsourcing", label: "Out Sourcing" },
];

export const ROLE_LABELS: Record<Role, string> = { admin: "Admin", marketing: "Marketing", rnd: "R&D" };

const READ = ["material:read", "labor:read", "hpp:read", "packaging:read", "report:read"];
// Mirrors backend/lib/auth.py PERMS — UI hint only, the server enforces.
export const PERMS: Record<Role, string[]> = {
  admin: [...READ, "material:write", "labor:write", "hpp:write", "packaging:write", "import", "attachment:write", "user:manage", "signature:manage"],
  rnd: [...READ, "material:write", "labor:write", "hpp:write", "packaging:write", "import", "attachment:write", "signature:manage"],
  marketing: [...READ, "packaging:write", "import", "attachment:write"],
};

export function errMsg(e: unknown): string {
  const body = (e as { body?: { detail?: unknown } })?.body;
  const d = body?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) return d.map((x: { loc?: unknown[]; msg?: string }) => `${(x.loc ?? []).slice(-1)}: ${x.msg}`).join(", ");
  return e instanceof Error ? e.message : "Terjadi kesalahan";
}

export const APPROVAL_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-[#EEF2EF] text-[#4F6359]" },
  partial: { label: "Menunggu tanda tangan", cls: "bg-[#FBF3DC] text-[#7A5B12]" },
  approved: { label: "Approved", cls: "bg-[#D1FAE5] text-[#065F46]" },
  rejected: { label: "Ditolak — perlu revisi", cls: "bg-[#FEE2E2] text-[#991B1B]" },
};
export const HPP_SLOTS = [{ key: "dibuat", label: "Dibuat" }, { key: "diperiksa", label: "Diperiksa" }, { key: "diketahui", label: "Diketahui" }];
export const PACKAGING_SLOTS = [{ key: "marketing", label: "Marketing" }, { key: "dibuat_rnd", label: "Dibuat R&D" }, { key: "mengetahui_rnd", label: "Mengetahui R&D" }];
