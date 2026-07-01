"use client";

import { useActionState, useMemo, useState } from "react";
import { ChevronDown, FileText, Save, Wand2, X } from "lucide-react";
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
  categoria?: string;
  numero_factura?: string;
  fecha_factura?: string;
  importe_neto?: number | string | null;
  iva_factura?: number | string | null;
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
  const [categoria, setCategoria] = useState(incident?.categoria ?? initialSuggestions?.categoria ?? "");
  const [numeroFactura, setNumeroFactura] = useState(incident?.numero_factura ?? initialSuggestions?.numero_factura ?? "");
  const [fechaFactura, setFechaFactura] = useState(incident?.fecha_factura ?? initialSuggestions?.fecha_factura ?? "");
  const [importeNeto, setImporteNeto] = useState(
    incident?.importe_neto?.toString() ?? (initialSuggestions?.importe_neto != null ? String(initialSuggestions.importe_neto) : "")
  );
  const [ivaFactura, setIvaFactura] = useState(
    incident?.iva_factura?.toString() ?? (initialSuggestions?.iva_factura != null ? String(initialSuggestions.iva_factura) : "")
  );
  const [importeFactura, setImporteFactura] = useState(
    incident?.importe_factura?.toString() ?? (initialSuggestions?.importe_factura != null ? String(initialSuggestions.importe_factura) : "")
  );
  const [observaciones, setObservaciones] = useState(incident?.observaciones ?? "");
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
      const sumSuggestion = (key: "importe_factura" | "importe_neto" | "iva_factura") => successful.reduce((sum, item) => {
        const amount = item.suggestions[key];
        if (amount === undefined || amount === null) return sum;
        const parsed = Number(String(amount).replace(",", "."));
        return Number.isFinite(parsed) ? sum + parsed : sum;
      }, 0);
      const total = sumSuggestion("importe_factura");
      const totalNeto = sumSuggestion("importe_neto");
      const totalIva = sumSuggestion("iva_factura");

      const suggestedFecha = firstWith("fecha_incidencia");
      const suggestedLocal = firstWith("local_id");
      const suggestedResponsable = firstWith("responsable_id");
      const suggestedProveedor = firstWith("proveedor_id");
      const suggestedPrioridad = firstWith("prioridad_id");
      const suggestedEstado = firstWith("estado_id");
      const suggestedCategoria = firstWith("categoria");
      const suggestedNumeroFactura = firstWith("numero_factura");
      const suggestedFechaFactura = firstWith("fecha_factura");

      if (typeof suggestedFecha === "string") setFecha(suggestedFecha);
      if (typeof suggestedLocal === "string") setLocalId(suggestedLocal);
      if (suggestedZoneIds.length > 0) setZoneIds(suggestedZoneIds);
      if (typeof suggestedResponsable === "string") setResponsableId(suggestedResponsable);
      if (typeof suggestedProveedor === "string") setProveedorId(suggestedProveedor);
      if (typeof suggestedPrioridad === "string") setPrioridadId(suggestedPrioridad);
      if (typeof suggestedEstado === "string") setEstadoId(suggestedEstado);
      if (typeof suggestedCategoria === "string") setCategoria(suggestedCategoria);
      if (typeof suggestedNumeroFactura === "string") setNumeroFactura(suggestedNumeroFactura);
      if (typeof suggestedFechaFactura === "string") setFechaFactura(suggestedFechaFactura);
      if (descriptions.length > 0) {
        setDescripcion((current) => {
          const nextDescription = descriptions.join("\n\n---\n\n");
          return current.trim() ? `${current.trim()}\n\n--- Facturas añadidas ---\n${nextDescription}` : nextDescription;
        });
      }
      if (showAdmin && total !== 0) {
        setImporteFactura(String(Math.round(total * 100) / 100));
      }
      if (showAdmin && totalNeto !== 0) {
        setImporteNeto(String(Math.round(totalNeto * 100) / 100));
      }
      if (showAdmin && totalIva !== 0) {
        setIvaFactura(String(Math.round(totalIva * 100) / 100));
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
          <Field label="Categoria" htmlFor="categoria">
            <input
              className="field"
              id="categoria"
              name="categoria"
              value={categoria}
              onChange={(event) => setCategoria(event.target.value)}
              placeholder="Ej. Fontaneria"
            />
          </Field>
          <Field label="N factura" htmlFor="numero_factura">
            <input
              className="field"
              id="numero_factura"
              name="numero_factura"
              value={numeroFactura}
              onChange={(event) => setNumeroFactura(event.target.value)}
              placeholder="Numero de factura"
            />
          </Field>
          <Field label="Fecha factura" htmlFor="fecha_factura">
            <input
              className="field"
              id="fecha_factura"
              name="fecha_factura"
              type="date"
              value={fechaFactura}
              onChange={(event) => setFechaFactura(event.target.value)}
            />
          </Field>
          <Field label="Importe neto" htmlFor="importe_neto">
            <input
              className="field"
              id="importe_neto"
              name="importe_neto"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={importeNeto}
              onChange={(event) => setImporteNeto(event.target.value)}
              placeholder="Ej. -100.00"
            />
          </Field>
          <Field label="IVA" htmlFor="iva_factura">
            <input
              className="field"
              id="iva_factura"
              name="iva_factura"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={ivaFactura}
              onChange={(event) => setIvaFactura(event.target.value)}
              placeholder="Ej. -21.00"
            />
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
          <div className="sm:col-span-2">
            <Field label="Observaciones" htmlFor="observaciones">
              <textarea
                className="field min-h-24"
                id="observaciones"
                name="observaciones"
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
              />
            </Field>
          </div>
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
  const [query, setQuery] = useState("");
  const selectedItems = useMemo(
    () => items.filter((item) => selected.includes(item.id)),
    [items, selected]
  );
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;

    return items.filter((item) => item.name.toLowerCase().includes(normalizedQuery));
  }, [items, query]);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((value) => value !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="space-y-2">
      <details className="group">
        <summary className="field flex min-h-12 cursor-pointer list-none items-center justify-between gap-3">
          <span className="truncate">
            {selectedItems.length > 0 ? `${selectedItems.length} zona${selectedItems.length === 1 ? "" : "s"} seleccionada${selectedItems.length === 1 ? "" : "s"}` : "Selecciona zonas..."}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-2 rounded-md border border-border bg-white p-2 shadow-sm">
          <input
            className="field h-10"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar zona..."
          />
          <div className="mt-2 flex max-h-56 flex-col gap-1 overflow-auto pr-1">
            {filteredItems.map((item) => (
              <label key={item.id} className="flex min-h-10 items-center gap-2 rounded px-2 text-sm hover:bg-surface-subtle">
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={() => toggle(item.id)}
                />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
              </label>
            ))}
            {filteredItems.length === 0 ? <p className="px-2 py-3 text-sm text-muted">No hay zonas con ese nombre.</p> : null}
          </div>
        </div>
      </details>
      {selectedItems.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <span key={item.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-subtle px-2 py-1 text-xs font-medium text-slate-700">
              <span className="truncate">{item.name}</span>
              <button
                type="button"
                className="focus-ring rounded-full p-0.5 text-muted hover:text-danger"
                onClick={() => toggle(item.id)}
                aria-label={`Quitar ${item.name}`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {selected.length === 0 ? <p className="mt-2 text-xs text-danger">Selecciona al menos una zona.</p> : null}
    </div>
  );
}
