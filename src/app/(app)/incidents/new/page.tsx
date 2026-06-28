import { createIncidentAction } from "@/app/actions/incidents";
import { IncidentForm } from "@/components/incidents/incident-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";
import { getAllLookups, getInvoiceAttachmentById } from "@/lib/data";
import { buildInvoiceSuggestion } from "@/lib/invoices";
import type { InvoiceExtraction } from "@/lib/types";

export default async function NewIncidentPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const profile = await requireProfile();
  const lookups = await getAllLookups();
  const attachmentId = typeof params.attachment_id === "string" ? params.attachment_id : undefined;
  const attachment = attachmentId ? await getInvoiceAttachmentById(profile, attachmentId) : null;
  const extraction = attachment
    ? Array.isArray(attachment.invoice_extractions)
      ? attachment.invoice_extractions[0]
      : attachment.invoice_extractions as InvoiceExtraction | null | undefined
    : null;
  const initialSuggestions = attachment
    ? buildInvoiceSuggestion({
        fileName: attachment.file_name,
        rawText: extraction?.raw_text ?? "",
        parsedData: extraction?.parsed_data ?? {},
        lookups
      })
    : undefined;

  return (
    <div>
      <PageHeader title="Crear incidencia" description="Registra una nueva incidencia de mantenimiento." />
      <IncidentForm
        profile={profile}
        lookups={lookups}
        action={createIncidentAction}
        submitLabel="Crear incidencia"
        initialAttachments={attachment ? [attachment] : undefined}
        initialSuggestions={initialSuggestions}
      />
    </div>
  );
}
