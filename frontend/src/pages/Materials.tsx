import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SimpleSelect from "@/components/SimpleSelect";
import { Empty, PageHeader, Panel } from "@/components/PageBits";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { can, useMe } from "@/lib/auth";
import { errMsg, rp } from "@/lib/format";
import type { CategoryCount, Material, MaterialIn, MaterialPage } from "@/lib/types";

const PAGE = 50;
const BLANK: MaterialIn = { category: "", item: "", size: "", price: 0, price2: null, price_raw: null, unit: "", note: "" };

function MaterialDialog({ initial, id, onClose, categories }: { initial: MaterialIn; id: string | null; onClose: () => void; categories: string[] }) {
  const qc = useQueryClient();
  const [m, setM] = useState<MaterialIn>(initial);
  const save = useMutation({
    mutationFn: () => (id ? apiPut<Material>(`/materials/${id}`, m) : apiPost<Material>("/materials", m)),
    onSuccess: () => { toast.success("Material tersimpan"); qc.invalidateQueries({ queryKey: ["materials"] }); onClose(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const txt = (k: "category" | "item" | "size" | "unit" | "note", label: string) => (
    <div className="space-y-1"><Label className="text-xs">{label}</Label>
      <Input value={m[k]} onChange={(e) => setM({ ...m, [k]: e.target.value })} list={k === "category" ? "cat-list" : undefined} data-testid={`material-input-${k}`} /></div>
  );
  const numf = (k: "price" | "price2" | "price_raw", label: string) => (
    <div className="space-y-1"><Label className="text-xs">{label}</Label>
      <Input type="number" step="any" className="num" value={m[k] ?? ""} data-testid={`material-input-${k}`}
        onChange={(e) => setM({ ...m, [k]: e.target.value === "" ? (k === "price" ? 0 : null) : Number(e.target.value) })} /></div>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="material-dialog">
        <DialogHeader><DialogTitle>{id ? "Edit material" : "Tambah material"}</DialogTitle></DialogHeader>
        <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <div className="grid grid-cols-2 gap-3">
          {txt("category", "Kategori *")}{txt("item", "Item *")}{txt("size", "Size")}{txt("unit", "Unit")}
          {numf("price", "Price (dipakai HPP)")}{numf("price2", "Price 2")}{numf("price_raw", "Price raw")}{txt("note", "Keterangan")}
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="material-save-button">Simpan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Materials() {
  const { data: me } = useMe();
  const editable = can(me, "material:write");
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<{ id: string | null; m: MaterialIn } | null>(null);
  const cats = useQuery({ queryKey: ["materials", "categories"], queryFn: () => apiGet<CategoryCount[]>("/materials/categories") });
  const params = new URLSearchParams({ q, category: cat === "all" ? "" : cat, skip: String(page * PAGE), limit: String(PAGE) });
  const { data, isError } = useQuery({ queryKey: ["materials", q, cat, page], queryFn: () => apiGet<MaterialPage>(`/materials?${params}`) });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/materials/${id}`),
    onSuccess: () => { toast.success("Material dihapus"); qc.invalidateQueries({ queryKey: ["materials"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div>
      <PageHeader title="Database Material HPP" subtitle="Daftar harga material raw, supplies, finishing, packing, cushion, upah kerja & out sourcing (sheet DATA BASE HPP)."
        actions={editable && <Button size="sm" onClick={() => setEdit({ id: null, m: BLANK })} data-testid="material-add-button"><Plus className="size-4" /> Tambah Material</Button>} />
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Cari item, ukuran, keterangan..." className="pl-9" data-testid="material-search-input" />
          </div>
          <SimpleSelect value={cat} onChange={(v) => { setCat(v); setPage(0); }} testId="material-category-filter"
            options={[{ value: "all", label: "Semua kategori" }, ...(cats.data ?? []).map((c) => ({ value: c.category, label: `${c.category} (${c.count})` }))]} />
        </div>
        {isError || !data || data.items.length === 0 ? <Empty text={isError ? "Data tidak dapat dimuat." : "Tidak ada material."} testId="material-empty" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="material-table">
              <thead className="bg-[#F3EFEA] text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Size</th><th className="px-3 py-2">Kategori</th><th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Price 2</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Keterangan</th>{editable && <th className="w-20" />}</tr>
              </thead>
              <tbody>
                {data.items.map((m) => (
                  <tr key={m.id} className="border-t transition-colors hover:bg-[#F9F7F4]" data-testid={`material-row-${m.id}`}>
                    <td className="px-3 py-2 font-medium">{m.item}</td>
                    <td className="px-3 py-2 text-muted-foreground">{m.size}</td>
                    <td className="px-3 py-2"><Badge className="bg-[#F3E8DB] text-[#78350F]">{m.category}</Badge></td>
                    <td className="num px-3 py-2 text-right">{rp(m.price)}</td>
                    <td className="num px-3 py-2 text-right text-muted-foreground">{m.price2 != null ? rp(m.price2) : "—"}</td>
                    <td className="px-3 py-2">{m.unit}</td>
                    <td className="max-w-56 truncate px-3 py-2 text-xs text-muted-foreground" title={m.note}>{m.note}</td>
                    {editable && (
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <Button size="icon-xs" variant="ghost" onClick={() => setEdit({ id: m.id, m })} data-testid={`material-edit-${m.id}`}><Pencil className="size-3.5" /></Button>
                        <Button size="icon-xs" variant="ghost" onClick={() => { if (confirm(`Hapus ${m.item}?`)) del.mutate(m.id); }} data-testid={`material-delete-${m.id}`}><Trash2 className="size-3.5 text-destructive" /></Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground" data-testid="material-total">{total} item</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)} data-testid="material-prev-page">Sebelumnya</Button>
            <span className="num text-xs">{page + 1} / {pages}</span>
            <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} data-testid="material-next-page">Berikutnya</Button>
          </div>
        </div>
      </Panel>
      {edit && <MaterialDialog key={edit.id ?? "new"} initial={edit.m} id={edit.id} onClose={() => setEdit(null)} categories={(cats.data ?? []).map((c) => c.category)} />}
    </div>
  );
}
