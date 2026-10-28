import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiDelete, apiGet, apiUpload, apiUrl } from "@/lib/api";
import { errMsg } from "@/lib/format";
import type { Attachment } from "@/lib/types";
import { Empty, Panel } from "@/components/PageBits";

export default function AttachmentPanel({ ownerType, ownerId, canWrite, title = "Lampiran" }: {
  ownerType: "hpp" | "packaging"; ownerId: string; canWrite: boolean; title?: string;
}) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const key = ["attachments", ownerType, ownerId];
  const { data = [], isError } = useQuery({
    queryKey: key,
    queryFn: () => apiGet<Attachment[]>(`/attachments?owner_type=${ownerType}&owner_id=${ownerId}`),
  });
  const upload = useMutation({
    mutationFn: (files: FileList) => {
      const fd = new FormData();
      fd.append("owner_type", ownerType);
      fd.append("owner_id", ownerId);
      Array.from(files).forEach((f) => fd.append("files", f));
      return apiUpload<Attachment[]>("/attachments", fd);
    },
    onSuccess: (r) => { toast.success(`${r.length} file terunggah`); qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/attachments/${id}`),
    onSuccess: () => { toast.success("Lampiran dihapus"); qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Panel
      testId={`attachments-${ownerType}`}
      title={<span className="flex items-center gap-2"><Paperclip className="size-4" />{title}</span>}
      action={canWrite && (
        <>
          <input ref={input} type="file" multiple hidden accept="image/*,.pdf,.xlsx,.xls" data-testid={`attachments-${ownerType}-input`}
            onChange={(e) => { if (e.target.files?.length) upload.mutate(e.target.files); e.target.value = ""; }} />
          <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={upload.isPending} data-testid={`attachments-${ownerType}-upload-button`}>
            <Upload className="size-4" /> {upload.isPending ? "Mengunggah..." : "Unggah"}
          </Button>
        </>
      )}
    >
      {isError || data.length === 0 ? (
        <Empty text="Belum ada lampiran (foto/scan packaging form, gambar produk, PDF)." testId={`attachments-${ownerType}-empty`} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.map((a) => {
            const isImg = a.content_type.startsWith("image/");
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-md border bg-[#F6FBF8] p-2" data-testid={`attachment-item-${a.id}`}>
                <a href={apiUrl(`/attachments/${a.id}/file`)} target="_blank" rel="noreferrer" className="shrink-0">
                  {isImg ? (
                    <img src={apiUrl(`/attachments/${a.id}/file`)} alt={a.filename} className="size-14 rounded object-cover" />
                  ) : (
                    <div className="grid size-14 place-items-center rounded bg-[#E3F2EA] text-[#064E3B]">
                      {a.filename.toLowerCase().endsWith(".pdf") ? <FileText className="size-6" /> : <ImageIcon className="size-6" />}
                    </div>
                  )}
                </a>
                <div className="min-w-0 flex-1">
                  <a href={apiUrl(`/attachments/${a.id}/file`)} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:underline" data-testid={`attachment-link-${a.id}`}>{a.filename}</a>
                  <p className="text-[11px] text-muted-foreground">{(a.size / 1024).toFixed(0)} KB · {a.uploaded_by}</p>
                </div>
                {canWrite && (
                  <Button size="icon-sm" variant="ghost" onClick={() => del.mutate(a.id)} data-testid={`attachment-delete-${a.id}`}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
