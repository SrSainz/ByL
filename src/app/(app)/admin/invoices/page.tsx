import { FileText, PlusCircle, Trash2 } from "lucide-react";
import { dismissAttachmentAction } from "@/app/actions/incidents";
import { InvoiceBulkUpload } from "@/components/invoices/invoice-bulk-upload";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth";
import { getPendingInvoiceAttachments } from "@/lib/data";
import type { InvoiceExtraction } from "@/lib/types";

export default async function InvoiceInboxPage() {
  const profile = await requireRole(["admin"]);
  const attachments = await getPendingInvoiceAttachments(profile);

  return (
    <div>
      <PageHeader
        title="Facturas pendientes"
        description="Revisa PDFs importados o leidos que todavia no estan vinculados a una incidencia."
      />
      <InvoiceBulkUpload />

      {attachments.length === 0 ? (
        <EmptyState title="No hay facturas pendientes" description="Cuando importes o leas PDFs apareceran aqui hasta vincularlos o descartarlos." />
      ) : (
        <div className="space-y-3">
          {attachments.map((attachment) => {
            const extraction = Array.isArray(attachment.invoice_extractions)
              ? attachment.invoice_extractions[0]
              : attachment.invoice_extractions as InvoiceExtraction | null | undefined;

            return (
              <article key={attachment.id} className="rounded-lg border border-border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-950">{attachment.file_name}</h2>
                    <p className="text-sm text-muted">{Math.round(attachment.size_bytes / 1024)} KB · {attachment.created_at}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink href={`/incidents/new?attachment_id=${attachment.id}`} variant="primary">
                      <PlusCircle className="h-4 w-4" aria-hidden="true" />
                      Crear incidencia
                    </ButtonLink>
                    <ButtonLink href={`/api/invoices/${attachment.id}/download`} variant="secondary" target="_blank">
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      Ver PDF
                    </ButtonLink>
                    <form action={dismissAttachmentAction}>
                      <input type="hidden" name="attachment_id" value={attachment.id} />
                      <Button type="submit" variant="danger">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Descartar
                      </Button>
                    </form>
                  </div>
                </div>
                <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                  {JSON.stringify(extraction?.parsed_data ?? {}, null, 2)}
                </pre>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
