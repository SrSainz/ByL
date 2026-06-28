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
  importe_factura?: number;
  estado_id?: string;
};

const months: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12"
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

  const text = value.trim().replace(/[–—]/g, "-");
  const iso = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const spanish = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (spanish) return `${spanish[3]}-${spanish[2].padStart(2, "0")}-${spanish[1].padStart(2, "0")}`;

  const longSpanish = normalizeText(text).match(
    /\b(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(20\d{2})\b/
  );
  if (longSpanish) return `${longSpanish[3]}-${months[longSpanish[2]]}-${longSpanish[1].padStart(2, "0")}`;

  return undefined;
}

function findFirstDate(text: string) {
  const compactDate = text.match(/\b(?:20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2})\b/)?.[0];
  if (compactDate) return normalizeDate(compactDate);

  const longDate = text
    .replace(/[–—]/g, "-")
    .match(/\b\d{1,2}\s*-\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\s*-\s*20\d{2}\b/)?.[0]
    ?.replace(/-/g, " ");

  return normalizeDate(longDate);
}

export function parseInvoiceAmount(value?: string | number | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (!value) return undefined;

  const compact = value
    .replace(/\s+/g, "")
    .replace(/[^\d,.\-()]/g, "");
  const isNegative = compact.startsWith("-") || (compact.startsWith("(") && compact.endsWith(")"));
  const normalized = compact
    .replace(/[()]/g, "")
    .replace(/^-/, "");
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);
  const integerPart = decimalIndex >= 0 ? normalized.slice(0, decimalIndex).replace(/[,.]/g, "") : normalized.replace(/[,.]/g, "");
  const decimalPart = decimalIndex >= 0 ? normalized.slice(decimalIndex + 1).replace(/[,.]/g, "") : "";
  const parsed = Number(`${isNegative ? "-" : ""}${integerPart || "0"}${decimalPart ? `.${decimalPart}` : ""}`);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function findAmountByLabel(text: string, label: RegExp) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const line = lines.find((candidate) => label.test(candidate));
  const amount = line?.match(/-?\(?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\)?/g)?.at(-1);
  return parseInvoiceAmount(amount);
}

function findFirstAmount(text: string) {
  const refund = text.match(/\b(?:abono|devoluci[oó]n|rectificativa|a devolver)\b[\s\S]{0,80}?(-?\(?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\)?)/i);
  const total = refund?.[1] ?? text.match(/\btotal(?:\s+factura)?\b[\s\S]{0,80}?(-?\(?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\)?)/i)?.[1];
  return parseInvoiceAmount(total);
}

function findVatRate(text: string) {
  const match = text.match(/i\.?\s*v\.?\s*a\.?\s*\(\s*(\d{1,2}(?:[.,]\d+)?)\s*%\s*\)/i);
  return match?.[1]?.replace(",", ".");
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

function findPendingLookupId(items: LookupItem[]) {
  return items.find((item) => normalizeText(item.name).includes("pendiente"))?.id;
}

function guessProviderFromFileName(fileName: string) {
  const base = fileName
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  const providerBeforeInvoice = base.match(/\b\d+[.,]?\s+\d+\s+(.+?)\s+F\d+/i)?.[1];
  const tokens = (providerBeforeInvoice || base).split(/\s+/).filter(Boolean);
  const provider = tokens.find((token) => /[a-z]/i.test(token) && !/^\d+[.,]?$/.test(token));

  return provider?.replace(/[^\p{L}\p{N}.&]/gu, "") || null;
}

function findInvoiceNumber(text: string, parsedData: InvoiceParsedData) {
  if (parsedData.invoice_number) return parsedData.invoice_number.trim();

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const index = lines.findIndex((line) => normalizeText(line) === "factura");
  if (index >= 0 && lines[index + 1]) return lines[index + 1];

  return text.match(/\bfactura\b\s*[:#-]?\s*([A-Z]?\s*-?\s*\d+\/20\d{2})/i)?.[1]?.trim();
}

function extractConcept(text: string, parsedData: InvoiceParsedData) {
  const parsedConcept = parsedData.concept?.trim();
  if (parsedConcept) return parsedConcept;

  const normalized = text.replace(/\r/g, "");
  const start = normalized.search(/c\s*o\s*n\s*c\s*e\s*p\s*t\s*o[\s\S]{0,40}importe/i);
  if (start < 0) return parsedData.descripcion?.trim();

  const afterHeader = normalized.slice(start).replace(/^.*?importe\s*(?:\[€\])?\s*/i, "");
  const end = afterHeader.search(/\n\s*fecha\s*\n/i);
  const concept = (end >= 0 ? afterHeader.slice(0, end) : afterHeader)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line))
    .join("\n")
    .trim();

  return concept || parsedData.descripcion?.trim();
}

function findLocalName(text: string, parsedData: InvoiceParsedData) {
  if (parsedData.local_name) return parsedData.local_name;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => /brasa\s+y\s+le/i.test(line) && !/espa/i.test(line) && !/c\.?i\.?f/i.test(line));
}

