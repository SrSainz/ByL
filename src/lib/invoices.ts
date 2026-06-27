import type { InvoiceParsedData, LookupItem } from "@/lib/types";

type Lookups = {
  locals: LookupItem[];
  zones: LookupItem[];
  providers: LookupItem[];
  priorities: LookupItem[];
  statuses: LookupItem[];
};

export type InvoiceSuggestion = {
  fecha_incidencia?: string;
  local_id?: string;
  zona_ids: string[];
  descripcion?: string;
  proveedor_id?: string;
  prioridad_id?: string;
  estado_id?: string;
};

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeDate(value?: string | null) {
  if (!value) return undefined;
  const text = value.trim();
  const iso = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const spanish = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (spanish) return `${spanish[3]}-${spanish[2].padStart(2, "0")}-${spanish[1].padStart(2, "0")}`;
  return undefined;
}

function findFirstDate(text: string) {
  return normalizeDate(text.match(/\b(?:20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2})\b/)?.[0]);
}

function findLookupId(items: LookupItem[], haystack: string, explicitName?: string | null) {
  const explicit = explicitName ? normalizeText(explicitName) : "";
  const normalizedHaystack = normalizeText(haystack);

  return items.find((item) => {
    const name = normalizeText(item.name);
    return Boolean(name && (explicit === name || explicit.includes(name) || normalizedHaystack.includes(name)));
  })?.id;
}

function findLookupIds(items: LookupItem[], haystack: string, explicitNames: string[] = []) {
  const normalizedHaystack = normalizeText(haystack);
  const explicit = explicitNames.map(normalizeText).filter(Boolean);

  return items
    .filter((item) => {
      const name = normalizeText(item.name);
      return Boolean(name && (normalizedHaystack.includes(name) || explicit.some((value) => value === name || value.includes(name))));
    })
    .map((item) => item.id);
}

export function buildInvoiceSuggestion({
  fileName,
  rawText,
  parsedData,
  lookups
}: {
  fileName: string;
  rawText: string;
  parsedData: InvoiceParsedData;
  lookups: Lookups;
}): InvoiceSuggestion {
  const haystack = `${fileName}\n${rawText}\n${JSON.stringify(parsedData)}`;
  const zonaIds = findLookupIds(lookups.zones, haystack, parsedData.zona_names ?? []);

  return {
    fecha_incidencia: normalizeDate(parsedData.fecha_incidencia) ?? normalizeDate(parsedData.invoice_date) ?? findFirstDate(haystack),
    local_id: findLookupId(lookups.locals, haystack, parsedData.local_name),
    zona_ids: zonaIds,
    descripcion: parsedData.descripcion || fileName.replace(/\.pdf$/i, "").replaceAll("_", " ").slice(0, 500),
    proveedor_id: findLookupId(lookups.providers, haystack, parsedData.proveedor_name),
    prioridad_id: findLookupId(lookups.priorities, haystack, parsedData.prioridad_name),
    estado_id: findLookupId(lookups.statuses, haystack, parsedData.estado_name)
  };
}

export function safeFileName(name: string) {
  return name
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 160) || "factura.pdf";
}
