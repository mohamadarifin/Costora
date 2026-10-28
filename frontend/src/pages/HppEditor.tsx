import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Database, FileDown, PackagePlus, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import SimpleSelect from "@/components/SimpleSelect";
import ItemPicker, { type Picked } from "@/components/ItemPicker";
import AttachmentPanel from "@/components/AttachmentPanel";
import ApprovalPanel from "@/components/ApprovalPanel";
import { Empty, PageHeader, Panel } from "@/components/PageBits";
import { apiDelete, apiGet, apiPost, apiPut, apiUrl } from "@/lib/api";
import { can, useMe } from "@/lib/auth";
import { HPP_SLOTS, SECTIONS, errMsg, fnum, rp } from "@/lib/format";
import type { Hpp, HppIn, HppLine, LaborGroup, Packaging, SectionKey } from "@/lib/types";

const uid = () => crypto.randomUUID();
const todayLocal = () => new Date().toISOString().slice(0, 10);

function lineTotal(l: HppLine) {
  if (l.mode === "div") return l.volume ? l.price / l.volume : 0;
  return l.volume * l.price;
}

function computeTotals(lines: HppLine[], markup: number) {
  const sections: Record<string, number> = Object.fromEntries(SECTIONS.map((s) => [s.key, 0]));
  lines.forEach((l) => { sections[l.section] += lineTotal(l); });
  const net = Object.values(sections).reduce((a, b) => a + b, 0);
  const rounding = Math.ceil(Math.round(net * 10000) / 10000 / 1000) * 1000;
  return { sections, net, rounding, ongkos: (net - sections.upah_kerja) * markup + rounding, hpp: rounding * (1 + markup) };
}

const EMPTY: HppIn = { code_item: "", colour: "", buyer: "", type: "", date: todayLocal(), tw: 0, td: 0, th: 0, labor_year: new Date().getFullYear(), markup: 0.32, notes: "", lines: [], approvals: {} };

function NumInput({ value, onChange, testId, disabled, className = "" }: { value: number; onChange: (v: number) => void; testId: string; disabled?: boolean; className?: string }) {
  const [txt, setTxt] = useState(String(value ?? 0));
  const [focus, setFocus] = useState(false);
  return (
    <Input type="text" inputMode="decimal" disabled={disabled} data-testid={testId}
      className={`num h-8 text-right ${className}`}
      value={focus ? txt : String(value ?? 0)}
      onFocus={() => { setTxt(String(value ?? 0)); setFocus(true); }}
      onBlur={() => setFocus(false)}
      onChange={(e) => { setTxt(e.target.value); const n = Number(e.target.value.replace(",", ".")); if (!Number.isNaN(n)) onChange(n); }} />
  );
}

