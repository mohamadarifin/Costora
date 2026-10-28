import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, FileSpreadsheet, ImagePlus, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, Panel } from "@/components/PageBits";
import { apiUpload, apiUrl } from "@/lib/api";
import { errMsg } from "@/lib/format";
import type { ImportResult } from "@/lib/types";

export default function ImportBuyer() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [atts, setAtts] = useState<File[]>([]);
  const [buyer, setBuyer] = useState("");
  const [year, setYear] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const run = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      if (file) fd.append("file", file);
      atts.forEach((a) => fd.append("attachments", a));
      if (buyer) fd.append("buyer", buyer);
      if (year) fd.append("labor_year", year);
      return apiUpload<ImportResult>("/import/buyer", fd);
    },
    onSuccess: (r) => {
      setResult(r);
      toast.success(`Import berhasil: ${r.lines_imported} baris HPP`);
      ["hpp", "packaging", "dashboard", "buyers"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <PageHeader title="Upload File Buyer" subtitle="Unggah file Excel buyer (format sheet Rattan Bench 1, opsional sheet PACKAGING) — sistem otomatis membuat lembar HPP dan Packaging Form yang saling terhubung, beserta lampiran foto/scan."
        actions={<a href={apiUrl("/import/template")} className={buttonVariants({ variant: "outline", size: "sm" })} data-testid="import-template-download"><Download className="size-4" /> Unduh contoh format</a>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel title="1. File & lampiran" testId="import-panel">
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (!file) { toast.error("Pilih file Excel terlebih dahulu"); return; } run.mutate(); }}>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-[#A7CDB8] bg-[#F6FBF8] px-6 py-8 text-center transition-colors hover:border-[#B8963E]" data-testid="import-file-dropzone">
              <FileSpreadsheet className="size-8 text-[#047857]" />
              <span className="text-sm font-medium">{file ? file.name : "Pilih file Excel HPP buyer (.xlsx)"}</span>
              <span className="text-xs text-muted-foreground">Label yang dibaca: CODE ITEM, COLOUR, BUYER, TYPE, DATE, DIMENTIONS, dan blok “TOTAL PRICE …”</span>
              <input type="file" accept=".xlsx,.xlsm" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="import-file-input" />
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 transition-colors hover:border-[#B8963E]" data-testid="import-attachments-dropzone">
              <ImagePlus className="size-6 text-[#047857]" />
              <div className="text-sm">
                <p className="font-medium">{atts.length ? `${atts.length} lampiran dipilih` : "Lampiran: foto/scan packaging form, gambar produk, PDF"}</p>
                <p className="text-xs text-muted-foreground">{atts.map((a) => a.name).join(", ") || "Opsional · bisa pilih beberapa file"}</p>
              </div>
              <input type="file" multiple accept="image/*,.pdf" hidden onChange={(e) => setAtts(Array.from(e.target.files ?? []))} data-testid="import-attachments-input" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Nama buyer (opsional, menimpa isi file)</Label>
                <Input value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="mis. Pacific Urban System" data-testid="import-buyer-input" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tahun upah kerja (opsional)</Label>
                <Input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="mis. 2026" data-testid="import-year-input" />
              </div>
            </div>
            <Button type="submit" disabled={run.isPending} data-testid="import-submit-button"><Upload className="size-4" /> {run.isPending ? "Memproses..." : "Proses Import"}</Button>
          </form>
        </Panel>
        <Panel title="2. Hasil" testId="import-result-panel">
          {!result ? (
            <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
              <li>Sistem membaca sheet HPP (format Rattan Bench 1).</li>
              <li>Baris dengan volume terisi menjadi baris HPP dan dicocokkan ke Database Material.</li>
              <li>Packaging Form dibuat otomatis & terhubung (data dari sheet PACKAGING jika ada).</li>
              <li>Lampiran disimpan di HPP dan tampil juga di Packaging Form.</li>
            </ol>
          ) : (
            <div className="space-y-3 text-sm" data-testid="import-result">
              <p className="flex items-center gap-2 font-medium text-[#15803D]"><CheckCircle2 className="size-4" /> Import selesai</p>
              <p><span className="num">{result.lines_imported}</span> baris HPP · <span className="num">{result.attachments}</span> lampiran</p>
              {result.warnings.map((w) => <p key={w} className="flex gap-2 rounded-md bg-[#D1FAE5] p-2 text-xs text-[#065F46]"><TriangleAlert className="size-4 shrink-0" />{w}</p>)}
              <div className="flex flex-col gap-2">
                <Link to={`/hpp/${result.hpp_id}`} className={buttonVariants({ size: "sm" })} data-testid="import-open-hpp">Buka lembar HPP</Link>
                <Link to={`/packaging/${result.packaging_id}`} className={buttonVariants({ variant: "outline", size: "sm" })} data-testid="import-open-packaging">Buka Packaging Form</Link>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
