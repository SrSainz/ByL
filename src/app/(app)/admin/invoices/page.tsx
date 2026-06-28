import { CalendarDays, Euro, FileText, MapPin, PlusCircle, Save, Search, Store, Tag, Trash2, Wrench } from "lucide-react";
import { dismissAttachmentAction, updateAttachmentNameAction } from "@/app/actions/incidents";
import { InvoiceBulkUpload } from "@/components/invoices/invoice-bulk-upload";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth";
import { getAllLookups, getCustomListGroups, getPendingInvoiceAttachments, parseInvoiceFilters } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import type { CustomListGroup, IncidentAttachment, InvoiceExtraction, InvoiceFilters, InvoiceParsedData, LookupItem } from "@/lib/types";

export default async function InvoiceInboxPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const profile = await requireRole(["admin"]);
  const filters = parseInvoiceFilters(params);
  const [lookups, customGroups, attachments] = await Promise.all([
    getAllLookups(),
    getCustomListGroups(),
    getPendingInvoiceAttachments(profile, filters)
  ]);

  return (
    <div>
      <PageHeader
        title="Facturas pendientes"
        description="Sube facturas, revisa los datos y crea la incidencia cuando esté listo."
      />
      <InvoiceBulkUpload />
      <InvoiceFilterForm
        categoryItems={categoryItems(customGroups)}
        filters={filters}
        priorities={lookups.priorities}
        providers={lookups.providers}
        zones={lookups.zones}
      />

      {attachments.length === 0 ? (
        <EmptyState title="No hay facturas pendientes" description="Sube facturas o cambia los filtros." />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {attachments.length} factura{attachments.length === 1 ? "" : "s"} pendiente{attachments.length === 1 ? "" : "s"}.
          </p>
          {attachments.map((attachment) => (
            <InvoiceCard key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}
    </div>
  );
}

function InvoiceFilterForm({
  filters,
  providers,
  priorities,
  categoryItems,
  zones
}: {
  filters: InvoiceFilters;
  providers: LookupItem[];
  priorities: LookupItem[];
  categoryItems: LookupItem[];
  zones: LookupItem[];
}) {
  return (
    <details className="group mb-5 rounded-lg border border-border bg-white p-4" open={hasInvoiceFilters(filters)}>
      <summary className="focus-ring flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-1 text-base font-semibold text-slate-950">
        <span className="inline-flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" aria-hidden="true" />
          Filtrar facturas
        </span>
        <span className="text-sm font-medium text-muted group-open:hidden">Abrir</span>
        <span className="hidden text-sm font-medium text-muted group-open:inline">Cerrar</span>
      </summary>

      <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SelectFilter label="Proveedor" name="provider" value={filters.provider} items={providers} />
        <Field label="Fecha factura">
          <input className="field" name="date" type="date" defaultValue={filters.date ?? ""} />
        </Field>
        <Field label="Nº factura">
          <input className="field" name="number" placeholder="Nº factura" defaultValue={filters.number ?? ""} />
        </Field>
        <Field label="Importe">
          <input className="field" name="amount" type="number" step="0.01" placeholder="Ej. 326.70" defaultValue={filters.amount ?? ""} />
        </Field>
        <SelectFilter label="Prioridad" name="priority" value={filters.priority} items={priorities} />
        <CategoryFilter items={categoryItems} value={filters.category} />
        <SelectFilter label="Zona" name="zone" value={filters.zone} items={zones} />
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit" className="min-w-32">
            <Search className="h-4 w-4" aria-hidden="true" />
            Filtrar
          </Button>
          <ButtonLink href="/admin/invoices" variant="secondary">
            Limpiar
          </ButtonLink>
        </div>
      </form>
    </details>
  );
}

function InvoiceCard({ attachment }: { attachment: IncidentAttachment }) {
  const extraction = Array.isArray(attachment.invoice_extractions)
    ? attachment.invoice_extractions[0]
    : attachment.invoice_extractions as InvoiceExtraction | null | undefined;
  const parsedData = extraction?.parsed_data ?? {};

  return (
    <article className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <form action={updateAttachmentNameAction} className="grid gap-2 lg:grid-cols-[minmax(260px,1fr)_auto]">
          <input type="hidden" name="attachment_id" value={attachment.id} />
          <label className="space-y-1">
            <span className="label">Nombre del PDF</span>
            <input className="field w-full min-w-0 font-semibold" name="file_name" defaultValue={attachment.file_name} />
          </label>
          <Button type="submit" variant="secondary" className="lg:mt-6">
            <Save className="h-4 w-4" aria-hidden="true" />
            Guardar nombre
          </Button>
        </form>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm text-muted">
            {Math.round(attachment.size_bytes / 1024)} KB · subida el {formatDateTime(attachment.created_at)}
          </p>
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
      </div>

      <InvoiceSummary parsedData={parsedData} status={extraction?.status} />
    </article>
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
    { icon: <Tag className="h-4 w-4" />, label: "Categoría", value: textValue(parsedData.categoria_name ?? parsedData.category_name) },
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function SelectFilter({
  label,
  name,
  value,
  items
}: {
  label: string;
  name: keyof InvoiceFilters;
  value?: string;
  items: LookupItem[];
}) {
  return (
    <Field label={label}>
      <select className="field" name={name} defaultValue={value ?? ""}>
        <option value="">{label}</option>
        {items.map((item) => (
          <option key={item.id} value={item.name}>
            {item.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function CategoryFilter({ items, value }: { items: LookupItem[]; value?: string }) {
  if (items.length === 0) {
    return (
      <Field label="Categoría">
        <input className="field" name="category" placeholder="Categoría" defaultValue={value ?? ""} />
      </Field>
    );
  }

  return <SelectFilter label="Categoría" name="category" value={value} items={items} />;
}

function hasInvoiceFilters(filters: InvoiceFilters) {
  return Object.values(filters).some(Boolean);
}

function categoryItems(groups: CustomListGroup[]) {
  const group = groups.find((candidate) => normalizeText(candidate.name).includes("categoria"));

  return (group?.custom_list_items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    active: item.active,
    created_at: item.created_at,
    sort_order: item.sort_order,
    color: item.color
  }));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
