import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Empty, PageHeader, Panel } from "@/components/PageBits";
import { apiDelete, apiGet, apiPut, apiUpload, apiUrl } from "@/lib/api";
import SimpleSelect from "@/components/SimpleSelect";
import { can, useMe } from "@/lib/auth";
import { errMsg } from "@/lib/format";
import type { Signature, SignatureUpdate, UserBrief } from "@/lib/types";

export default function Signatures() {
  const { data: me } = useMe();
  const manage = can(me, "signature:manage");
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [userId, setUserId] = useState("none");
  const users = useQuery({ queryKey: ["signatures", "users"], queryFn: () => apiGet<UserBrief[]>("/signatures/users"), enabled: manage });
  const userOpts = [{ value: "none", label: "— Belum dihubungkan —" }, ...(users.data ?? []).map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))];
  const userName = Object.fromEntries((users.data ?? []).map((u) => [u.id, u.name]));
  const link = useMutation({
    mutationFn: ({ s, uid }: { s: Signature; uid: string | null }) => apiPut<Signature>(`/signatures/${s.id}`, { name: s.name, position: s.position, user_id: uid } satisfies SignatureUpdate),
    onSuccess: () => { toast.success("Akun penandatangan diperbarui"); qc.invalidateQueries({ queryKey: ["signatures"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const { data = [], isError } = useQuery({ queryKey: ["signatures"], queryFn: () => apiGet<Signature[]>("/signatures") });
  const add = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("position", position);
      if (userId !== "none") fd.append("user_id", userId);
      if (file) fd.append("file", file);
      return apiUpload<Signature>("/signatures", fd);
    },
    onSuccess: () => {
      toast.success("Template tanda tangan tersimpan");
      setName(""); setPosition(""); setFile(null); setUserId("none");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["signatures"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/signatures/${id}`),
    onSuccess: () => { toast.success("Template dihapus"); qc.invalidateQueries({ queryKey: ["signatures"] }); qc.invalidateQueries({ queryKey: ["hpp"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <PageHeader title="Template Tanda Tangan" subtitle="Unggah tanda tangan sekali (PNG transparan disarankan), hubungkan ke akun pengguna, lalu cukup pilih siapa yang approval. Penandatangan menerima notifikasi dan klik Tandatangani." />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {manage && (
          <Panel title="Unggah tanda tangan baru" testId="signature-upload-panel">
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!file) { toast.error("Pilih gambar tanda tangan"); return; } add.mutate(); }}>
              <div className="space-y-1"><Label className="text-xs">Nama *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="mis. Haryanto S" data-testid="signature-name-input" /></div>
              <div className="space-y-1"><Label className="text-xs">Jabatan</Label><Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="mis. Manager R&D" data-testid="signature-position-input" /></div>
              <div className="space-y-1"><Label className="text-xs">Akun pengguna (penerima notifikasi)</Label>
                <SimpleSelect value={userId} onChange={setUserId} options={userOpts} testId="signature-user-select" className="w-full" /></div>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-[#A7CDB8] bg-[#F6FBF8] px-4 py-6 text-center transition-colors hover:border-[#B8963E]" data-testid="signature-file-dropzone">
                {file ? <img src={URL.createObjectURL(file)} alt="preview" className="max-h-20 object-contain" /> : <PenLine className="size-7 text-[#047857]" />}
                <span className="text-xs text-muted-foreground">{file ? file.name : "Pilih gambar tanda tangan (PNG/JPG, maks 5 MB)"}</span>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="signature-file-input" />
              </label>
              <Button type="submit" className="w-full" disabled={add.isPending} data-testid="signature-save-button"><Upload className="size-4" /> {add.isPending ? "Mengunggah..." : "Simpan template"}</Button>
            </form>
          </Panel>
        )}
        <Panel title={`Daftar template (${data.length})`} testId="signature-list-panel" className={manage ? "" : "lg:col-span-2"}>
          {isError || data.length === 0 ? <Empty text="Belum ada template tanda tangan." testId="signature-empty" /> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.map((s) => (
                <div key={s.id} className="lux-card rounded-lg border p-4" data-testid={`signature-card-${s.id}`}>
                  <div className="grid h-24 place-items-center rounded-md border border-dashed border-[#CFE0D6] bg-white">
                    <img src={apiUrl(`/signatures/${s.id}/image`)} alt={s.name} className="max-h-20 max-w-full object-contain" />
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-heading text-[15px] font-semibold" data-testid={`signature-name-${s.id}`}>{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.position || "—"}</p>
                      {!manage && <p className="mt-1 text-[11px] text-[#065F46]">{s.user_id ? "Terhubung ke akun" : "Belum terhubung ke akun"}</p>}
                    </div>
                    {manage && <Button size="icon-xs" variant="ghost" onClick={() => { if (confirm(`Hapus template ${s.name}?`)) del.mutate(s.id); }} data-testid={`signature-delete-${s.id}`}><Trash2 className="size-3.5 text-destructive" /></Button>}
                  </div>
                  {manage && (
                    <div className="mt-3 space-y-1">
                      <p className="text-[11px] text-muted-foreground">Akun penandatangan{s.user_id && userName[s.user_id] ? `: ${userName[s.user_id]}` : ""}</p>
                      <SimpleSelect value={s.user_id ?? "none"} onChange={(v) => link.mutate({ s, uid: v === "none" ? null : v })} options={userOpts} testId={`signature-link-user-${s.id}`} className="w-full text-xs" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
