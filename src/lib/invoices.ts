import type { InvoiceParsedData, LookupItem } from "@/lib/types";

type Lookups = {
  locals: LookupItem[];
  zones: LookupItem[];
  responsables?: LookupItem[];
  providers: LookupItem[];
  priorities: LookupItem[];
  statuses: LookupItem[];
};

export type InvoiceSuggestion = {
  fecha_incidencia?: string;
  local_id?: string;
  zona_ids: string[];
  responsable_id?: string;
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

function normalizeLookupText(value: string) {
  return normalizeText(value)
    .replace(/\bii\b/g, "2")
    .replace(/\biii\b/g, "3")
    .replace(/\biv\b/g, "4")
    .replace(/\s+/g, " ")
    .trim();
}

function lookupAliases(value: string) {
  const normalized = normalizeLookupText(value);
  const beforeDash = normalizeLookupText(value.split("-")[0] ?? "");
  const withoutArticle = beforeDash.replace(/^(el|la|los|las)\s+/, "");
  const firstToken = withoutArticle.split(" ")[0] ?? "";
  const aliases = [normalized, beforeDash, withoutArticle];

  if (firstToken.length >= 5 && !["plaza", "parque"].includes(firstToken)) {
    aliases.push(firstToken);
  }

  return [...new Set(aliases.filter((alias) => alias.length >= 3))];
}

function normalizeDate(value?: string | null) {
  if (!value) return undefined;

  const text = value.trim().replace(/[\u2013\u2014]/g, "-");
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
    .replace(/[\u2013\u2014]/g, "-")
    .match(/\b\d{1,2}\s*-\s*[A-Za-z\u00C0-\u017F]+\s*-\s*20\d{2}\b/)?.[0]
    ?.replace(/-/g, " ");

  return normalizeDate(longDate);
}

function findInvoiceDate(text: string, parsedData: InvoiceParsedData) {
  const explicit = text.match(/fecha\s+factura\s*:\s*([^\n\t]+)/i)?.[1];
  return normalizeDate(explicit) ?? findFirstDate(text) ?? normalizeDate(parsedData.invoice_date) ?? normalizeDate(parsedData.fecha_incidencia);
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

function amountsInLine(line: string) {
  return (line.match(/-?\(?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\)?/g) ?? [])
    .map(parseInvoiceAmount)
    .filter((value): value is number => value != null);
}

function findAmountByLabel(text: string, label: RegExp) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const line = lines.find((candidate) => label.test(candidate));
  return amountsInLine(line ?? "").at(-1);
}

function findFinalEuroAmount(text: string) {
  const matches = [...text.matchAll(/(-?\(?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\)?)\s*(?:€|\u20ac)/g)];
  return parseInvoiceAmount(matches.at(-1)?.[1]);
}

function findSummaryVatLine(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  for (const line of [...lines].reverse()) {
    const amounts = amountsInLine(line);
    if (amounts.length === 3 && amounts[1] > 0 && amounts[1] <= 30) {
      return {
        baseAmount: amounts[0],
        vatRate: amounts[1],
        vatAmount: amounts[2]
      };
    }
  }

  return {};
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

function findInvoiceTotals(text: string, parsedData: InvoiceParsedData) {
  const summary = findSummaryVatLine(text);
  const baseAmount = findAmountByLabel(text, /^total\s+importe\b/i) ?? parseInvoiceAmount(parsedData.invoice_base_amount) ?? summary.baseAmount;
  const vatRate = parsedData.vat_rate?.toString() ?? findVatRate(text) ?? (summary.vatRate != null ? String(summary.vatRate) : undefined);
  const vatAmount = findAmountByLabel(text, /^i\.?\s*v\.?\s*a\.?/i) ?? parseInvoiceAmount(parsedData.vat_amount) ?? summary.vatAmount;
  const totalAmount =
    findAmountByLabel(text, /^total\s+factura\b/i) ??
    findAmountByLabel(text, /^total\s+a\s+pagar\b/i) ??
    findFinalEuroAmount(text) ??
    parseInvoiceAmount(parsedData.importe_factura ?? parsedData.total_amount) ??
    findFirstAmount(text);

  return { baseAmount, vatRate, vatAmount, totalAmount };
}

function findLookupId(items: LookupItem[], haystack: string, explicitName?: string | null) {
  const explicit = explicitName ? normalizeLookupText(explicitName) : "";
  const normalizedHaystack = normalizeLookupText(haystack);

  return items.find((item) => {
    const aliases = lookupAliases(item.name);
    return aliases.some((alias) =>
      explicit === alias
      || explicit.includes(alias)
      || normalizedHaystack.includes(alias)
    );
  })?.id;
}

function findLookupIds(items: LookupItem[], haystack: string, explicitNames: string[] = []) {
  const normalizedHaystack = normalizeLookupText(haystack);
  const explicit = explicitNames.map(normalizeLookupText).filter(Boolean);

  return items
    .filter((item) => {
      const aliases = lookupAliases(item.name);
      return aliases.some((alias) =>
        normalizedHaystack.includes(alias)
        || explicit.some((value) => value === alias || value.includes(alias))
      );
    })
    .map((item) => item.id);
}

function findPendingLookupId(items: LookupItem[] = []) {
  return items.find((item) => normalizeText(item.name).includes("pendiente"))?.id;
}

function cleanProviderName(value?: string | null) {
  return value
    ?.replace(/\s+CIF\b.*$/i, "")
    .replace(/\s+Fra\w*.*$/i, "")
    .replace(/\s+F\d+.*$/i, "")
    .replace(/^[\s.\-0-9]+/, "")
    .trim();
}

function guessProviderFromFileName(fileName: string) {
  const base = fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  const providerBeforeInvoice = base.match(/(?:^|\s)\d+[.,]?\s+(.+?)\s+(?:fra|factura|f\d+)/i)?.[1];
  const cleaned = cleanProviderName(providerBeforeInvoice || base);
  const tokens = cleaned?.split(/\s+/).filter(Boolean) ?? [];

  if (tokens.length > 1) return tokens.slice(0, 4).join(" ");

  const provider = tokens.find((token) => /[a-z]/i.test(token) && !/^\d+[.,]?$/.test(token));
  return provider?.replace(/[^\p{L}\p{N}.&]/gu, "") || null;
}

function findProviderName(rawText: string, parsedData: InvoiceParsedData, fileName: string) {
  const parsedProvider = cleanProviderName(parsedData.proveedor_name);
  if (parsedProvider && !/brasa\s+y\s+le/i.test(parsedProvider)) return parsedProvider;

  const footerProvider = rawText.match(/^(.+?\s+(?:S\.?A\.?|S\.?L\.?))\s+CIF\b/im)?.[1];
  return cleanProviderName(footerProvider) || guessProviderFromFileName(fileName);
}

function findInvoiceNumber(text: string, parsedData: InvoiceParsedData) {
  if (parsedData.invoice_number) return parsedData.invoice_number.trim();

  const inline = text.match(/(?:n[ºo]\s*)?factura\s*:\s*([^\n\t]+)/i)?.[1]?.trim();
  if (inline) return inline.split(/\s{2,}|\t|fecha\s+factura/i)[0]?.trim();

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const index = lines.findIndex((line) => normalizeText(line) === "factura");
  if (index >= 0 && lines[index + 1]) return lines[index + 1];

  return text.match(/\bfactura\b\s*[:#-]?\s*([A-Z]?\s*-?\s*\d+(?:\/20\d{2})?)/i)?.[1]?.trim();
}

function extractConceptBlock(text: string, parsedData: InvoiceParsedData) {
  const parsedConcept = parsedData.concept?.trim();
  if (parsedConcept) return parsedConcept;

  const normalized = text.replace(/\r/g, "");
  const start = normalized.search(/c\s*o\s*n\s*c\s*e\s*p\s*t\s*o[\s\S]{0,40}importe/i);
  if (start < 0) return undefined;

  const afterHeader = normalized.slice(start).replace(/^.*?importe\s*(?:\[€\])?\s*/i, "");
  const end = afterHeader.search(/\n\s*fecha\s*\n/i);
  const concept = (end >= 0 ? afterHeader.slice(0, end) : afterHeader)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line))
    .join("\n")
    .trim();

  return concept || undefined;
}

function extractInvoiceLines(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\t+/g, " ").replace(/\s{2,}/g, " ").trim());
  const start = lines.findIndex((line) => normalizeText(line).startsWith("albaran"));
  const relevant = start >= 0 ? lines.slice(start) : lines;
  const selected: string[] = [];

  for (const line of relevant) {
    const normalized = normalizeText(line);
    if (!line || selected.includes(line)) continue;
    if (/^--/.test(line) || /^\d{5}\s/.test(line)) continue;
    if (/^(pagina|codigo descripcion|base imponible|forma de pago|suma|pagare|iban|vencimientos|ferreteria|--)/i.test(normalized)) continue;
    if (/^(recogido por|cod cliente|brasa y lena|c i f|paseo|madrid|pozuelo)/i.test(normalized)) continue;
    if (/^n factura|^fecha factura/.test(normalized)) continue;
    if (/^\d+[.,]\d{2}\s+\d+[.,]\d{2}\s+\d+[.,]\d{2}$/.test(line)) continue;

    if (
      normalized.startsWith("albaran") ||
      /^\*\s+/.test(line) ||
      /\b(unid|neto|roll|par|pz|ud)\b/i.test(normalized) ||
      (selected.length > 0 && !/^\d+[.,]\d{2}\s*/.test(line))
    ) {
      selected.push(line);
    }

    if (selected.length >= 35) {
      selected.push("...");
      break;
    }
  }

  return selected.join("\n").trim() || undefined;
}

