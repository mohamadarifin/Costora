import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet } from "@/lib/api";
import { rp } from "@/lib/format";
import type { LaborGroup, MaterialPage } from "@/lib/types";

export interface Picked { item: string; unit: string; price: number; material_id: string | null; labor_ref: string | null }

export default function ItemPicker({ open, onOpenChange, onPick, laborYear, defaultTab }: {
  open: boolean; onOpenChange: (o: boolean) => void; onPick: (p: Picked) => void; laborYear: number; defaultTab: "material" | "labor";
}) {
  const [q, setQ] = useState("");
  const mats = useQuery({
    queryKey: ["materials", "picker", q],
    queryFn: () => apiGet<MaterialPage>(`/materials?limit=60&q=${encodeURIComponent(q)}`),
    enabled: open,
  });
  const labor = useQuery({ queryKey: ["labor"], queryFn: () => apiGet<LaborGroup[]>("/labor"), enabled: open });
  const y = String(laborYear);
  const ql = q.toLowerCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-3xl" data-testid="item-picker-dialog">
        <DialogHeader><DialogTitle>Pilih item dari database</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari item, ukuran, kategori..." className="pl-9" data-testid="item-picker-search" autoFocus />
        </div>
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="material" data-testid="item-picker-tab-material">Database Material</TabsTrigger>
            <TabsTrigger value="labor" data-testid="item-picker-tab-labor">Upah Tenaga Kerja {y}</TabsTrigger>
          </TabsList>
          <TabsContent value="material">
            <div className="max-h-[52vh] overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#F3EFEA] text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Size</th><th className="px-3 py-2">Kategori</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2 text-right">Price</th></tr>
                </thead>
                <tbody>
                  {(mats.data?.items ?? []).map((m) => (
                    <tr key={m.id} className="cursor-pointer border-t transition-colors hover:bg-[#F5EFE6]" data-testid={`item-picker-material-${m.id}`}
                      onClick={() => onPick({ item: m.item.trim() + (m.size ? ` ${m.size}` : ""), unit: m.unit, price: m.price, material_id: m.id, labor_ref: null })}>
                      <td className="px-3 py-1.5 font-medium">{m.item}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{m.size}</td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">{m.category}</td>
                      <td className="px-3 py-1.5">{m.unit}</td>
                      <td className="num px-3 py-1.5 text-right">{rp(m.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mats.data && mats.data.items.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Tidak ditemukan</p>}
            </div>
          </TabsContent>
          <TabsContent value="labor">
            <div className="max-h-[52vh] overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#F3EFEA] text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2">Pekerjaan</th><th className="px-3 py-2">Satuan</th><th className="px-3 py-2 text-right">Tarif {y}</th></tr>
                </thead>
                <tbody>
                  {(labor.data ?? []).flatMap((g) => g.items.map((it) => ({ g, it }))).filter(({ g, it }) =>
                    !ql || `${g.name} ${it.label} ${it.unit}`.toLowerCase().includes(ql)).map(({ g, it }) => {
                    const label = it.label === g.name ? g.name : `${g.name} — ${it.label}`;
                    const price = it.rates[y] ?? 0;
                    return (
                      <tr key={it.id} className="cursor-pointer border-t transition-colors hover:bg-[#F5EFE6]" data-testid={`item-picker-labor-${it.id}`}
                        onClick={() => onPick({ item: label, unit: it.unit, price, material_id: null, labor_ref: it.id })}>
                        <td className="px-3 py-1.5 font-medium">{label}</td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">{it.unit}</td>
                        <td className="num px-3 py-1.5 text-right">{it.rates[y] == null ? "—" : rp(price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
