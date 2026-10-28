import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BadgeCheck, PenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SimpleSelect from "@/components/SimpleSelect";
import { Panel } from "@/components/PageBits";
import { apiGet, apiUrl } from "@/lib/api";
import { APPROVAL_LABELS } from "@/lib/format";
import type { Signature } from "@/lib/types";

export function ApprovalBadge({ status, testId }: { status: string; testId?: string }) {
  const s = APPROVAL_LABELS[status] ?? APPROVAL_LABELS.draft;
  return <Badge className={s.cls} data-testid={testId}>{s.label}</Badge>;
}

export default function ApprovalPanel({ slots, value, onChange, disabled, status, testPrefix }: {
  slots: { key: string; label: string }[]; value: Record<string, string | null>; onChange: (v: Record<string, string | null>) => void;
  disabled?: boolean; status: string; testPrefix: string;
}) {
  const { data: sigs = [], isError } = useQuery({ queryKey: ["signatures"], queryFn: () => apiGet<Signature[]>("/signatures") });
  const byId = Object.fromEntries(sigs.map((s) => [s.id, s]));
  const opts = [{ value: "none", label: "— Pilih penandatangan —" }, ...sigs.map((s) => ({ value: s.id, label: `${s.name}${s.position ? ` · ${s.position}` : ""}` }))];
  return (
    <Panel testId={`${testPrefix}-approval-panel`}
      title={<span className="flex items-center gap-2"><BadgeCheck className="size-4 text-[#047857]" />Approval & Tanda Tangan <ApprovalBadge status={status} testId={`${testPrefix}-approval-status`} /></span>}
      action={<Link to="/signatures" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline" data-testid={`${testPrefix}-manage-signatures-link`}><PenLine className="size-3.5" />Kelola template</Link>}>
      {!isError && sigs.length === 0 && <p className="mb-3 text-xs text-muted-foreground">Belum ada template tanda tangan. Unggah dulu di menu Template Tanda Tangan.</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {slots.map((slot) => {
          const sig = value[slot.key] ? byId[value[slot.key] as string] : undefined;
          return (
            <div key={slot.key} className="rounded-lg border bg-gradient-to-b from-white to-[#F6FBF8] p-3 text-center" data-testid={`${testPrefix}-approval-slot-${slot.key}`}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{slot.label} :</p>
              <div className="grid h-20 place-items-center rounded-md border border-dashed border-[#CFE0D6] bg-white">
                {sig ? <img src={apiUrl(`/signatures/${sig.id}/image`)} alt={sig.name} className="max-h-[72px] max-w-full object-contain" data-testid={`${testPrefix}-approval-img-${slot.key}`} />
                  : <span className="text-[11px] text-muted-foreground">belum ditandatangani</span>}
              </div>
              <p className="mt-2 font-heading text-sm font-semibold" data-testid={`${testPrefix}-approval-name-${slot.key}`}>{sig?.name ?? "—"}</p>
              <p className="mb-2 text-[11px] text-muted-foreground">{sig?.position ?? "\u00a0"}</p>
              <SimpleSelect value={value[slot.key] ?? "none"} disabled={disabled} options={opts} className="w-full text-xs" testId={`${testPrefix}-approval-select-${slot.key}`}
                onChange={(v) => onChange({ ...value, [slot.key]: v === "none" ? null : v })} />
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Tanda tangan yang dipilih tampil di PDF/cetak. Status menjadi Approved setelah ketiga kolom terisi, lalu simpan.</p>
    </Panel>
  );
}