function extractConcept(text: string, parsedData: InvoiceParsedData) {
  return extractConceptBlock(text, parsedData) || extractInvoiceLines(text) || parsedData.descripcion?.trim();
}

function findLocalName(text: string, parsedData: InvoiceParsedData) {
  if (parsedData.local_name) return parsedData.local_name;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => /brasa\s+y\s+le/i.test(line) && !/espa/i.test(line) && !/c\.?i\.?f/i.test(line));
}

function formatEuro(value?: number) {
  if (value == null) return undefined;
  return `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} €`;
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
  const invoiceDate = findInvoiceDate(rawText, parsedData);
  const concept = extractConcept(rawText, parsedData);
  const provider = findProviderName(rawText, parsedData, fileName);
  const localName = findLocalName(rawText, parsedData);
  const totals = findInvoiceTotals(rawText, parsedData);
  const lines = [
    invoiceNumber ? `Factura: ${invoiceNumber}` : null,
    invoiceDate ? `Fecha factura: ${invoiceDate}` : null,
    provider ? `Proveedor: ${provider}` : null,
    localName ? `Local: ${localName}` : null,
    concept ? `Concepto:\n${concept}` : null,
    totals.baseAmount != null ? `Base imponible: ${formatEuro(totals.baseAmount)}` : null,
    totals.vatAmount != null ? `IVA${totals.vatRate ? ` (${totals.vatRate}%)` : ""}: ${formatEuro(totals.vatAmount)}` : null,
    totals.totalAmount != null ? `Total factura: ${formatEuro(totals.totalAmount)}` : null
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
  const providerName = findProviderName(rawText, parsedData, fileName);
  const haystack = `${fileName}\n${rawText}\n${providerName ?? ""}\n${JSON.stringify(parsedData)}`;
  const zonaIds = findLookupIds(lookups.zones, haystack, parsedData.zona_names ?? []);
  const pendingZoneId = findPendingLookupId(lookups.zones);
  const totals = findInvoiceTotals(rawText, parsedData);

  return {
    fecha_incidencia: findInvoiceDate(rawText, parsedData),
    local_id: findLookupId(lookups.locals, haystack, parsedData.local_name) ?? findPendingLookupId(lookups.locals),
    zona_ids: zonaIds.length > 0 ? zonaIds : pendingZoneId ? [pendingZoneId] : [],
    responsable_id: findPendingLookupId(lookups.responsables),
    descripcion: buildDescription({ fileName, rawText, parsedData }),
    proveedor_id: findLookupId(lookups.providers, haystack, providerName ?? parsedData.proveedor_name) ?? findPendingLookupId(lookups.providers),
    prioridad_id: findLookupId(lookups.priorities, haystack, parsedData.prioridad_name),
    importe_factura: totals.totalAmount,
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
