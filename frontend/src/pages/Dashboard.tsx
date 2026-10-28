import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Boxes, ClipboardList, Coins, PackageCheck, Plus, TrendingUp, Upload, Users, Wallet } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SimpleSelect from "@/components/SimpleSelect";
import { Empty, PageHeader, Panel } from "@/components/PageBits";
import { apiGet } from "@/lib/api";
import { can, useMe } from "@/lib/auth";
import { monthLabel, monthShort, rp } from "@/lib/format";
import type { Dashboard as DashboardT } from "@/lib/types";

const COLORS = ["#047857", "#B8963E", "#10B981", "#0F766E", "#57534E", "#D4B86A", "#064E3B"];
const REFRESH_MS = 5000;
const YEARS = [{ value: "all", label: "Semua tahun" }, ...[2024, 2025, 2026, 2027].map((y) => ({ value: String(y), label: String(y) }))];

function Kpi({ icon: Icon, label, value, hint, testId }: { icon: typeof Wallet; label: string; value: string; hint?: string; testId: string }) {
  return (
    <div className="lux-card rise-in rounded-xl border p-4 transition-transform duration-200 hover:-translate-y-0.5" data-testid={testId}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="grid size-8 place-items-center rounded-md bg-[#D1FAE5] text-[#065F46]"><Icon className="size-4" /></span>
      </div>
      <p className="num mt-3 text-2xl font-medium" data-testid={`${testId}-value`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [year, setYear] = useState("all");
  const { data: me } = useMe();
  const { data, isError, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["dashboard", year],
    queryFn: () => apiGet<DashboardT>(`/dashboard${year === "all" ? "" : `?year=${year}`}`),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });
  const ok = data && !isError;
  const k = ok ? data.kpis : undefined;

  return (
    <div>
      <PageHeader
        title="Dashboard HPP"
        subtitle="Ringkasan perhitungan HPP, buyer, packaging form, dan database material PT Balagi Rattan."
        actions={
          <>
            <span className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${isError ? "border-red-200 text-red-700" : "border-[#A7CDB8] bg-[#ECFDF5] text-[#065F46]"}`} data-testid="dashboard-live-indicator">
              <span className={`size-2 rounded-full ${isError ? "bg-red-500" : "live-dot bg-[#10B981]"}`} />
              {isError ? "Offline" : `Live · ${isFetching ? "memperbarui..." : dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("id-ID") : "—"}`}
            </span>
            <SimpleSelect value={year} onChange={setYear} options={YEARS} testId="dashboard-year-select" />
            {can(me, "import") && <Link to="/import" className={buttonVariants({ variant: "outline", size: "sm" })} data-testid="dashboard-import-link"><Upload className="size-4" /> Upload File Buyer</Link>}
            {can(me, "hpp:write") && <Link to="/hpp/new" className={buttonVariants({ size: "sm" })} data-testid="dashboard-new-hpp-link"><Plus className="size-4" /> HPP Baru</Link>}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={ClipboardList} label="Total HPP" value={k ? String(k.hpp_count) : "—"} hint="lembar perhitungan" testId="kpi-hpp-count" />
        <Kpi icon={Users} label="Buyer" value={k ? String(k.buyer_count) : "—"} hint="buyer aktif" testId="kpi-buyer-count" />
        <Kpi icon={PackageCheck} label="Packaging Form" value={k ? String(k.packaging_count) : "—"} testId="kpi-packaging-count" />
        <Kpi icon={Boxes} label="Material DB" value={k ? String(k.material_count) : "—"} hint="item harga" testId="kpi-material-count" />
        <Kpi icon={Wallet} label="Rata-rata HPP" value={k ? rp(k.avg_hpp) : "—"} hint="HPP total + markup" testId="kpi-avg-hpp" />
        <Kpi icon={Coins} label="Total Nilai HPP" value={k ? rp(k.total_hpp) : "—"} hint="akumulasi periode" testId="kpi-total-hpp" />
        <Kpi icon={BadgeCheck} label="HPP Approved" value={ok ? `${data.approved_count} / ${k?.hpp_count ?? 0}` : "—"} hint="sudah ditandatangani lengkap" testId="kpi-approved" />
        <Kpi icon={TrendingUp} label="HPP Bulan Ini" value={k ? String(k.month_hpp_count) : "—"} hint={k ? monthLabel(k.current_month) : ""} testId="kpi-month-count" />
      </div>

      <Panel className="mt-4" testId="chart-activity"
        title={<span className="flex items-center gap-2">Aktivitas Real-time · 14 hari terakhir <span className="live-dot size-2 rounded-full bg-[#10B981]" /></span>}
        action={<span className="text-[11px] text-muted-foreground">diperbarui otomatis tiap {REFRESH_MS / 1000} detik</span>}>
        {ok && data.activity.length ? (
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={data.activity.map((a) => ({ ...a, label: a.date.slice(8, 10) + "/" + a.date.slice(5, 7) }))}>
                <defs>
                  <linearGradient id="gHpp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#047857" stopOpacity={0.45} /><stop offset="100%" stopColor="#047857" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gPack" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B8963E" stopOpacity={0.45} /><stop offset="100%" stopColor="#B8963E" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCE9E1" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                <Tooltip formatter={(v: number, n: string) => [v, n === "hpp" ? "HPP dibuat" : "Packaging dibuat"]} />
                <Legend formatter={(v: string) => (v === "hpp" ? "HPP dibuat" : "Packaging dibuat")} />
                <Area type="monotone" dataKey="hpp" stroke="#047857" strokeWidth={2} fill="url(#gHpp)" isAnimationActive={false} />
                <Area type="monotone" dataKey="packaging" stroke="#B8963E" strokeWidth={2} fill="url(#gPack)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty text="Belum ada aktivitas." />}
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel title="Tren HPP per Bulan" className="lg:col-span-3" testId="chart-monthly">
          {ok && data.monthly.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={data.monthly.map((m) => ({ ...m, label: monthShort(m.month) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DCE9E1" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={56} />
                  <Tooltip formatter={(v: number, n: string) => (n === "total_hpp" ? [rp(v), "Total HPP"] : [v, n])} />
                  <Bar dataKey="total_hpp" fill="#047857" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty text="Belum ada data bulanan." />}
        </Panel>
        <Panel title="Komposisi Biaya" className="lg:col-span-2" testId="chart-sections">
          {ok && data.sections.length ? (
            <div className="flex h-64 items-center gap-4">
              <ResponsiveContainer width="55%">
                <PieChart>
                  <Pie data={data.sections} dataKey="total" nameKey="section" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {data.sections.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => rp(v)} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex-1 space-y-1.5 text-xs">
                {data.sections.map((s, i) => (
                  <li key={s.section} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="flex-1 truncate">{s.section}</span>
                    <span className="num">{rp(s.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : <Empty text="Belum ada data biaya." />}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel title="Top Buyer (Total HPP)" className="lg:col-span-2" testId="chart-buyers">
          {ok && data.buyers.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={data.buyers} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DCE9E1" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                  <YAxis type="category" dataKey="buyer" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip formatter={(v: number) => rp(v)} />
                  <Bar dataKey="total_hpp" fill="#B8963E" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty text="Belum ada buyer." />}
        </Panel>
        <Panel title="HPP Terbaru" className="lg:col-span-3" action={<Link to="/hpp" className="text-xs font-medium text-primary hover:underline" data-testid="dashboard-all-hpp-link">Lihat semua</Link>} testId="recent-hpp">
          {ok && data.recent.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="pb-2">Item</th><th className="pb-2">Buyer</th><th className="pb-2">Tanggal</th><th className="pb-2 text-right">HPP Total</th></tr>
              </thead>
              <tbody>
                {data.recent.map((h) => (
                  <tr key={h.id} className="border-t transition-colors hover:bg-[#F0F7F3]">
                    <td className="py-2"><Link to={`/hpp/${h.id}`} className="font-medium hover:underline" data-testid={`recent-hpp-${h.id}`}>{h.code_item}</Link>
                      {h.source === "import" && <Badge variant="outline" className="ml-2 text-[10px]">import</Badge>}</td>
                    <td className="py-2 text-muted-foreground">{h.buyer}</td>
                    <td className="num py-2 text-xs">{h.date}</td>
                    <td className="num py-2 text-right font-medium">{rp(h.totals.hpp_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty text="Belum ada HPP." />}
        </Panel>
      </div>
    </div>
  );
}
