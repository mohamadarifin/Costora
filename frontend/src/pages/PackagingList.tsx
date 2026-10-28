import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Link2, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, PageHeader, Panel } from "@/components/PageBits";
import { ApprovalBadge } from "@/components/ApprovalPanel";
import { apiGet, apiUrl } from "@/lib/api";
import { can, useMe } from "@/lib/auth";
import type { Packaging } from "@/lib/types";

export default function PackagingList() {
  const { data: me } = useMe();
  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");
  const { data = [], isError, isLoading } = useQuery({
    queryKey: ["packaging", q, month],
    queryFn: () => apiGet<Packaging[]>(`/packaging?${new URLSearchParams({ q, month })}`),
  });
  return (
    <div>
      <PageHeader title="Packaging Form" subtitle="Form packaging R&D per buyer — terhubung dengan lembar HPP dan lampiran scan dari buyer."
        actions={can(me, "packaging:write") && <Link to="/packaging/new" className={buttonVariants({ size: "sm" })} data-testid="packaging-new-button"><Plus className="size-4" /> Packaging Form Baru</Link>} />
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari buyer, item, PO..." className="pl-9" data-testid="packaging-search-input" />
          </div>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" data-testid="packaging-month-filter" />
        </div>
        {isLoading ? <p className="text-sm text-muted-foreground">Memuat...</p> : isError || data.length === 0 ? <Empty text="Belum ada packaging form." testId="packaging-empty" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="packaging-table">
              <thead className="bg-[#E7F3EC] text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-3 py-2">Buyer</th><th className="px-3 py-2">Item</th><th className="px-3 py-2">Color</th><th className="px-3 py-2">No. PO</th>
                  <th className="px-3 py-2">Date / ETD</th><th className="px-3 py-2">Approval</th><th className="px-3 py-2">HPP</th><th className="px-3 py-2" /></tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className="border-t transition-colors hover:bg-[#F0F7F3]" data-testid={`packaging-row-${p.id}`}>
                    <td className="px-3 py-2.5"><Link to={`/packaging/${p.id}`} className="font-medium hover:text-primary hover:underline" data-testid={`packaging-open-${p.id}`}>{p.buyer}</Link>
                      {p.source !== "manual" && <Badge variant="outline" className="ml-2 text-[10px]">{p.source}</Badge>}</td>
                    <td className="px-3 py-2.5">{p.item_name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.color}</td>
                    <td className="px-3 py-2.5">{p.po_no}</td>
                    <td className="num px-3 py-2.5 text-xs">{p.date}{p.etd ? ` / ${p.etd}` : ""}</td>
                    <td className="px-3 py-2.5"><ApprovalBadge status={p.approval_status} testId={`packaging-approval-${p.id}`} /></td>
                    <td className="px-3 py-2.5">{p.hpp_id ? <Link to={`/hpp/${p.hpp_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline" data-testid={`packaging-hpp-link-${p.id}`}><Link2 className="size-3" /> HPP</Link> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5 text-right"><a href={apiUrl(`/packaging/${p.id}/pdf`)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "xs" })} data-testid={`packaging-pdf-${p.id}`}><FileDown className="size-3.5" /> PDF</a></td>
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
