import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileDown, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SimpleSelect from "@/components/SimpleSelect";
import AttachmentPanel from "@/components/AttachmentPanel";
import ApprovalPanel from "@/components/ApprovalPanel";
import { Empty, PageHeader, Panel } from "@/components/PageBits";
import { apiDelete, apiGet, apiPost, apiPut, apiUrl } from "@/lib/api";
import { can, useMe } from "@/lib/auth";
import { PACKAGING_SLOTS, errMsg } from "@/lib/format";
import { DETAIL_FIELDS, PACKAGING_GROUPS } from "@/lib/packaging";
import type { HppSummary, Packaging, PackagingIn } from "@/lib/types";

const EMPTY: PackagingIn = {
  hpp_id: null, buyer: "", item_name: "", color: "", po_no: "", date: new Date().toISOString().slice(0, 10), etd: "", produksi_sample: "",
  ros_rop: "", keterangan: "", checks: [], details: {}, marking: false, label: false, notes: "", sign_marketing: "", sign_dibuat_rnd: "", sign_mengetahui_rnd: "", approvals: {},
};

type TextKey = "buyer" | "item_name" | "color" | "po_no" | "etd" | "produksi_sample" | "ros_rop" | "keterangan";

function PackagingFormView({ initial, id, live }: { initial: PackagingIn; id: string | null; live?: Packaging }) {
  const { data: me } = useMe();
  const editable = can(me, "packaging:write");
  const nav = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState<PackagingIn>(initial);
  const hpps = useQuery({ queryKey: ["hpp", "", "all", ""], queryFn: () => apiGet<HppSummary[]>("/hpp") });
  const set = <K extends keyof PackagingIn>(k: K, v: PackagingIn[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (key: string, on: boolean) => setF((x) => ({ ...x, checks: on ? [...new Set([...x.checks, key])] : x.checks.filter((c) => c !== key) }));
  const setDetail = (k: string, v: string) => setF((x) => ({ ...x, details: { ...x.details, [k]: v } }));

  const save = useMutation({
    mutationFn: () => (id ? apiPut<Packaging>(`/packaging/${id}`, f) : apiPost<Packaging>("/packaging", f)),
    onSuccess: (p) => {
      toast.success("Packaging form tersimpan");
      qc.invalidateQueries({ queryKey: ["packaging"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (!id) nav(`/packaging/${p.id}`, { replace: true });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: () => apiDelete(`/packaging/${id}`),
    onSuccess: () => { toast.success("Packaging form dihapus"); qc.invalidateQueries({ queryKey: ["packaging"] }); nav("/packaging"); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const field = (k: TextKey, label: string) => (
    <div className="grid grid-cols-[120px_1fr] items-center gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={f[k]} onChange={(e) => set(k, e.target.value)} disabled={!editable} className="h-8" data-testid={`packaging-input-${k}`} />
    </div>
  );

  return (
    <div>
      <PageHeader title={id ? `Packaging Form — ${f.buyer}` : "Packaging Form Baru"} subtitle="Research & Development · sesuai form fisik packaging buyer."
        actions={
          <>
            <Link to="/packaging" className={buttonVariants({ variant: "ghost", size: "sm" })} data-testid="packaging-back-link"><ArrowLeft className="size-4" /> Kembali</Link>
            {id && <a href={apiUrl(`/packaging/${id}/pdf`)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })} data-testid="packaging-export-pdf-button"><FileDown className="size-4" /> Cetak / PDF</a>}
            {id && editable && <Button variant="outline" size="sm" className="text-destructive" onClick={() => { if (confirm("Hapus packaging form ini?")) del.mutate(); }} data-testid="packaging-delete-button"><Trash2 className="size-4" /> Hapus</Button>}
            {editable && <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} data-testid="packaging-save-button"><Save className="size-4" /> {save.isPending ? "Menyimpan..." : "Simpan"}</Button>}
          </>
        } />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Panel title="Description" testId="packaging-description">
            <div className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
              <div className="space-y-2.5">
                {field("buyer", "Buyer *")}{field("item_name", "Item Name")}{field("color", "Color")}{field("po_no", "No. PO")}
              </div>
              <div className="space-y-2.5">
                <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} disabled={!editable} className="h-8" data-testid="packaging-input-date" />
                </div>
                {field("etd", "ETD")}{field("produksi_sample", "Produksi/sample")}{field("ros_rop", "No. ROS / ROP")}
              </div>
              <div className="md:col-span-2">{field("keterangan", "Keterangan")}</div>
              <div className="grid grid-cols-[120px_1fr] items-center gap-2 md:col-span-2">
                <Label className="text-xs text-muted-foreground">HPP terkait</Label>
                <SimpleSelect value={f.hpp_id ?? "none"} onChange={(v) => set("hpp_id", v === "none" ? null : v)} disabled={!editable} testId="packaging-hpp-select" className="w-full"
                  options={[{ value: "none", label: "— Tidak terhubung —" }, ...(hpps.data ?? []).map((h) => ({ value: h.id, label: `${h.code_item} · ${h.buyer} (${h.date})` }))]} />
              </div>
            </div>
          </Panel>

          {PACKAGING_GROUPS.map((g) => (
            <Panel key={g.title} title={g.title} testId={`packaging-group-${g.title.replace(/\W+/g, "-").toLowerCase()}`}>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {g.options.map((o) => {
                  const on = f.checks.includes(o.key);
                  return (
                    <div key={o.key} className={`rounded-md border px-3 py-2 transition-colors ${on ? "border-[#B8963E] bg-[#D1FAE5]/50" : "bg-card"}`}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox checked={on} onCheckedChange={(c: boolean) => toggle(o.key, c)} disabled={!editable} data-testid={`packaging-check-${o.key}`} />
                        {o.label}
                      </label>
                      {on && DETAIL_FIELDS[o.key]?.map((d) => (
                        <div key={d.key} className="mt-2">
                          <Input placeholder={d.label} value={f.details[d.key] ?? ""} onChange={(e) => setDetail(d.key, e.target.value)} disabled={!editable} className="h-7 text-xs" data-testid={`packaging-detail-${d.key}`} />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              {g.title === "Protect" && (
                <div className="mt-3 space-y-1">
                  <Label className="text-xs">List protect</Label>
                  <Textarea rows={2} value={f.details.list_protect ?? ""} onChange={(e) => setDetail("list_protect", e.target.value)} disabled={!editable} data-testid="packaging-detail-list_protect" />
                </div>
              )}
            </Panel>
          ))}

          <Panel title="Marking & Notes" testId="packaging-marking">
            <div className="flex flex-wrap gap-6">
              {(["marking", "label"] as const).map((k) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-16 text-sm font-medium capitalize">{k}</span>
                  {[true, false].map((v) => (
                    <Button key={String(v)} size="sm" variant={f[k] === v ? "default" : "outline"} disabled={!editable}
                      onClick={() => set(k, v)} data-testid={`packaging-${k}-${v ? "ada" : "tidak"}`}>{v ? "Ada" : "Tidak"}</Button>
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs italic text-muted-foreground">*Jika ada Marking dan Label mohon lampirkan ukuran dan tata letaknya. Tim R&amp;D tidak dapat memproses pembuatan layout box ataupun sampling box tanpa Marking dan Label yang lengkap.</p>
            <div className="mt-4 space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={4} value={f.notes} onChange={(e) => set("notes", e.target.value)} disabled={!editable} data-testid="packaging-input-notes" />
            </div>
          </Panel>

          <ApprovalPanel slots={PACKAGING_SLOTS} value={f.approvals ?? {}} onChange={(v) => set("approvals", v)} disabled={!editable} testPrefix="packaging"
            kind="packaging" docId={id} saved={live?.approvals ?? {}} signed={live?.approval_signed ?? {}} rejection={live?.approval_rejection ?? null} title={`${f.item_name || "Packaging"} · ${f.buyer}`} />

          <Panel title="Nama penandatangan manual (opsional, jika tanpa template)" testId="packaging-signatures">
            <div className="grid gap-4 md:grid-cols-3">
              {([["sign_marketing", "Marketing"], ["sign_dibuat_rnd", "Dibuat R&D"], ["sign_mengetahui_rnd", "Mengetahui R&D"]] as const).map(([k, l]) => (
                <div key={k} className="space-y-1 text-center">
                  <Label className="text-xs">{l},</Label>
                  <Input value={f[k]} onChange={(e) => set(k, e.target.value)} disabled={!editable} className="text-center" placeholder="Nama" data-testid={`packaging-input-${k}`} />
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          {id ? (
            <>
              <AttachmentPanel ownerType="packaging" ownerId={id} canWrite={can(me, "attachment:write")} title="Scan / foto packaging form" />
              {f.hpp_id && <AttachmentPanel ownerType="hpp" ownerId={f.hpp_id} canWrite={false} title="Lampiran dari HPP terkait" />}
            </>
          ) : <Empty text="Simpan form terlebih dahulu untuk mengunggah scan/foto packaging form dari buyer." />}
        </div>
      </div>
    </div>
  );
}

export default function PackagingEditor() {
  const { id = "new" } = useParams();
  const isNew = id === "new";
  const { data, isError, isLoading } = useQuery({ queryKey: ["packaging", "detail", id], queryFn: () => apiGet<Packaging>(`/packaging/${id}`), enabled: !isNew });
  if (isNew) return <PackagingFormView key="new" initial={EMPTY} id={null} />;
  if (isLoading) return <p className="text-sm text-muted-foreground">Memuat...</p>;
  if (isError || !data) return <div><PageHeader title="Packaging Form" /><Empty text="Packaging form tidak ditemukan atau server tidak tersedia." testId="packaging-not-found" /></div>;
  return <PackagingFormView key={data.id + data.updated_at} initial={data} id={data.id} live={data} />;
}
