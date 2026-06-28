import { CalendarDays, Euro, FileText, MapPin, PlusCircle, Store, Trash2, Wrench } from "lucide-react";
import { dismissAttachmentAction } from "@/app/actions/incidents";
import { InvoiceBulkUpload } from "@/components/invoices/invoice-bulk-upload";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth";
import { getPendingInvoiceAttachments } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import type { InvoiceExtraction, InvoiceParsedData } from "@/lib/types";

export default async function InvoiceInboxPage() {
  const profile = await requireRole(["admin"]);
  const attachments = await getPendingInvoiceAttachments(profile);

  return (
    <div>
      <PageHeader
        title="Facturas pendientes"
        description="Sube facturas, revisa lo que ha detectado la app y crea la incidencia cuando esté listo."
      />
      <InvoiceBulkUpload />

      {attachments.length === 0 ? (
        <EmptyState title="No hay facturas pendientes" description="Cuando subas facturas aparecerán aquí para revisarlas." />
      ) : (
        <div className="space-y-3">
          {attachments.map((attachment) => {
            const extraction = Array.isArray(attachment.invoice_extractions)
              ? attachment.invoice_extractions[0]
              : attachment.invoice_extractions as InvoiceExtraction | null | undefined;
            const parsedData = extraction?.parsed_data ?? {};

            return (
              <article key={attachment.id} className="rounded-lg border border-border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-semibold text-slate-950">{attachment.file_name}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {Math.round(attachment.size_bytes / 1024)} KB · subida el {formatDateTime(attachment.created_at)}
                    </p>
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

                <InvoiceSummary parsedData={parsedData} status={extraction?.status} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InvoiceSummary({
  parsedData,
  status
}: {
  parsedData: InvoiceParsedData;
  status?: InvoiceExtraction["status"];
}) {
  const concept = conceptSummary(parsedData);
  const items: Array<{ icon: React.ReactNode; label: string; value: string | null }> = [
    { icon: <Store className="h-4 w-4" />, label: "Proveedor", value: textValue(parsedData.proveedor_name) },
    { icon: <CalendarDays className="h-4 w-4" />, label: "Fecha factura", value: dateValue(parsedData.invoice_date ?? parsedData.fecha_incidencia) },
    { icon: <FileText className="h-4 w-4" />, label: "Nº factura", value: textValue(parsedData.invoice_number) },
    { icon: <Euro className="h-4 w-4" />, label: "Importe", value: amountValue(parsedData.importe_factura ?? parsedData.total_amount) },
    { icon: <MapPin className="h-4 w-4" />, label: "Local", value: textValue(parsedData.local_name) },
    { icon: <MapPin className="h-4 w-4" />, label: "Zona", value: zoneValue(parsedData.zona_names) },
    { icon: <Wrench className="h-4 w-4" />, label: "Prioridad sugerida", value: textValue(parsedData.prioridad_name) }
  ];
  const visibleItems = items.filter((item): item is { icon: React.ReactNode; label: string; value: string } => Boolean(item.value));
  const statusLabel = status === "failed" ? "Revisar manualmente" : status === "completed" ? "Leída" : "Pendiente";

  return (
    <div className="mt-4 rounded-md bg-surface-subtle p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-border">
          {statusLabel}
        </span>
        <p className="text-sm text-muted">Revisa estos datos antes de crear la incidencia.</p>
      </div>

      {visibleItems.length > 0 ? (
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibleItems.map((item) => (
            <SummaryItem key={item.label} icon={item.icon} label={item.label} value={item.value} />
          ))}
        </dl>
      ) : (
        <p className="mt-3 rounded-md border border-border bg-white p-3 text-sm text-muted">
          No se han detectado datos suficientes. Puedes crear la incidencia y rellenarlos manualmente.
        </p>
      )}

      {concept ? (
        <div className="mt-3 rounded-md border border-border bg-white p-3">
          <p className="label">Trabajo detectado</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-800">{concept}</p>
        </div>
      ) : null}
    </div>
  );
}

function SummaryItem({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-white p-3">
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function textValue(value?: string | null) {
  return value?.trim() || null;
}

function zoneValue(value?: string[]) {
  return value?.filter(Boolean).join(", ") || null;
}

function dateValue(value?: string | null) {
  if (!value) return null;
  const clean = value.trim();
  const spanish = clean.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  if (spanish) return `${spanish[1].padStart(2, "0")}/${spanish[2].padStart(2, "0")}/${spanish[3]}`;

  const iso = clean.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[3].padStart(2, "0")}/${iso[2].padStart(2, "0")}/${iso[1]}`;

  return clean;
}

function amountValue(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));

  if (!Number.isFinite(amount)) {
    return null;
  }

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
  }).format(amount);
}

function conceptSummary(parsedData: InvoiceParsedData) {
  const fromConcept = parsedData.concept?.trim();
  const fromDescription = parsedData.descripcion?.split("Concepto:").at(1)?.trim() ?? parsedData.descripcion?.trim();
  const text = (fromConcept || fromDescription || "")
    .replace(/\n(?:Base imponible|IVA|Total factura):[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/^Proveedor:\s*[^.]+$/i.test(text)) return "";
  if (!text) return "";
  return text.length > 260 ? `${text.slice(0, 260).trim()}...` : text;
}
