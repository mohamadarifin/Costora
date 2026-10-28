import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, FileDown, Printer } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SimpleSelect from "@/components/SimpleSelect";
import { Empty, PageHeader, Panel } from "@/components/PageBits";
import { apiGet, apiUrl } from "@/lib/api";
import { monthLabel, monthShort, rp } from "@/lib/format";
import type { BuyerReportRow, HppSummary, MonthReportRow } from "@/lib/types";

const YEARS = [{ value: "all", label: "Semua tahun" }, ...[2024, 2025, 2026, 2027].map((y) => ({ value: String(y), label: String(y) }))];

function ItemsTable({ items }: { items: HppSummary[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-muted-foreground"><tr><th className="py-1">Tanggal</th><th>Code Item</th><th>Buyer</th><th>Colour</th><th className="text-right">Net Cost</th><th className="text-right">HPP Total</th></tr></thead>
      <tbody>
        {items.map((i) => (
          <tr key={i.id} className="border-t border-dashed">
            <td className="num py-1">{i.date}</td>
            <td><Link to={`/hpp/${i.id}`} className="hover:underline">{i.code_item}</Link></td>
            <td>{i.buyer}</td><td>{i.colour}</td>
            <td className="num text-right">{rp(i.totals.net_cost)}</td>
            <td className="num text-right">{rp(i.totals.hpp_total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SummaryTable<T extends { count: number; total_net: number; total_hpp: number; packaging_count: number; items: HppSummary[] }>({
  rows, name, keyOf, head, testId,
}: { rows: T[]; name: (r: T) => string; keyOf: (r: T) => string; head: string; testId: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const tc = rows.reduce((a, r) => a + r.count, 0);
  const th = rows.reduce((a, r) => a + r.total_hpp, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid={testId}>
        <thead className="bg-[#F3EFEA] text-left text-xs uppercase text-muted-foreground">
          <tr><th className="w-8" /><th className="px-3 py-2">{head}</th><th className="px-3 py-2 text-right">Jml HPP</th><th className="px-3 py-2 text-right">Packaging</th>
            <th className="px-3 py-2 text-right">Total Net Cost</th><th className="px-3 py-2 text-right">Total HPP</th><th className="px-3 py-2 text-right">Rata-rata</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const k = keyOf(r);
            return (
              <Fragment key={k}>
                <tr className="cursor-pointer border-t transition-colors hover:bg-[#F9F7F4]" onClick={() => setOpen({ ...open, [k]: !open[k] })} data-testid={`${testId}-row-${k}`}>
                  <td className="pl-2 text-muted-foreground">{open[k] ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</td>
                  <td className="px-3 py-2 font-medium">{name(r)}</td>
                  <td className="num px-3 py-2 text-right">{r.count}</td>
                  <td className="num px-3 py-2 text-right">{r.packaging_count}</td>
                  <td className="num px-3 py-2 text-right">{rp(r.total_net)}</td>
                  <td className="num px-3 py-2 text-right font-semibold">{rp(r.total_hpp)}</td>
                  <td className="num px-3 py-2 text-right">{rp(r.count ? r.total_hpp / r.count : 0)}</td>
                </tr>
                {open[k] && <tr className="bg-[#FBF9F5]"><td /><td colSpan={6} className="px-3 py-2"><ItemsTable items={r.items} /></td></tr>}
              </Fragment>
            );
          })}
          <tr className="border-t-2 bg-[#FEF3C7] font-semibold text-[#78350F]">
            <td /><td className="px-3 py-2">TOTAL</td><td className="num px-3 py-2 text-right">{tc}</td>
            <td className="num px-3 py-2 text-right">{rows.reduce((a, r) => a + r.packaging_count, 0)}</td>
            <td className="num px-3 py-2 text-right">{rp(rows.reduce((a, r) => a + r.total_net, 0))}</td>
            <td className="num px-3 py-2 text-right" data-testid={`${testId}-grand-total`}>{rp(th)}</td>
            <td className="num px-3 py-2 text-right">{rp(tc ? th / tc : 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function Reports() {
  const [tab, setTab] = useState("buyer");
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("");
  const [buyer, setBuyer] = useState("all");
  const y = year === "all" ? "" : year;
  const b = buyer === "all" ? "" : buyer;
  const buyers = useQuery({ queryKey: ["buyers"], queryFn: () => apiGet<string[]>("/hpp/buyers") });
  const byBuyer = useQuery({ queryKey: ["reports", "buyer", y, month], queryFn: () => apiGet<BuyerReportRow[]>(`/reports/buyer?${new URLSearchParams({ year: y, month })}`) });
  const byMonth = useQuery({ queryKey: ["reports", "month", y, b], queryFn: () => apiGet<MonthReportRow[]>(`/reports/month?${new URLSearchParams({ year: y, buyer: b })}`) });
  const pdfHref = tab === "buyer"
    ? apiUrl(`/reports/pdf?${new URLSearchParams({ kind: "buyer", year: y, month })}`)
    : apiUrl(`/reports/pdf?${new URLSearchParams({ kind: "month", year: y, buyer: b })}`);
  const bRows = byBuyer.isError ? [] : byBuyer.data ?? [];
  const mRows = byMonth.isError ? [] : byMonth.data ?? [];

  return (
    <div>
      <PageHeader title="Laporan HPP" subtitle="Rekap HPP per buyer dan per bulan — tampil di layar, cetak, atau export PDF."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => window.print()} data-testid="report-print-button"><Printer className="size-4" /> Cetak</Button>
            <a href={pdfHref} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm" })} data-testid="report-export-pdf-button"><FileDown className="size-4" /> Export PDF</a>
          </>
        } />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="buyer" data-testid="report-tab-buyer">Per Buyer</TabsTrigger>
            <TabsTrigger value="month" data-testid="report-tab-month">Per Bulan</TabsTrigger>
          </TabsList>
          <SimpleSelect value={year} onChange={(v) => { setYear(v); setMonth(""); }} options={YEARS} testId="report-year-select" />
          {tab === "buyer" ? (
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" data-testid="report-month-filter" />
          ) : (
            <SimpleSelect value={buyer} onChange={setBuyer} testId="report-buyer-select"
              options={[{ value: "all", label: "Semua buyer" }, ...(buyers.data ?? []).map((x) => ({ value: x, label: x }))]} />
          )}
        </div>
        <TabsContent value="buyer" className="space-y-4">
          <Panel title={`Laporan per Buyer — ${month ? monthLabel(month) : y ? `Tahun ${y}` : "Semua periode"}`} testId="report-buyer-panel">
            {bRows.length ? (
              <>
                <div className="no-print mb-4 h-56">
                  <ResponsiveContainer>
                    <BarChart data={bRows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" vertical={false} />
                      <XAxis dataKey="buyer" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={56} />
                      <Tooltip formatter={(v: number) => rp(v)} />
                      <Bar dataKey="total_hpp" fill="#8C5824" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <SummaryTable rows={bRows} name={(r) => r.buyer} keyOf={(r) => r.buyer} head="Buyer" testId="report-buyer-table" />
              </>
            ) : <Empty text="Tidak ada data untuk periode ini." testId="report-buyer-empty" />}
          </Panel>
        </TabsContent>
        <TabsContent value="month" className="space-y-4">
          <Panel title={`Laporan per Bulan — ${y ? `Tahun ${y}` : "Semua periode"}${b ? ` · ${b}` : ""}`} testId="report-month-panel">
            {mRows.length ? (
              <>
                <div className="no-print mb-4 h-56">
                  <ResponsiveContainer>
                    <BarChart data={mRows.map((r) => ({ ...r, label: monthShort(r.month) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={56} />
                      <Tooltip formatter={(v: number) => rp(v)} />
                      <Bar dataKey="total_hpp" fill="#C47B2B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <SummaryTable rows={mRows} name={(r) => monthLabel(r.month)} keyOf={(r) => r.month} head="Bulan" testId="report-month-table" />
              </>
            ) : <Empty text="Tidak ada data untuk periode ini." testId="report-month-empty" />}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
