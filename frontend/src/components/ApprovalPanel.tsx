import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BadgeCheck, Clock, PenLine, Signature as SignIcon, TriangleAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import SimpleSelect from "@/components/SimpleSelect";
import { Panel } from "@/components/PageBits";
import { apiGet, apiPost, apiUrl } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { APPROVAL_LABELS, errMsg } from "@/lib/format";
import type { ApprovalRejection, ApprovalState, RejectIn, Signature } from "@/lib/types";

export function ApprovalBadge({ status, testId }: { status: string; testId?: string }) {
  const s = APPROVAL_LABELS[status] ?? APPROVAL_LABELS.draft;
  return <Badge className={s.cls} data-testid={testId}>{s.label}</Badge>;
}

export function useSignApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, docId, slot }: { kind: "hpp" | "packaging"; docId: string; slot: string }) =>
      apiPost<ApprovalState>(`/approvals/${kind}/${docId}/sign`, { slot }),
    onSuccess: (r) => {
      toast.success(r.approval_status === "approved" ? "Ditandatangani — semua tanda tangan lengkap (Approved)" : "Berhasil ditandatangani");
      ["hpp", "packaging", "notifications", "approvals", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export interface RejectTarget { kind: "hpp" | "packaging"; docId: string; slot: string; slotLabel: string; title: string }

export function RejectDialog({ target, onClose }: { target: RejectTarget | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const reject = useMutation({
    mutationFn: (t: RejectTarget) => apiPost<ApprovalState>(`/approvals/${t.kind}/${t.docId}/reject`, { slot: t.slot, reason } satisfies RejectIn),
    onSuccess: () => {
      toast.success("Dokumen dikembalikan untuk revisi — pembuat sudah diberi tahu");
      ["hpp", "packaging", "notifications", "approvals", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setReason("");
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) { setReason(""); onClose(); } }}>
      <DialogContent className="sm:max-w-md" data-testid="reject-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Undo2 className="size-4 text-[#B91C1C]" />Tolak & kembalikan untuk revisi</DialogTitle>
          <DialogDescription>{target ? `${target.title} · sebagai ${target.slotLabel}. Semua tanda tangan akan direset dan pembuat menerima notifikasi beserta alasan Anda.` : ""}</DialogDescription>
        </DialogHeader>
        <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tulis alasan penolakan / bagian yang perlu direvisi..." data-testid="reject-reason-input" autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={() => { setReason(""); onClose(); }} data-testid="reject-cancel-button">Batal</Button>
          <Button className="bg-[#B91C1C] hover:bg-[#991B1B]" disabled={reason.trim().length < 3 || reject.isPending || !target}
            onClick={() => target && reject.mutate(target)} data-testid="reject-submit-button">{reject.isPending ? "Mengirim..." : "Tolak & kirim catatan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const fmtTime = (iso: string) => new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

export default function ApprovalPanel({ slots, value, onChange, disabled, testPrefix, kind, docId, saved, signed, rejection, title = "" }: {
  slots: { key: string; label: string }[]; value: Record<string, string | null>; onChange: (v: Record<string, string | null>) => void;
  disabled?: boolean; testPrefix: string; kind: "hpp" | "packaging"; docId: string | null;
  saved: Record<string, string | null>; signed: Record<string, string>; rejection?: ApprovalRejection | null; title?: string;
}) {
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const { data: me } = useMe();
  const { data: sigs = [], isError } = useQuery({ queryKey: ["signatures"], queryFn: () => apiGet<Signature[]>("/signatures") });
  const sign = useSignApproval();
  const byId = Object.fromEntries(sigs.map((s) => [s.id, s]));
  const opts = [{ value: "none", label: "— Pilih penandatangan —" }, ...sigs.map((s) => ({ value: s.id, label: `${s.name}${s.position ? ` · ${s.position}` : ""}` }))];
  const isSigned = (k: string) => !!value[k] && saved[k] === value[k] && !!signed[k];
  const unsaved = slots.some((s) => (value[s.key] ?? null) !== (saved[s.key] ?? null));
  const rejected = !!rejection;
  const status = rejected ? "rejected" : !slots.some((s) => value[s.key]) ? "draft" : slots.every((s) => isSigned(s.key)) ? "approved" : "partial";

  return (
    <Panel testId={`${testPrefix}-approval-panel`}
      title={<span className="flex items-center gap-2"><BadgeCheck className="size-4 text-[#047857]" />Approval & Tanda Tangan <ApprovalBadge status={status} testId={`${testPrefix}-approval-status`} /></span>}
      action={<Link to="/signatures" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline" data-testid={`${testPrefix}-manage-signatures-link`}><PenLine className="size-3.5" />Kelola template</Link>}>
      {rejection && (
        <div className="mb-4 flex gap-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm" data-testid={`${testPrefix}-rejection-banner`}>
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#B91C1C]" />
          <div>
            <p className="font-semibold text-[#991B1B]">Ditolak oleh {rejection.by_name} ({rejection.slot_label}) · {fmtTime(rejection.at)}</p>
            <p className="mt-1 text-[#7F1D1D]" data-testid={`${testPrefix}-rejection-reason`}>“{rejection.reason}”</p>
            <p className="mt-1 text-xs text-[#7F1D1D]/80">Revisi isi dokumen, lalu klik Simpan — permintaan tanda tangan dikirim ulang ke semua penandatangan.</p>
          </div>
        </div>
      )}
      {!isError && sigs.length === 0 && <p className="mb-3 text-xs text-muted-foreground">Belum ada template tanda tangan. Unggah dulu di menu Template Tanda Tangan.</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {slots.map((slot) => {
          const sigId = value[slot.key];
          const sig = sigId ? byId[sigId] : undefined;
          const savedSame = !!sigId && saved[slot.key] === sigId;
          const done = isSigned(slot.key);
          const canSign = !!docId && savedSame && !done && !rejected && !!sig && sig.user_id === me?.id;
          return (
            <div key={slot.key} className={`rounded-lg border p-3 text-center transition-colors ${done ? "border-[#A7CDB8] bg-gradient-to-b from-white to-[#ECFDF5]" : "bg-gradient-to-b from-white to-[#F6FBF8]"}`} data-testid={`${testPrefix}-approval-slot-${slot.key}`}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{slot.label} :</p>
              <div className="grid h-20 place-items-center rounded-md border border-dashed border-[#CFE0D6] bg-white">
                {done && sig ? <img src={apiUrl(`/signatures/${sig.id}/image`)} alt={sig.name} className="max-h-[72px] max-w-full object-contain" data-testid={`${testPrefix}-approval-img-${slot.key}`} />
                  : sig ? (
                    <span className="flex items-center gap-1 text-[11px] text-[#7A5B12]" data-testid={`${testPrefix}-approval-waiting-${slot.key}`}>
                      <Clock className="size-3.5" />{!savedSame ? "Simpan untuk mengirim permintaan" : rejected ? "Menunggu revisi" : "Menunggu tanda tangan"}
                    </span>
                  ) : <span className="text-[11px] text-muted-foreground">belum dipilih</span>}
              </div>
              <p className="mt-2 font-heading text-sm font-semibold" data-testid={`${testPrefix}-approval-name-${slot.key}`}>{sig?.name ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">{sig?.position ?? "\u00a0"}</p>
              <p className="mb-2 h-4 text-[10px] text-[#065F46]" data-testid={`${testPrefix}-approval-signed-at-${slot.key}`}>{done ? `Ditandatangani ${fmtTime(signed[slot.key])}` : ""}</p>
              {canSign ? (
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <Button size="sm" className="bg-[#047857] hover:bg-[#065F46]" disabled={sign.isPending}
                    onClick={() => sign.mutate({ kind, docId: docId as string, slot: slot.key })} data-testid={`${testPrefix}-approval-sign-${slot.key}`}>
                    <SignIcon className="size-4" /> Tandatangani
                  </Button>
                  <Button size="sm" variant="outline" className="border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]"
                    onClick={() => setRejectTarget({ kind, docId: docId as string, slot: slot.key, slotLabel: slot.label, title })} data-testid={`${testPrefix}-approval-reject-${slot.key}`}>
                    <Undo2 className="size-4" /> Tolak
                  </Button>
                </div>
              ) : null}
              <SimpleSelect value={sigId ?? "none"} disabled={disabled} options={opts} className="w-full text-xs" testId={`${testPrefix}-approval-select-${slot.key}`}
                onChange={(v) => onChange({ ...value, [slot.key]: v === "none" ? null : v })} />
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {rejected ? "Status ditolak akan hilang setelah dokumen direvisi dan disimpan." : unsaved ? "Ada perubahan penandatangan — klik Simpan agar permintaan tanda tangan terkirim ke akun penandatangan." :
          "Penandatangan menerima notifikasi saat login dan klik Tandatangani. Status Approved setelah ketiga kolom ditandatangani."}
      </p>
      <RejectDialog target={rejectTarget} onClose={() => setRejectTarget(null)} />
    </Panel>
  );
}
