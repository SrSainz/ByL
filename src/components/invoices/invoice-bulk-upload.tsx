"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvoiceBulkUpload() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function uploadInvoices() {
    if (files.length === 0) {
      setError("Selecciona una o varias facturas PDF.");
      return;
    }

    setUploading(true);
    setStatus(`Subiendo y analizando ${files.length} factura${files.length === 1 ? "" : "s"}...`);
    setError("");

    let ok = 0;
    const failed: string[] = [];

    for (const file of files) {
      const payload = new FormData();
      payload.set("invoice", file);
      const response = await fetch("/api/invoices/extract", {
        method: "POST",
        body: payload
      });
      const result = await response.json();

      if (response.ok) {
        ok += 1;
      } else {
        failed.push(`${file.name}: ${result.message || "no se ha podido analizar"}`);
      }
    }

    setUploading(false);
    setFiles([]);
    setStatus(ok > 0 ? `${ok} factura${ok === 1 ? "" : "s"} guardada${ok === 1 ? "" : "s"} en pendientes.` : "");
    setError(failed.join("\n"));
    router.refresh();
  }

  return (
    <section className="mb-5 rounded-lg border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Subir facturas para revisar después</h2>
          <p className="mt-1 text-sm text-muted">
            Puedes cargar varias facturas de golpe. Quedarán guardadas en pendientes para crear o completar incidencias más tarde.
          </p>
        </div>
        <Button type="button" onClick={uploadInvoices} disabled={uploading}>
          <UploadCloud className="h-4 w-4" aria-hidden="true" />
          {uploading ? "Subiendo..." : "Subir y analizar"}
        </Button>
      </div>
      <input
        className="field mt-4"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
      />
      {files.length > 0 ? (
        <p className="mt-2 text-xs text-muted">
          {files.length} archivo{files.length === 1 ? "" : "s"} seleccionado{files.length === 1 ? "" : "s"}.
        </p>
      ) : null}
      {status ? <p className="mt-2 text-sm text-success">{status}</p> : null}
      {error ? <p className="mt-2 whitespace-pre-wrap text-sm text-danger">{error}</p> : null}
    </section>
  );
}
