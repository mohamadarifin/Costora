import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Boxes, ClipboardList, PackageCheck, Plus, TrendingUp, Upload, Users, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SimpleSelect from "@/components/SimpleSelect";
import { Empty, PageHeader, Panel } from "@/components/PageBits";
import { apiGet } from "@/lib/api";
import { can, useMe } from "@/lib/auth";
import { monthLabel, monthShort, rp } from "@/lib/format";
import type { Dashboard as DashboardT } from "@/lib/types";

const COLORS = ["#8C5824", "#C47B2B", "#4D6B3C", "#B45309", "#57534E", "#D6A86A", "#78350F"];
const YEARS = [{ value: "all", label: "Semua tahun" }, ...[2024, 2025, 2026, 2027].map((y) => ({ value: String(y), label: String(y) }))];

function Kpi({ icon: Icon, label, value, hint, testId }: { icon: typeof Wallet; label: string; value: string; hint?: string; testId: string }) {
  return (
    <div className="rise-in rounded-lg border bg-card p-4" data-testid={testId}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="grid size-8 place-items-center rounded-md bg-[#FEF3C7] text-[#92400E]"><Icon className="size-4" /></span>
      </div>
      <p className="num mt-3 text-2xl font-medium" data-testid={`${testId}-value`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [year, setYear] = useState("all");
  const { data: me } = useMe();
  const { data, isError } = useQuery({
    queryKey: ["dashboard", year],
    queryFn: () => apiGet<DashboardT>(`/dashboard${year === "all" ? "" : `?year=${year}`}`),
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
            <SimpleSelect value={year} onChange={setYear} options={YEARS} testId="dashboard-year-select" />
            {can(me, "import") && <Link to="/import" className={buttonVariants({ variant: "outline", size: "sm" })} data-testid="dashboard-import-link"><Upload className="size-4" /> Upload File Buyer</Link>}
            {can(me, "hpp:write") && <Link to="/hpp/new" className={buttonVariants({ size: "sm" })} data-testid="dashboard-new-hpp-link"><Plus className="size-4" /> HPP Baru</Link>}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={ClipboardList} label="Total HPP" value={k ? String(k.hpp_count) : "—"} hint="lembar perhitungan" testId="kpi-hpp-count" />
        <Kpi icon={Users} label="Buyer" value={k ? String(k.buyer_count) : "—"} hint="buyer aktif" testId="kpi-buyer-count" />
        <Kpi icon={PackageCheck} label="Packaging Form" value={k ? String(k.packaging_count) : "—"} testId="kpi-packaging-count" />
        <Kpi icon={Boxes} label="Material DB" value={k ? String(k.material_count) : "—"} hint="item harga" testId="kpi-material-count" />
        <Kpi icon={Wallet} label="Rata-rata HPP" value={k ? rp(k.avg_hpp) : "—"} hint="HPP total + markup" testId="kpi-avg-hpp" />
        <Kpi icon={TrendingUp} label="HPP Bulan Ini" value={k ? String(k.month_hpp_count) : "—"} hint={k ? monthLabel(k.current_month) : ""} testId="kpi-month-count" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel title="Tren HPP per Bulan" className="lg:col-span-3" testId="chart-monthly">
          {ok && data.monthly.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={data.monthly.map((m) => ({ ...m, label: monthShort(m.month) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={56} />
                  <Tooltip formatter={(v: number, n: string) => (n === "total_hpp" ? [rp(v), "Total HPP"] : [v, n])} />
                  <Bar dataKey="total_hpp" fill="#8C5824" radius={[4, 4, 0, 0]} />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                  <YAxis type="category" dataKey="buyer" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip formatter={(v: number) => rp(v)} />
                  <Bar dataKey="total_hpp" fill="#C47B2B" radius={[0, 4, 4, 0]} />
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
                  <tr key={h.id} className="border-t transition-colors hover:bg-[#F9F7F4]">
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
