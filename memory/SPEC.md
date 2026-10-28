# SPEC — Sistem HPP PT Balagi Rattan

Built on FastAPI + React + MongoDB (user asked PHP 8.5/MySQL; platform runs this stack — same functionality).
Source workbook: `backend/seed_data/HPP_AGUSTUS_2026.xlsx` (sheets: TENAGA KERJA % PER TAHUN, DATA BASE HPP, Rattan Bench 1). UI language: Indonesian.

## Roles (RBAC, server-enforced in backend/lib/auth.py PERMS)
- admin: everything + user management
- rnd: materials/labor/HPP/packaging write, import, attachments, reports
- marketing: read all + packaging write, import buyer files, attachments, reports. CANNOT edit HPP/materials/labor (403).

## Data model (Mongo collections)
- users {id,email,name,role,active,password_hash(pbkdf2)}
- materials {id,category,item,size,price,price2,price_raw,unit,note,order} — 541 rows seeded from DATA BASE HPP
- labor_groups {id,no,name,increases{year:pct},items[{id,label,unit,rates{year:value}}]} — 19 groups, years 2014–2026
- hpp {id,code_item,colour,buyer,type,date,month,tw,td,th,labor_year,markup,notes,lines[{section,spec,item,material_id,labor_ref,volume,unit,price,mode(mul|div),total}],totals,source}
  - sections: material, additional, finishing, packing, cushion, upah_kerja, outsourcing
  - totals: net_cost=sum; rounding=ROUNDUP(net,-3); ongkos_bahan=(net-upah_kerja)*markup+rounding; hpp_total=rounding*(1+markup); markup default 0.32
- packaging {id,hpp_id?,buyer,item_name,color,po_no,date,etd,produksi_sample,ros_rop,keterangan,checks[],details{},marking,label,notes,sign_*}
- attachments {id,owner_type(hpp|packaging),owner_id,filename,stored_name,...}; files in backend/uploads

## Key flows
- Upload File Buyer (/import): POST /api/import/buyer multipart (file .xlsx in Rattan Bench 1 format, attachments[], buyer?, labor_year?) → creates HPP + linked Packaging Form (+ parses sheet with "PACK" in its name if present) + attachments on HPP. GET /api/import/template downloads sample workbook.
- HPP editor (/hpp/:id or /hpp/new): sectioned lines, pick from materials DB or labor rates (year), live totals, save, duplicate, PDF (/api/hpp/{id}/pdf), "Buat Packaging Form" (POST /api/packaging/from-hpp/{id}).
- Packaging Form (/packaging/:id): checkbox groups like the paper form, link to HPP, attachments, PDF.
- Labor matrix (/labor): edit % & rates per year, recalc year from previous, add year (POST /api/labor/years).
- Dashboard (/), Reports (/reports): per buyer / per month, print + PDF (/api/reports/pdf?kind=buyer|month&year&month&buyer).

## Seed facts
- Sample HPP "Rattan bench 1 (MELENGKUNG)", buyer GOY ARCHITECT, date 2026-10-28, 30 lines; Net 573.444,95 → rounding 574.000 → HPP total 757.680 (matches Excel).
- Linked packaging form for it (source seed) + standalone packaging "Pacific Urban System – Sofa" (2026-10-21, Loosepack checked).

## Iteration 2 — Approval, emerald theme, real-time dashboard, FinDev
- signatures collection {id,name,position,stored_name,content_type}; images in backend/uploads/sig_*.png. Routes: GET /api/signatures, POST (multipart name/position/file, perm signature:manage = admin+rnd), GET /{id}/image, DELETE (unlinks from approvals).
- HPP.approvals {dibuat,diperiksa,diketahui} → signature ids; Packaging.approvals {marketing,dibuat_rnd,mengetahui_rnd}. approval_status computed server-side: draft | partial | approved (all 3). Invalid signature id → 422. PDFs render signature images + names + positions; HPP PDF also shows first image attachment of the HPP.
- Page /signatures (Template Tanda Tangan). ApprovalPanel on HPP & Packaging editors (pick from dropdown, then Save).
- Dashboard: auto-refresh every 5 s (Live indicator), 14-day activity area chart, approved KPI, total HPP KPI.
- Theme: emerald (#047857 / #022C22 sidebar) + gold (#B8963E), headings Playfair Display. Copyright "© FinDev" in sidebar, footer, login, and PDF footers.
- Seed: 3 SAMPLE (generated) signatures Sholehudin M (Staff R&D), Ucu Moch.R (Supervisor R&D), Haryanto S (Manager R&D); seeded HPP approved with all three.
