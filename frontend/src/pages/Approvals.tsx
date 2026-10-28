import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, PackageCheck, Signature as SignIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApprovalBadge, useSignApproval } from "@/components/ApprovalPanel";
import { Empty, PageHeader, Panel } from "@/components/PageBits";
import { apiGet } from "@/lib/api";
import type { PendingApproval } from "@/lib/types";

export default function Approvals() {
  const { data = [], isError, isLoading } = useQuery({ queryKey: ["approvals", "pending"], queryFn: () => apiGet<PendingApproval[]>("/approvals/pending"), refetchInterval: 15000 });
  const sign = useSignApproval();
  return (
    <div>
      <PageHeader title="Persetujuan Saya" subtitle="Daftar HPP dan Packaging Form yang menunggu tanda tangan Anda. Tanda tangan diambil dari template yang terhubung ke akun Anda." />
      <Panel title={`Menunggu tanda tangan (${data.length})`} testId="approvals-pending-panel">
        {isLoading ? <p className="text-sm text-muted-foreground">Memuat...</p> : isError || data.length === 0 ? (
          <Empty text="Tidak ada dokumen yang menunggu tanda tangan Anda." testId="approvals-empty" />
        ) : (
          <ul className="space-y-3">
            {data.map((p) => (
              <li key={`${p.doc_id}-${p.slot}`} className="flex flex-wrap items-center gap-4 rounded-lg border bg-white px-4 py-3" data-testid={`approval-pending-${p.doc_id}-${p.slot}`}>
                <span className="grid size-10 place-items-center rounded-lg bg-[#E7F3EC] text-[#047857]">
                  {p.kind === "hpp" ? <ClipboardList className="size-5" /> : <PackageCheck className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.kind === "hpp" ? "Lembar HPP" : "Packaging Form"} · sebagai <b className="text-[#065F46]">{p.slot_label}</b> · {p.date}</p>
                </div>
                <ApprovalBadge status={p.approval_status} />
                <Link to={p.kind === "hpp" ? `/hpp/${p.doc_id}` : `/packaging/${p.doc_id}`} className={buttonVariants({ variant: "outline", size: "sm" })} data-testid={`approval-open-${p.doc_id}-${p.slot}`}>Buka & periksa</Link>
                <Button size="sm" className="bg-[#047857] hover:bg-[#065F46]" disabled={sign.isPending}
                  onClick={() => sign.mutate({ kind: p.kind, docId: p.doc_id, slot: p.slot })} data-testid={`approval-sign-${p.doc_id}-${p.slot}`}>
                  <SignIcon className="size-4" /> Tandatangani
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