function formatEuro(value?: number) {
  if (value == null) return undefined;
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " €";
}

function buildDescription({
  fileName,
  rawText,
  parsedData
}: {
  fileName: string;
  rawText: string;
  parsedData: InvoiceParsedData;
}) {
  const invoiceNumber = findInvoiceNumber(rawText, parsedData);
  const invoiceDate = normalizeDate(parsedData.fecha_incidencia) ?? normalizeDate(parsedData.invoice_date) ?? findFirstDate(rawText);
  const concept = extractConcept(rawText, parsedData);
  const provider = parsedData.proveedor_name || guessProviderFromFileName(fileName);
  const localName = findLocalName(rawText, parsedData);
  const baseAmount = parseInvoiceAmount(parsedData.invoice_base_amount) ?? findAmountByLabel(rawText, /^total\s+importe\b/i);
  const vatRate = parsedData.vat_rate?.toString() ?? findVatRate(rawText);
  const vatAmount = parseInvoiceAmount(parsedData.vat_amount) ?? findAmountByLabel(rawText, /^i\.?\s*v\.?\s*a\.?/i);
  const totalAmount =
    parseInvoiceAmount(parsedData.importe_factura ?? parsedData.total_amount) ??
    findAmountByLabel(rawText, /^total\s+factura\b/i) ??
    findFirstAmount(rawText);
  const lines = [
    invoiceNumber ? `Factura: ${invoiceNumber}` : null,
    invoiceDate ? `Fecha factura: ${invoiceDate}` : null,
    provider ? `Proveedor: ${provider}` : null,
    localName ? `Local: ${localName}` : null,
    concept ? `Concepto:\n${concept}` : null,
    baseAmount != null ? `Base imponible: ${formatEuro(baseAmount)}` : null,
    vatAmount != null ? `IVA${vatRate ? ` (${vatRate}%)` : ""}: ${formatEuro(vatAmount)}` : null,
    totalAmount != null ? `Total factura: ${formatEuro(totalAmount)}` : null
  ].filter(Boolean);

  return lines.length > 0 ? lines.join("\n") : fileName.replace(/\.pdf$/i, "").replaceAll("_", " ").slice(0, 500);
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
  const pendingZoneId = findPendingLookupId(lookups.zones);
  const totalAmount =
    parseInvoiceAmount(parsedData.importe_factura ?? parsedData.total_amount) ??
    findAmountByLabel(rawText, /^total\s+factura\b/i) ??
    findFirstAmount(haystack);

  return {
    fecha_incidencia: normalizeDate(parsedData.fecha_incidencia) ?? normalizeDate(parsedData.invoice_date) ?? findFirstDate(haystack),
    local_id: findLookupId(lookups.locals, haystack, parsedData.local_name) ?? findPendingLookupId(lookups.locals),
    zona_ids: zonaIds.length > 0 ? zonaIds : pendingZoneId ? [pendingZoneId] : [],
    descripcion: buildDescription({ fileName, rawText, parsedData }),
    proveedor_id: findLookupId(lookups.providers, haystack, parsedData.proveedor_name),
    prioridad_id: findLookupId(lookups.priorities, haystack, parsedData.prioridad_name),
    importe_factura: totalAmount,
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
