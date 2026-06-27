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
  descripcion?: string;
  proveedor_id?: string;
  prioridad_id?: string;
  estado_id?: string;
};

export function IncidentForm({
  profile,
  lookups,
  incident,
  action,
  submitLabel
}: {
  profile: Profile;
  lookups: Lookups;
  incident?: Incident | null;
  action: (state: IncidentFormState, formData: FormData) => Promise<IncidentFormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const showAdmin = canSeePremiumFields(profile.role);
  const initialZoneIds = useMemo(() => {
    const related = incident?.incident_zones?.map((item) => item.zona_id).filter(Boolean) ?? [];
    return related.length > 0 ? related : incident?.zona_id ? [incident.zona_id] : [];
  }, [incident]);

  const [fecha, setFecha] = useState(incident?.fecha_incidencia ?? "");
  const [localId, setLocalId] = useState(incident?.local_id ?? "");
  const [zoneIds, setZoneIds] = useState<string[]>(initialZoneIds);
  const [responsableId, setResponsableId] = useState(incident?.responsable_aviso_id ?? "");
  const [descripcion, setDescripcion] = useState(incident?.descripcion ?? "");
  const [proveedorId, setProveedorId] = useState(incident?.proveedor_id ?? "");
  const [prioridadId, setPrioridadId] = useState(incident?.prioridad_id ?? "");
  const [fechaResolucion, setFechaResolucion] = useState(incident?.fecha_resolucion ?? "");
  const [estadoId, setEstadoId] = useState(incident?.estado_id ?? "");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<string>("");
  const [invoiceError, setInvoiceError] = useState<string>("");
  const [attachments, setAttachments] = useState<IncidentAttachment[]>(incident?.incident_attachments ?? []);
  const [readingInvoice, setReadingInvoice] = useState(false);

  async function readInvoice() {
    if (!invoiceFile) {
      setInvoiceError("Adjunta primero una factura PDF.");
      return;
    }

    setReadingInvoice(true);
    setInvoiceError("");
    setInvoiceStatus("Leyendo factura...");

    const payload = new FormData();
    payload.set("invoice", invoiceFile);
    const response = await fetch("/api/invoices/extract", {
      method: "POST",
      body: payload
    });
    const result = await response.json();

    setReadingInvoice(false);

    if (!response.ok) {
      setInvoiceStatus("");
      setInvoiceError(result.message || "No se ha podido leer la factura.");
      return;
    }

    const suggestions = (result.suggestions || {}) as Suggestions;
    if (suggestions.fecha_incidencia) setFecha(suggestions.fecha_incidencia);
    if (suggestions.local_id) setLocalId(suggestions.local_id);
    if (suggestions.zona_ids?.length) setZoneIds(suggestions.zona_ids);
    if (suggestions.descripcion) setDescripcion(suggestions.descripcion);
    if (suggestions.proveedor_id) setProveedorId(suggestions.proveedor_id);
    if (suggestions.prioridad_id) setPrioridadId(suggestions.prioridad_id);
    if (suggestions.estado_id) setEstadoId(suggestions.estado_id);

    setAttachments((current) => [...current, result.attachment]);
    setInvoiceStatus("Factura leida. Revisa los datos antes de guardar.");
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
            <p className="text-xs text-muted">Adjunta un PDF para rellenar datos automaticamente. Revisa siempre antes de guardar.</p>
          </div>
          <Button type="button" variant="secondary" onClick={readInvoice} disabled={readingInvoice}>
            <Wand2 className="h-4 w-4" aria-hidden="true" />
            {readingInvoice ? "Leyendo..." : "Leer factura"}
          </Button>
        </div>
        <input
          className="field"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => setInvoiceFile(event.target.files?.[0] ?? null)}
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