function HppForm({ initial, id, live }: { initial: HppIn; id: string | null; live?: Hpp }) {
  const { data: me } = useMe();
  const editable = can(me, "hpp:write");
  const nav = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<HppIn>(initial);
  const [picker, setPicker] = useState<SectionKey | null>(null);
  const labor = useQuery({ queryKey: ["labor"], queryFn: () => apiGet<LaborGroup[]>("/labor") });
  const packs = useQuery({ queryKey: ["packaging", "byHpp", id], queryFn: () => apiGet<Packaging[]>(`/packaging?hpp_id=${id}`), enabled: !!id });
  const years = useMemo(() => {
    const s = new Set<string>();
    (labor.data ?? []).forEach((g) => Object.keys(g.increases).forEach((y) => s.add(y)));
    if (!s.size) s.add(String(form.labor_year));
    return [...s].sort();
  }, [labor.data, form.labor_year]);
  const t = computeTotals(form.lines, form.markup);
  const set = <K extends keyof HppIn>(k: K, v: HppIn[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setLine = (lid: string, patch: Partial<HppLine>) => setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.id === lid ? { ...l, ...patch } : l)) }));
  const addLine = (section: SectionKey, p?: Picked) => setForm((f) => ({
    ...f,
    lines: [...f.lines, { id: uid(), section, spec: "", item: p?.item ?? "", material_id: p?.material_id ?? null, labor_ref: p?.labor_ref ?? null, volume: 1, unit: p?.unit ?? "", price: p?.price ?? 0, mode: "mul", total: 0 }],
  }));

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, lines: form.lines.filter((l) => l.item.trim()) };
      return id ? apiPut<Hpp>(`/hpp/${id}`, body) : apiPost<Hpp>("/hpp", body);
    },
    onSuccess: (h) => {
      toast.success("HPP tersimpan");
      qc.invalidateQueries({ queryKey: ["hpp"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["buyers"] });
      if (!id) nav(`/hpp/${h.id}`, { replace: true });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: () => apiDelete(`/hpp/${id}`),
    onSuccess: () => { toast.success("HPP dihapus"); qc.invalidateQueries({ queryKey: ["hpp"] }); nav("/hpp"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const dup = useMutation({
    mutationFn: () => apiPost<Hpp>(`/hpp/${id}/duplicate`),
    onSuccess: (h) => { toast.success("HPP diduplikasi"); qc.invalidateQueries({ queryKey: ["hpp"] }); nav(`/hpp/${h.id}`); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const mkPack = useMutation({
    mutationFn: () => apiPost<Packaging>(`/packaging/from-hpp/${id}`),
    onSuccess: (p) => { toast.success("Packaging form dibuat"); qc.invalidateQueries({ queryKey: ["packaging"] }); nav(`/packaging/${p.id}`); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const pct = Math.round(form.markup * 100);

  return (
    <div className="pb-28">
      <PageHeader
        title={id ? form.code_item || "HPP" : "HPP Baru"}
        subtitle="Perhitungan Harga Pokok Produksi — mengacu sheet Rattan Bench 1."
        actions={
          <>
            <Link to="/hpp" className={buttonVariants({ variant: "ghost", size: "sm" })} data-testid="hpp-back-link"><ArrowLeft className="size-4" /> Kembali</Link>
            {id && <a href={apiUrl(`/hpp/${id}/pdf`)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })} data-testid="hpp-export-pdf-button"><FileDown className="size-4" /> Cetak / PDF</a>}
            {id && editable && <Button variant="outline" size="sm" onClick={() => dup.mutate()} data-testid="hpp-duplicate-button"><Copy className="size-4" /> Duplikat</Button>}
            {id && editable && <Button variant="outline" size="sm" className="text-destructive" onClick={() => { if (confirm("Hapus HPP ini?")) del.mutate(); }} data-testid="hpp-delete-button"><Trash2 className="size-4" /> Hapus</Button>}
          </>
        }
      />

      <Panel title="Data Item" testId="hpp-meta-panel">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {([["code_item", "Code Item *"], ["buyer", "Buyer *"], ["colour", "Colour"], ["type", "Type"]] as const).map(([k, l]) => (
            <div key={k} className={`space-y-1 ${k === "code_item" ? "col-span-2" : ""}`}>
              <Label className="text-xs">{l}</Label>
              <Input value={form[k]} onChange={(e) => set(k, e.target.value)} disabled={!editable} data-testid={`hpp-input-${k}`} />
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs">Tanggal</Label>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} disabled={!editable} data-testid="hpp-input-date" />
          </div>
          {(["tw", "td", "th"] as const).map((k) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs">{k.toUpperCase()} (meter)</Label>
              <NumInput value={form[k]} onChange={(v) => set(k, v)} disabled={!editable} testId={`hpp-input-${k}`} className="h-9" />
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs">Tahun upah kerja</Label>
            <SimpleSelect value={String(form.labor_year)} onChange={(v) => set("labor_year", Number(v))} disabled={!editable}
              options={years.map((y) => ({ value: y, label: y }))} testId="hpp-labor-year-select" className="w-full" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Markup HPP (%)</Label>
            <NumInput value={pct} onChange={(v) => set("markup", v / 100)} disabled={!editable} testId="hpp-input-markup" className="h-9" />
          </div>
          <div className="col-span-2 space-y-1 md:col-span-3 lg:col-span-6">
            <Label className="text-xs">Catatan</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} disabled={!editable} data-testid="hpp-input-notes" />
          </div>
        </div>
      </Panel>

      <div className="mt-4 space-y-4">
        {SECTIONS.map((s) => {
          const lines = form.lines.filter((l) => l.section === s.key);
          return (
            <Panel key={s.key} testId={`hpp-section-${s.key}`}
              title={<span className="flex items-center gap-3">Total Price {s.label}<span className="num rounded bg-[#D1FAE5] px-2 py-0.5 text-[13px] font-medium text-[#064E3B]" data-testid={`hpp-section-total-${s.key}`}>{rp(t.sections[s.key])}</span></span>}
              action={editable && (
                <div className="flex gap-2">
                  <Button size="xs" variant="outline" onClick={() => setPicker(s.key)} data-testid={`hpp-add-from-db-${s.key}`}><Database className="size-3.5" /> Dari database</Button>
                  <Button size="xs" variant="ghost" onClick={() => addLine(s.key)} data-testid={`hpp-add-manual-${s.key}`}><Plus className="size-3.5" /> Baris manual</Button>
                </div>
              )}>
              {lines.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada baris.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="text-left text-[11px] uppercase text-muted-foreground">
                      <tr><th className="w-36 pb-1.5">Specification</th><th className="pb-1.5">Item</th><th className="w-24 pb-1.5 text-right">Volume</th><th className="w-24 pb-1.5">Unit</th>
                        <th className="w-32 pb-1.5 text-right">Price / Unit</th><th className="w-20 pb-1.5">Rumus</th><th className="w-32 pb-1.5 text-right">Total</th><th className="w-8" /></tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.id} className="border-t" data-testid={`hpp-line-${l.id}`}>
                          <td className="py-1 pr-2"><Input className="h-8" value={l.spec} onChange={(e) => setLine(l.id, { spec: e.target.value })} disabled={!editable} data-testid={`hpp-line-spec-${l.id}`} /></td>
                          <td className="py-1 pr-2"><Input className="h-8" value={l.item} onChange={(e) => setLine(l.id, { item: e.target.value })} disabled={!editable} data-testid={`hpp-line-item-${l.id}`} /></td>
                          <td className="py-1 pr-2"><NumInput value={l.volume} onChange={(v) => setLine(l.id, { volume: v })} disabled={!editable} testId={`hpp-line-volume-${l.id}`} /></td>
                          <td className="py-1 pr-2"><Input className="h-8" value={l.unit} onChange={(e) => setLine(l.id, { unit: e.target.value })} disabled={!editable} data-testid={`hpp-line-unit-${l.id}`} /></td>
                          <td className="py-1 pr-2"><NumInput value={l.price} onChange={(v) => setLine(l.id, { price: v })} disabled={!editable} testId={`hpp-line-price-${l.id}`} /></td>
                          <td className="py-1 pr-2">
                            <SimpleSelect value={l.mode} onChange={(v) => setLine(l.id, { mode: v as "mul" | "div" })} disabled={!editable} className="h-8 min-w-0"
                              options={[{ value: "mul", label: "Vol × Harga" }, { value: "div", label: "Harga ÷ Vol" }]} testId={`hpp-line-mode-${l.id}`} />
                          </td>
                          <td className="num py-1 pr-2 text-right font-medium" data-testid={`hpp-line-total-${l.id}`}>{rp(lineTotal(l))}</td>
                          <td className="py-1">{editable && <Button size="icon-xs" variant="ghost" onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((x) => x.id !== l.id) }))} data-testid={`hpp-line-delete-${l.id}`}><Trash2 className="size-3.5 text-destructive" /></Button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          );
        })}
      </div>

      <div className="mt-4">
        <ApprovalPanel slots={HPP_SLOTS} value={form.approvals ?? {}} onChange={(v) => set("approvals", v)} disabled={!editable} testPrefix="hpp"
          kind="hpp" docId={id} saved={live?.approvals ?? {}} signed={live?.approval_signed ?? {}} />
      </div>

      {id && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Packaging Form terkait" testId="hpp-linked-packaging"
            action={can(me, "packaging:write") && <Button size="sm" variant="outline" onClick={() => mkPack.mutate()} data-testid="hpp-create-packaging-button"><PackagePlus className="size-4" /> Buat Packaging Form</Button>}>
            {packs.data && packs.data.length ? (
              <ul className="space-y-2">
                {packs.data.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <Link to={`/packaging/${p.id}`} className="font-medium hover:underline" data-testid={`hpp-linked-packaging-${p.id}`}>{p.item_name || "Packaging"} — {p.buyer}</Link>
                    <span className="num text-xs text-muted-foreground">{p.date}</span>
                  </li>
                ))}
              </ul>
            ) : <Empty text="Belum ada packaging form untuk HPP ini." />}
          </Panel>
          <AttachmentPanel ownerType="hpp" ownerId={id} canWrite={can(me, "attachment:write")} title="Lampiran HPP (file buyer, foto, scan)" />
        </div>
      )}

      <ItemPicker open={picker !== null} onOpenChange={(o) => !o && setPicker(null)} laborYear={form.labor_year}
        defaultTab={picker === "upah_kerja" ? "labor" : "material"}
        onPick={(p) => { if (picker) addLine(picker, p); setPicker(null); toast.success(`${p.item} ditambahkan`); }} />

      <div className="no-print fixed right-0 bottom-0 left-0 z-20 border-t bg-gradient-to-r from-[#022C22]/95 to-[#064E3B]/95 text-white backdrop-blur md:left-60" data-testid="hpp-summary-bar">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 md:px-6">
          {[["Total Net Cost", t.net, "net"], ["Rounding", t.rounding, "rounding"], [`Ongkos Bahan + ${pct}%`, t.ongkos, "ongkos"]].map(([l, v, k]) => (
            <div key={k as string}>
              <p className="text-[10px] uppercase tracking-wider text-[#A8A29E]">{l}</p>
              <p className="num text-sm" data-testid={`hpp-summary-${k}`}>{rp(v as number)}</p>
            </div>
          ))}
          <div className="rounded-md bg-[#E6C878] px-3 py-1 text-[#022C22]">
            <p className="text-[10px] font-semibold uppercase tracking-wider">HPP Total + {pct}%</p>
            <p className="num text-lg font-semibold" data-testid="hpp-summary-hpp">{rp(t.hpp)}</p>
          </div>
          <span className="text-xs text-[#A8A29E]">{form.lines.length} baris · dimensi {fnum(form.tw)}×{fnum(form.td)}×{fnum(form.th)} m</span>
          {editable && (
            <Button className="ml-auto bg-[#B8963E] hover:bg-[#9C7C2E]" onClick={() => save.mutate()} disabled={save.isPending} data-testid="hpp-save-button">
              <Save className="size-4" /> {save.isPending ? "Menyimpan..." : "Simpan HPP"}
            </Button>
          )}
          {!editable && <Badge className="ml-auto" variant="outline">Mode baca</Badge>}
        </div>
      </div>
    </div>
  );
}

export default function HppEditor() {
  const { id = "new" } = useParams();
  const isNew = id === "new";
  const { data, isError, isLoading } = useQuery({ queryKey: ["hpp", "detail", id], queryFn: () => apiGet<Hpp>(`/hpp/${id}`), enabled: !isNew });
  if (isNew) return <HppForm key="new" initial={EMPTY} id={null} />;
  if (isLoading) return <p className="text-sm text-muted-foreground">Memuat HPP...</p>;
  if (isError || !data) return <div><PageHeader title="HPP" /><Empty text="HPP tidak ditemukan atau server tidak tersedia." testId="hpp-not-found" /></div>;
  return <HppForm key={data.id + data.updated_at} initial={data} id={data.id} live={data} />;
}
