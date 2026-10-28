import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, PageHeader, Panel } from "@/components/PageBits";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { can, useMe } from "@/lib/auth";
import { errMsg, fnum } from "@/lib/format";
import type { LaborGroup, LaborGroupIn } from "@/lib/types";

const pctTxt = (v: number | undefined) => (v ? `${fnum(v * 100, 2)}%` : "0%");

function GroupDialog({ group, years, onClose }: { group: LaborGroup | null; years: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [g, setG] = useState<LaborGroupIn>(group ? { name: group.name, increases: { ...group.increases }, items: group.items.map((i) => ({ ...i, rates: { ...i.rates } })) }
    : { name: "", increases: Object.fromEntries(years.map((y) => [y, 0])), items: [] });
  const save = useMutation({
    mutationFn: () => (group ? apiPut<LaborGroup>(`/labor/${group.id}`, g) : apiPost<LaborGroup>("/labor", g)),
    onSuccess: () => { toast.success("Upah tenaga kerja tersimpan"); qc.invalidateQueries({ queryKey: ["labor"] }); onClose(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const recalc = (y: string) => {
    const prev = String(Number(y) - 1);
    const inc = g.increases[y] ?? 0;
    setG({ ...g, items: g.items.map((it) => (it.rates[prev] != null ? { ...it, rates: { ...it.rates, [y]: Math.round((it.rates[prev] as number) * (1 + inc) * 100) / 100 } } : it)) });
    toast.message(`Tarif ${y} = tarif ${prev} × (1 + ${pctTxt(inc)})`);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[min(1200px,95vw)]" data-testid="labor-dialog">
        <DialogHeader><DialogTitle>{group ? `Edit: ${group.name}` : "Tambah kelompok upah"}</DialogTitle></DialogHeader>
        <Input value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} placeholder="Nama pekerjaan (mis. Weaving Peel)" data-testid="labor-input-name" />
        <div className="overflow-x-auto rounded-md border">
          <table className="text-xs">
            <thead className="bg-[#F3EFEA]">
              <tr>
                <th className="sticky left-0 min-w-52 bg-[#F3EFEA] px-2 py-2 text-left">Item / Satuan</th>
                {years.map((y) => (
                  <th key={y} className="min-w-24 px-1 py-2">
                    <div className="flex items-center justify-center gap-1">{y}
                      <button type="button" title={`Hitung ${y} dari ${Number(y) - 1}`} onClick={() => recalc(y)} className="rounded p-0.5 text-[#8C5824] transition-colors hover:bg-[#FEF3C7]" data-testid={`labor-recalc-${y}`}><RefreshCw className="size-3" /></button>
                    </div>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              <tr className="border-t bg-[#FEF3C7]/40">
                <td className="sticky left-0 bg-[#FFFBEB] px-2 py-1 font-semibold">KENAIKAN %</td>
                {years.map((y) => (
                  <td key={y} className="px-1 py-1">
                    <Input type="number" step="any" className="num h-7 text-right text-xs" value={Math.round((g.increases[y] ?? 0) * 10000) / 100} data-testid={`labor-inc-${y}`}
                      onChange={(e) => setG({ ...g, increases: { ...g.increases, [y]: Number(e.target.value) / 100 } })} />
                  </td>
                ))}
                <td />
              </tr>
              {g.items.map((it, idx) => (
                <tr key={it.id} className="border-t">
                  <td className="sticky left-0 space-y-1 bg-card px-2 py-1">
                    <Input className="h-7 text-xs" value={it.label} onChange={(e) => setG({ ...g, items: g.items.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)) })} data-testid={`labor-item-label-${idx}`} />
                    <Input className="h-7 text-xs" placeholder="Satuan" value={it.unit} onChange={(e) => setG({ ...g, items: g.items.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x)) })} data-testid={`labor-item-unit-${idx}`} />
                  </td>
                  {years.map((y) => (
                    <td key={y} className="px-1 py-1">
                      <Input type="number" step="any" className="num h-7 text-right text-xs" value={it.rates[y] ?? ""} data-testid={`labor-rate-${idx}-${y}`}
                        onChange={(e) => setG({ ...g, items: g.items.map((x, i) => (i === idx ? { ...x, rates: { ...x.rates, [y]: e.target.value === "" ? null : Number(e.target.value) } } : x)) })} />
                    </td>
                  ))}
                  <td className="px-1"><Button size="icon-xs" variant="ghost" onClick={() => setG({ ...g, items: g.items.filter((_, i) => i !== idx) })} data-testid={`labor-item-delete-${idx}`}><Trash2 className="size-3.5 text-destructive" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" size="sm" onClick={() => setG({ ...g, items: [...g.items, { id: crypto.randomUUID(), label: g.name || "Item", unit: "", rates: {} }] })} data-testid="labor-add-item-button"><Plus className="size-4" /> Tambah baris</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !g.name.trim()} data-testid="labor-save-button">Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Labor() {
  const { data: me } = useMe();
  const editable = can(me, "labor:write");
  const qc = useQueryClient();
  const [edit, setEdit] = useState<LaborGroup | null | "new">(null);
  const [newYear, setNewYear] = useState("");
  const { data = [], isError } = useQuery({ queryKey: ["labor"], queryFn: () => apiGet<LaborGroup[]>("/labor") });
  const years = useMemo(() => [...new Set(data.flatMap((g) => Object.keys(g.increases)))].sort(), [data]);
  const addYear = useMutation({
    mutationFn: (y: number) => apiPost<LaborGroup[]>("/labor/years", { year: y }),
    onSuccess: () => { toast.success("Kolom tahun ditambahkan"); setNewYear(""); qc.invalidateQueries({ queryKey: ["labor"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/labor/${id}`),
    onSuccess: () => { toast.success("Kelompok dihapus"); qc.invalidateQueries({ queryKey: ["labor"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const last = years[years.length - 1];

  return (
    <div>
      <PageHeader title="Upah Tenaga Kerja % per Tahun" subtitle="Tarif upah per pekerjaan dan persentase kenaikan tahunan (sheet TENAGA KERJA % PER TAHUN). Dipakai otomatis pada bagian Upah Kerja di lembar HPP."
        actions={editable && (
          <>
            <Input value={newYear} onChange={(e) => setNewYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={last ? String(Number(last) + 1) : "2027"} className="h-8 w-24" data-testid="labor-new-year-input" />
            <Button size="sm" variant="outline" onClick={() => addYear.mutate(Number(newYear || Number(last) + 1))} disabled={addYear.isPending} data-testid="labor-add-year-button"><CalendarPlus className="size-4" /> Tambah tahun</Button>
            <Button size="sm" onClick={() => setEdit("new")} data-testid="labor-add-group-button"><Plus className="size-4" /> Kelompok baru</Button>
          </>
        )} />
      <Panel testId="labor-matrix">
        {isError || data.length === 0 ? <Empty text="Belum ada data upah." testId="labor-empty" /> : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-xs" data-testid="labor-table">
              <thead className="sticky top-0 z-10 bg-[#F3EFEA] text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-10 min-w-64 bg-[#F3EFEA] px-3 py-2 text-left">No · Wages</th>
                  {years.map((y) => <th key={y} className="px-2 py-2 text-right">{y}</th>)}
                  <th className="min-w-44 px-3 py-2 text-left">Unit</th>
                </tr>
              </thead>
              <tbody>
                {data.map((g) => (
                  <Fragment key={g.id}>
                    <tr className="border-t-2 border-[#E6E2DB] bg-[#FFFBEB]" data-testid={`labor-group-${g.id}`}>
                      <td className="sticky left-0 bg-[#FFFBEB] px-3 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span><span className="num mr-2 text-muted-foreground">{g.no}</span><span className="font-semibold text-foreground">{g.name}</span> <span className="text-[10px] text-[#92400E]">kenaikan %</span></span>
                          {editable && (
                            <span className="flex">
                              <Button size="icon-xs" variant="ghost" onClick={() => setEdit(g)} data-testid={`labor-edit-${g.id}`}><Pencil className="size-3.5" /></Button>
                              <Button size="icon-xs" variant="ghost" onClick={() => { if (confirm(`Hapus ${g.name}?`)) del.mutate(g.id); }} data-testid={`labor-delete-${g.id}`}><Trash2 className="size-3.5 text-destructive" /></Button>
                            </span>
                          )}
                        </div>
                      </td>
                      {years.map((y) => <td key={y} className="num px-2 py-1.5 text-right text-[#92400E]">{pctTxt(g.increases[y])}</td>)}
                      <td />
                    </tr>
                    {g.items.map((it) => (
                      <tr key={it.id} className="border-t transition-colors hover:bg-[#F9F7F4]">
                        <td className="sticky left-0 bg-card px-3 py-1.5 pl-8">{it.label}</td>
                        {years.map((y) => <td key={y} className="num px-2 py-1.5 text-right">{it.rates[y] == null ? "—" : fnum(it.rates[y], 0)}</td>)}
                        <td className="px-3 py-1.5 text-muted-foreground">{it.unit}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {edit && <GroupDialog key={edit === "new" ? "new" : edit.id} group={edit === "new" ? null : edit} years={years} onClose={() => setEdit(null)} />}
    </div>
  );
}
