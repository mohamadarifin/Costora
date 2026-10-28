import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SimpleSelect from "@/components/SimpleSelect";
import { Empty, PageHeader, Panel } from "@/components/PageBits";
import { apiGet, apiUrl } from "@/lib/api";
import { can, useMe } from "@/lib/auth";
import { rp } from "@/lib/format";
import type { HppSummary } from "@/lib/types";

export default function HppList() {
  const { data: me } = useMe();
  const [q, setQ] = useState("");
  const [buyer, setBuyer] = useState("all");
  const [month, setMonth] = useState("");
  const buyers = useQuery({ queryKey: ["buyers"], queryFn: () => apiGet<string[]>("/hpp/buyers") });
  const params = new URLSearchParams({ q, buyer: buyer === "all" ? "" : buyer, month });
  const { data = [], isError, isLoading } = useQuery({ queryKey: ["hpp", q, buyer, month], queryFn: () => apiGet<HppSummary[]>(`/hpp?${params}`) });

  return (
    <div>
      <PageHeader title="Perhitungan HPP" subtitle="Lembar kalkulasi HPP per item (format Rattan Bench 1): material, finishing, packing, upah kerja, out sourcing."
        actions={can(me, "hpp:write") && <Link to="/hpp/new" className={buttonVariants({ size: "sm" })} data-testid="hpp-new-button"><Plus className="size-4" /> HPP Baru</Link>} />
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari code item, buyer, colour..." className="pl-9" data-testid="hpp-search-input" />
          </div>
          <SimpleSelect value={buyer} onChange={setBuyer} testId="hpp-buyer-filter"
            options={[{ value: "all", label: "Semua buyer" }, ...(buyers.data ?? []).map((b) => ({ value: b, label: b }))]} />
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" data-testid="hpp-month-filter" />
        </div>
        {isLoading ? <p className="text-sm text-muted-foreground">Memuat...</p> : isError || data.length === 0 ? <Empty text="Belum ada data HPP." testId="hpp-empty" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="hpp-table">
              <thead className="bg-[#F3EFEA] text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Code Item</th><th className="px-3 py-2">Buyer</th><th className="px-3 py-2">Colour / Type</th>
                  <th className="px-3 py-2">Tanggal</th><th className="px-3 py-2 text-right">Net Cost</th><th className="px-3 py-2 text-right">HPP Total</th><th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.map((h) => (
                  <tr key={h.id} className="border-t transition-colors hover:bg-[#F9F7F4]" data-testid={`hpp-row-${h.id}`}>
                    <td className="px-3 py-2.5">
                      <Link to={`/hpp/${h.id}`} className="font-medium text-foreground hover:text-primary hover:underline" data-testid={`hpp-open-${h.id}`}>{h.code_item}</Link>
                      {h.source !== "manual" && <Badge variant="outline" className="ml-2 text-[10px]">{h.source}</Badge>}
                    </td>
                    <td className="px-3 py-2.5">{h.buyer}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{[h.colour, h.type].filter(Boolean).join(" · ")}</td>
                    <td className="num px-3 py-2.5 text-xs">{h.date}</td>
                    <td className="num px-3 py-2.5 text-right">{rp(h.totals.net_cost)}</td>
                    <td className="num px-3 py-2.5 text-right font-semibold">{rp(h.totals.hpp_total)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <a href={apiUrl(`/hpp/${h.id}/pdf`)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "xs" })} data-testid={`hpp-pdf-${h.id}`}><FileDown className="size-3.5" /> PDF</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
