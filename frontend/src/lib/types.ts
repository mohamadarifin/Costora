// Hand-written mirrors of backend/models/schemas.py — keep in sync.
export type Role = "admin" | "marketing" | "rnd";
export type SectionKey = "material" | "additional" | "finishing" | "packing" | "cushion" | "upah_kerja" | "outsourcing";

export interface UserOut { id: string; email: string; name: string; role: Role; active: boolean; created_at: string }
export interface UserCreate { email: string; name: string; role: Role; password: string }
export interface UserUpdate { name: string; role: Role; active: boolean; password?: string | null }

export interface MaterialIn {
  category: string; item: string; size: string; price: number; price2: number | null; price_raw: number | null; unit: string; note: string;
}
export interface Material extends MaterialIn { id: string; order: number }
export interface MaterialPage { items: Material[]; total: number }
export interface CategoryCount { category: string; count: number }

export interface LaborItem { id: string; label: string; unit: string; rates: Record<string, number | null> }
export interface LaborGroupIn { name: string; increases: Record<string, number>; items: LaborItem[] }
export interface LaborGroup extends LaborGroupIn { id: string; no: number; order: number }

export interface HppLine {
  id: string; section: SectionKey; spec: string; item: string; material_id: string | null; labor_ref: string | null;
  volume: number; unit: string; price: number; mode: "mul" | "div"; total: number;
}
export interface HppTotals { sections: Record<string, number>; net_cost: number; rounding: number; ongkos_bahan: number; hpp_total: number }
export interface HppIn {
  code_item: string; colour: string; buyer: string; type: string; date: string; tw: number; td: number; th: number;
  labor_year: number; markup: number; notes: string; lines: HppLine[]; approvals: Record<string, string | null>;
}
export interface Hpp extends HppIn {
  id: string; month: string; totals: HppTotals; approval_status: string; source: string; created_by: string; created_at: string; updated_at: string;
}
export interface HppSummary {
  id: string; code_item: string; colour: string; buyer: string; type: string; date: string; month: string;
  totals: HppTotals; approval_status: string; source: string; created_by: string; updated_at: string;
}

export interface PackagingIn {
  hpp_id: string | null; buyer: string; item_name: string; color: string; po_no: string; date: string; etd: string;
  produksi_sample: string; ros_rop: string; keterangan: string; checks: string[]; details: Record<string, string>;
  marking: boolean; label: boolean; notes: string; sign_marketing: string; sign_dibuat_rnd: string; sign_mengetahui_rnd: string;
  approvals: Record<string, string | null>;
}
export interface Packaging extends PackagingIn { id: string; month: string; approval_status: string; source: string; created_by: string; created_at: string; updated_at: string }

export interface Attachment {
  id: string; owner_type: "hpp" | "packaging"; owner_id: string; filename: string; content_type: string; size: number;
  stored_name: string; uploaded_by: string; created_at: string;
}
export interface ImportResult { hpp_id: string; packaging_id: string; lines_imported: number; attachments: number; warnings: string[] }

export interface Kpis {
  hpp_count: number; buyer_count: number; packaging_count: number; material_count: number; total_hpp: number; avg_hpp: number;
  month_hpp_count: number; current_month: string;
}
export interface MonthPoint { month: string; count: number; total_hpp: number }
export interface BuyerPoint { buyer: string; count: number; total_hpp: number }
export interface SectionPoint { section: string; total: number }
export interface ActivityPoint { date: string; hpp: number; packaging: number }
export interface Signature { id: string; name: string; position: string; stored_name: string; content_type: string; created_by: string; created_at: string }
export interface Dashboard { activity: ActivityPoint[]; approved_count: number; generated_at: string; kpis: Kpis; monthly: MonthPoint[]; buyers: BuyerPoint[]; sections: SectionPoint[]; recent: HppSummary[] }
export interface BuyerReportRow {
  buyer: string; count: number; total_net: number; total_hpp: number; avg_hpp: number; packaging_count: number; items: HppSummary[];
}
export interface MonthReportRow {
  month: string; count: number; buyer_count: number; total_net: number; total_hpp: number; packaging_count: number; items: HppSummary[];
}
