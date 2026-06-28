"use client";

import { useActionState, useMemo, useState } from "react";
import { FileText, Save, Wand2 } from "lucide-react";
import type { Incident, IncidentAttachment, LookupItem, Profile } from "@/lib/types";
import { canSeePremiumFields } from "@/lib/permissions";
import type { IncidentFormState } from "@/app/actions/incidents";
import { Button } from "@/components/ui/button";

type Lookups = {
  locals: LookupItem[];
  zones: LookupItem[];
  responsables: LookupItem[];
  providers: LookupItem[];
  priorities: LookupItem[];
  statuses: LookupItem[];
};

type Suggestions = {
  fecha_incidencia?: string;
  local_id?: string;
  zona_ids?: string[];
  responsable_id?: string;
  descripcion?: string;
  proveedor_id?: string;
  prioridad_id?: string;
  importe_factura?: number | string | null;
  estado_id?: string;
};

export function IncidentForm({
  profile,
  lookups,
  incident,
  action,
  submitLabel,
  initialSuggestions,
  initialAttachments
}: {
  profile: Profile;
  lookups: Lookups;
  incident?: Incident | null;
  action: (state: IncidentFormState, formData: FormData) => Promise<IncidentFormState>;
  submitLabel: string;
  initialSuggestions?: Suggestions;
  initialAttachments?: IncidentAttachment[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const showAdmin = canSeePremiumFields(profile.role);
  const initialZoneIds = useMemo(() => {
    const related = incident?.incident_zones?.map((item) => item.zona_id).filter(Boolean) ?? [];
    if (related.length > 0) return related;
    if (incident?.zona_id) return [incident.zona_id];
    return initialSuggestions?.zona_ids ?? [];
  }, [incident, initialSuggestions]);

  const [fecha, setFecha] = useState(incident?.fecha_incidencia ?? initialSuggestions?.fecha_incidencia ?? "");
  const [localId, setLocalId] = useState(incident?.local_id ?? initialSuggestions?.local_id ?? "");
  const [zoneIds, setZoneIds] = useState<string[]>(initialZoneIds);
  const [responsableId, setResponsableId] = useState(incident?.responsable_aviso_id ?? initialSuggestions?.responsable_id ?? "");
  const [descripcion, setDescripcion] = useState(incident?.descripcion ?? initialSuggestions?.descripcion ?? "");
  const [proveedorId, setProveedorId] = useState(incident?.proveedor_id ?? initialSuggestions?.proveedor_id ?? "");
  const [prioridadId, setPrioridadId] = useState(incident?.prioridad_id ?? initialSuggestions?.prioridad_id ?? "");
  const [importeFactura, setImporteFactura] = useState(
    incident?.importe_factura?.toString() ?? (initialSuggestions?.importe_factura != null ? String(initialSuggestions.importe_factura) : "")
  );
  const [fechaResolucion, setFechaResolucion] = useState(incident?.fecha_resolucion ?? "");
  const [estadoId, setEstadoId] = useState(incident?.estado_id ?? initialSuggestions?.estado_id ?? "");
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [invoiceStatus, setInvoiceStatus] = useState<string>("");
  const [invoiceError, setInvoiceError] = useState<string>("");
  const [attachments, setAttachments] = useState<IncidentAttachment[]>([
    ...(incident?.incident_attachments ?? []),
    ...(initialAttachments ?? [])
  ]);
  const [readingInvoice, setReadingInvoice] = useState(false);

  async function readInvoice() {
    if (invoiceFiles.length === 0) {
      setInvoiceError("Adjunta primero una o varias facturas PDF.");
      return;
    }

    setReadingInvoice(true);
    setInvoiceError("");
    setInvoiceStatus(`Analizando ${invoiceFiles.length} factura${invoiceFiles.length === 1 ? "" : "s"}...`);

    const successful: Array<{ attachment: IncidentAttachment; suggestions: Suggestions }> = [];
    const failed: string[] = [];

    for (const file of invoiceFiles) {
      const payload = new FormData();
      payload.set("invoice", file);
      const response = await fetch("/api/invoices/extract", {
        method: "POST",
        body: payload
      });
      const result = await response.json();

      if (!response.ok) {
        failed.push(`${file.name}: ${result.message || "no se ha podido analizar"}`);
      } else {
        successful.push({
          attachment: result.attachment,
          suggestions: (result.suggestions || {}) as Suggestions
        });
      }
    }

    setReadingInvoice(false);

    if (successful.length > 0) {
      const firstWith = <K extends keyof Suggestions>(key: K) =>
        successful.map((item) => item.suggestions[key]).find((value) => {
          if (Array.isArray(value)) return value.length > 0;
          return value !== undefined && value !== null && value !== "";
        });
      const suggestedZoneIds = [
        ...new Set(successful.flatMap((item) => item.suggestions.zona_ids ?? []))
      ];
      const descriptions = successful.map((item) => item.suggestions.descripcion).filter(Boolean);
      const total = successful.reduce((sum, item) => {
        const amount = item.suggestions.importe_factura;
        if (amount === undefined || amount === null) return sum;
        const parsed = Number(String(amount).replace(",", "."));
        return Number.isFinite(parsed) ? sum + parsed : sum;
      }, 0);

      const suggestedFecha = firstWith("fecha_incidencia");
      const suggestedLocal = firstWith("local_id");
      const suggestedResponsable = firstWith("responsable_id");
      const suggestedProveedor = firstWith("proveedor_id");
      const suggestedPrioridad = firstWith("prioridad_id");
      const suggestedEstado = firstWith("estado_id");

      if (typeof suggestedFecha === "string") setFecha(suggestedFecha);
      if (typeof suggestedLocal === "string") setLocalId(suggestedLocal);
      if (suggestedZoneIds.length > 0) setZoneIds(suggestedZoneIds);
      if (typeof suggestedResponsable === "string") setResponsableId(suggestedResponsable);
      if (typeof suggestedProveedor === "string") setProveedorId(suggestedProveedor);
      if (typeof suggestedPrioridad === "string") setPrioridadId(suggestedPrioridad);
      if (typeof suggestedEstado === "string") setEstadoId(suggestedEstado);
      if (descriptions.length > 0) {
        setDescripcion((current) => {
          const nextDescription = descriptions.join("\n\n---\n\n");
          return current.trim() ? `${current.trim()}\n\n--- Facturas añadidas ---\n${nextDescription}` : nextDescription;
        });
      }
      if (showAdmin && total !== 0) {
        setImporteFactura(String(Math.round(total * 100) / 100));
      }
      setAttachments((current) => {
        const known = new Set(current.map((attachment) => attachment.id));
        return [...current, ...successful.map((item) => item.attachment).filter((attachment) => !known.has(attachment.id))];
      });
    }

    setInvoiceStatus(successful.length > 0 ? `${successful.length} factura${successful.length === 1 ? "" : "s"} analizada${successful.length === 1 ? "" : "s"} y guardada${successful.length === 1 ? "" : "s"}.` : "");
    setInvoiceError(failed.length > 0 ? failed.join("\n") : "");
  }

  return (
    <form action={formAction} className="space-y-5 rounded-lg border border-border bg-white p-4 sm:p-6" data-tour="incident-form">
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </div>
      ) : null}

      <section className="space-y-3 rounded-md border border-dashed border-border bg-surface-subtle p-4" data-tour="invoice-upload">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Factura</h3>
            <p className="text-xs text-muted">Adjunta uno o varios PDF para guardarlos y rellenar datos automaticamente. Revisa siempre antes de guardar.</p>
          </div>
          <Button type="button" variant="secondary" onClick={readInvoice} disabled={readingInvoice}>
            <Wand2 className="h-4 w-4" aria-hidden="true" />
            {readingInvoice ? "Analizando..." : "Analizar facturas"}
          </Button>
        </div>
        <input
          className="field"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={(event) => setInvoiceFiles(Array.from(event.target.files ?? []))}
        />
        {invoiceStatus ? <p className="text-sm text-success">{invoiceStatus}</p> : null}
        {invoiceError ? <p className="text-sm text-danger">{invoiceError}</p> : null}
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <a
                key={attachment.id}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                href={`/api/invoices/${attachment.id}/download`}
                rel="noreferrer"
                target="_blank"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                {attachment.file_name}
              </a>
            ))}
          </div>
        ) : null}
      </section>

      {attachments.map((attachment) => (
        <input key={attachment.id} type="hidden" name="attachment_ids" value={attachment.id} />
      ))}
      {zoneIds.map((id) => (
        <input key={id} type="hidden" name="zona_ids" value={id} />
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha de incidencia" htmlFor="fecha_incidencia" required>
          <input
            className="field"
            id="fecha_incidencia"
            name="fecha_incidencia"
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
            required
          />
        </Field>
        <Field label="Local" htmlFor="local_id" required>
          <Select id="local_id" name="local_id" items={lookups.locals} value={localId} onChange={(event) => setLocalId(event.target.value)} required />
        </Field>
        <Field label="Zonas / areas" htmlFor="zona_ids" required>
          <ZonePicker items={lookups.zones} selected={zoneIds} onChange={setZoneIds} />
        </Field>
        <Field label="Responsable del aviso" htmlFor="responsable_aviso_id" required>
          <Select
            id="responsable_aviso_id"
            name="responsable_aviso_id"
            items={lookups.responsables}
            value={responsableId}
            onChange={(event) => setResponsableId(event.target.value)}
            required
          />
        </Field>
      </div>

      <Field label="Descripcion" htmlFor="descripcion" required>
        <textarea
          className="field min-h-32"
          id="descripcion"
          name="descripcion"
          value={descripcion}
          onChange={(event) => setDescripcion(event.target.value)}
          required
        />
      </Field>

      {showAdmin ? (
        <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <Field label="Proveedor" htmlFor="proveedor_id">
            <Select id="proveedor_id" name="proveedor_id" items={lookups.providers} value={proveedorId} onChange={(event) => setProveedorId(event.target.value)} />
          </Field>
          <Field label="Prioridad" htmlFor="prioridad_id">
            <Select id="prioridad_id" name="prioridad_id" items={lookups.priorities} value={prioridadId} onChange={(event) => setPrioridadId(event.target.value)} />
          </Field>
          <Field label="Importe factura" htmlFor="importe_factura">
            <input
              className="field"
              id="importe_factura"
              name="importe_factura"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={importeFactura}
              onChange={(event) => setImporteFactura(event.target.value)}
              placeholder="Ej. -125.50"
            />
          </Field>
          <Field label="Fecha de resolucion" htmlFor="fecha_resolucion">
            <input
              className="field"
              id="fecha_resolucion"
              name="fecha_resolucion"
              type="date"
              value={fechaResolucion}
              onChange={(event) => setFechaResolucion(event.target.value)}
            />
          </Field>
          <Field label="Estado" htmlFor="estado_id">
            <Select id="estado_id" name="estado_id" items={lookups.statuses} value={estadoId} onChange={(event) => setEstadoId(event.target.value)} />
          </Field>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {pending ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function Select({
  items,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  items: LookupItem[];
}) {
  return (
    <select className="field" {...props}>
      <option value="">Selecciona...</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  );
}

function ZonePicker({
  items,
  selected,
  onChange
}: {
  items: LookupItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((value) => value !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="rounded-md border border-border bg-white p-2">
      <div className="flex max-h-40 flex-col gap-1 overflow-auto">
        {items.map((item) => (
          <label key={item.id} className="flex min-h-9 items-center gap-2 rounded px-2 text-sm hover:bg-surface-subtle">
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => toggle(item.id)}
            />
            {item.name}
          </label>
        ))}
      </div>
      {selected.length === 0 ? <p className="mt-2 text-xs text-danger">Selecciona al menos una zona.</p> : null}
    </div>
  );
}
