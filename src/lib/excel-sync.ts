import { createHash } from "node:crypto";
import { readSheet } from "read-excel-file/node";
import writeExcelFile from "write-excel-file/node";
import type { CellObject, Sheet } from "write-excel-file/node";
import { createClient } from "@/lib/supabase/server";
import type { CustomListGroup, Incident, LookupItem, LookupTable, Profile } from "@/lib/types";

type CellValue = string | number | boolean | Date | null | undefined;
type SheetRow = CellValue[];
type LookupMaps = Record<LookupTable, Map<string, LookupItem>>;

export type ExcelIncidentRow = {
  appId?: string;
  syncKey: string;
  local: string;
  fechaAviso?: string;
  categoria?: string;
  zonas: string[];
  descripcion: string;
  responsable: string;
  proveedor?: string;
  prioridad?: string;
  estado?: string;
  fechaArreglo?: string;
  numeroFactura?: string;
  fechaFactura?: string;
  importeNeto?: number;
  totalIva?: number;
  ivaFactura?: number;
  fechaModificacion?: string;
  observaciones?: string;
  urgent: boolean;
};

export type ExcelImportSummary = {
  rowsTotal: number;
  rowsCreated: number;
  rowsUpdated: number;
  rowsSkipped: number;
  urgentCount: number;
  saved: boolean;
  errors: string[];
};

const excelHeaders = [
  "Local",
  "Fecha aviso",
  "Categoria",
  "Zona / area",
  "Descripcion",
  "Responsable",
  "Proveedor",
  "Prioridad",
  "Estado",
  "Fecha arreglo",
  "N factura",
  "Fecha factura",
  "Importe neto",
  "Total IVA incl.",
  "Fecha modificacion",
  "Observaciones",
  "ID app"
];

const pendingLabel = "PENDIENTE_DE_ANADIR";
const headerColor = "#263D38";
const borderColor = "#D9D2C4";

export async function parseExcelIncidents(buffer: Buffer) {
  const data = await readIncidentSheet(buffer);
  if (data.length < 2) {
    return { rows: [] as ExcelIncidentRow[], errors: ["El Excel no contiene filas de incidencias."] };
  }

  const headers = data[0].map((cell) => normalizeHeader(cellToString(cell)));
  const rows: ExcelIncidentRow[] = [];
  const errors: string[] = [];

  data.slice(1).forEach((row, index) => {
    if (row.every((cell) => !cellToString(cell))) return;

    const get = (...labels: string[]) => {
      const normalizedLabels = labels.map(normalizeHeader);
      const position = headers.findIndex((header) => normalizedLabels.includes(header));
      return position >= 0 ? row[position] : undefined;
    };

    const local = cleanListValue(cellToString(get("Local")));
    const descripcion = cellToString(get("Descripcion", "Descripción"));
    const responsable = cleanListValue(cellToString(get("Responsable", "Responsable aviso")));
    const rawPriority = cleanListValue(cellToString(get("Prioridad")));
    const rawStatus = cleanListValue(cellToString(get("Estado")));
    const categoria = cleanListValue(cellToString(get("Categoria", "Categoría")));
    const zonaText = cleanListValue(cellToString(get("Zona / area", "Zona", "Area", "Zonas")));
    const proveedor = cleanListValue(cellToString(get("Proveedor")));
    const observaciones = cellToString(get("Observaciones"));
    const numeroFactura = cellToString(get("N factura", "Numero factura", "Nº factura"));
    const fechaAviso = dateToIso(get("Fecha aviso", "Fecha incidencia"));
    const fechaArreglo = dateToIso(get("Fecha arreglo", "Fecha resolucion", "Fecha resolución"));
    const fechaFactura = dateToIso(get("Fecha factura"));
    const importeNeto = numberValue(get("Importe neto"));
    const totalIva = numberValue(get("Total IVA incl.", "Importe factura", "Total factura"));
    const appId = cellToString(get("ID app", "Codigo interno", "Código interno"));
    const urgent = isUrgent({ prioridad: rawPriority, descripcion, observaciones });
    const priority = normalizePriority(rawPriority, urgent);
    const estado = normalizeStatus(rawStatus);
    const excelRow: ExcelIncidentRow = {
      appId: isUuid(appId) ? appId : undefined,
      syncKey: buildSyncKey([local, fechaAviso, categoria, zonaText, descripcion, proveedor, numeroFactura, totalIva]),
      local,
      fechaAviso,
      categoria,
      zonas: splitZones(zonaText),
      descripcion,
      responsable,
      proveedor,
      prioridad: priority,
      estado,
      fechaArreglo,
      numeroFactura,
      fechaFactura,
      importeNeto,
      totalIva,
      ivaFactura: totalIva != null && importeNeto != null ? roundMoney(totalIva - importeNeto) : undefined,
      fechaModificacion: dateToIso(get("Fecha modificacion", "Fecha modificación")),
      observaciones,
      urgent
    };

    if (!excelRow.local || !excelRow.descripcion) {
      errors.push(`Fila ${index + 2}: falta local o descripcion.`);
      return;
    }

    rows.push(excelRow);
  });

  return { rows, errors };
}

export async function runExcelImport({
  buffer,
  fileName,
  profile,
  save
}: {
  buffer: Buffer;
  fileName: string;
  profile: Profile;
  save: boolean;
}): Promise<ExcelImportSummary> {
  const parsed = await parseExcelIncidents(buffer);
  const summary: ExcelImportSummary = {
    rowsTotal: parsed.rows.length,
    rowsCreated: 0,
    rowsUpdated: 0,
    rowsSkipped: parsed.errors.length,
    urgentCount: parsed.rows.filter((row) => row.urgent).length,
    saved: save,
    errors: parsed.errors.slice(0, 12)
  };

  if (!save || parsed.rows.length === 0) {
    return summary;
  }

  const supabase = await createClient();
  const lookupMaps = await loadLookupMaps();
  const categoryGroupId = await ensureCategoryGroup(supabase);
  const now = new Date().toISOString();

  for (const row of parsed.rows) {
    try {
      const local = await ensureLookup(supabase, lookupMaps, "locals", row.local || pendingLabel);
      const zoneNames = row.zonas.length > 0 ? row.zonas : [pendingLabel];
      const zones = [];

      for (const zoneName of zoneNames) {
        zones.push(await ensureLookup(supabase, lookupMaps, "zones", zoneName, { local_id: local.id }));
      }

      const responsable = await ensureLookup(supabase, lookupMaps, "responsables_aviso", row.responsable || pendingLabel);
      const provider = row.proveedor ? await ensureLookup(supabase, lookupMaps, "providers", row.proveedor) : null;
      const priority = row.prioridad ? await ensureLookup(supabase, lookupMaps, "priorities", row.prioridad, priorityPayload(row.prioridad)) : null;
      const status = await ensureLookup(supabase, lookupMaps, "statuses", row.estado || "Nueva", statusPayload(row.estado || "Nueva"));

      if (row.categoria && categoryGroupId) {
        await ensureCategoryItem(supabase, categoryGroupId, row.categoria);
      }

      const payload = {
        fecha_incidencia: row.fechaAviso || row.fechaFactura || todayIso(),
        local_id: local.id,
        zona_id: zones[0].id,
        descripcion: row.descripcion || "Incidencia importada desde Excel",
        responsable_aviso_id: responsable.id,
        proveedor_id: provider?.id ?? null,
        prioridad_id: priority?.id ?? null,
        categoria: row.categoria || null,
        numero_factura: row.numeroFactura || null,
        fecha_factura: row.fechaFactura || null,
        importe_neto: row.importeNeto ?? null,
        iva_factura: row.ivaFactura ?? null,
        importe_factura: row.totalIva ?? null,
        fecha_resolucion: row.fechaArreglo || null,
        estado_id: status.id,
        observaciones: row.observaciones || null,
        excel_sync_key: row.syncKey,
        excel_last_synced_at: now,
        archived: false
      };

      const existingId = await findExistingIncidentId(supabase, row);

      if (existingId) {
        const { error } = await supabase.from("incidents").update(payload).eq("id", existingId);
        if (error) throw error;
        await replaceIncidentZones(supabase, existingId, zones.map((zone) => zone.id));
        summary.rowsUpdated += 1;
      } else {
        const { data, error } = await supabase
          .from("incidents")
          .insert({ ...payload, created_by: profile.id })
          .select("id")
          .single();
        if (error) throw error;
        await replaceIncidentZones(supabase, data.id, zones.map((zone) => zone.id));
        summary.rowsCreated += 1;
      }
    } catch {
      summary.rowsSkipped += 1;
      if (summary.errors.length < 12) {
        summary.errors.push(`No se pudo guardar "${row.descripcion.slice(0, 60)}".`);
      }
    }
  }

  await supabase.from("excel_imports").insert({
    uploaded_by: profile.id,
    file_name: fileName,
    rows_total: summary.rowsTotal,
    rows_created: summary.rowsCreated,
    rows_updated: summary.rowsUpdated,
    rows_skipped: summary.rowsSkipped,
    urgent_count: summary.urgentCount,
    saved: true,
    errors: summary.errors
  });

  return summary;
}

export async function buildExcelWorkbook({
  incidents,
  lookups,
  customGroups
}: {
  incidents: Incident[];
  lookups: {
    locals: LookupItem[];
    zones: LookupItem[];
    responsables: LookupItem[];
    providers: LookupItem[];
    priorities: LookupItem[];
    statuses: LookupItem[];
  };
  customGroups: CustomListGroup[];
}) {
  const incidentRows = incidents.map((incident) => [
    body(incident.locals?.name),
    body(formatDateForExcel(incident.fecha_incidencia)),
    body(incident.categoria),
    body(zoneNames(incident)),
    body(incident.descripcion),
    body(incident.responsables_aviso?.name),
    body(incident.providers?.name),
    body(incident.priorities?.name ?? "-"),
    body(incident.statuses?.name),
    body(formatDateForExcel(incident.fecha_resolucion)),
    body(incident.numero_factura),
    body(formatDateForExcel(incident.fecha_factura)),
    money(incident.importe_neto),
    money(incident.importe_factura),
    body(formatDateTimeForExcel(incident.updated_at)),
    body(incident.observaciones),
    body(incident.id)
  ]);

  const summaryRows = buildSummaryRows(incidents);
  const byLocalRows = buildGroupedRows(incidents, "local");
  const byProviderRows = buildGroupedRows(incidents, "provider");
  const listRows = buildListRows(lookups, customGroups);

  const sheets: Sheet<Buffer>[] = [
    {
      sheet: "Resumen",
      data: makeSheet(["Indicador", "Valor"], summaryRows),
      columns: [{ width: 34 }, { width: 18 }],
      stickyRowsCount: 1
    },
    {
      sheet: "Incidencias",
      data: [excelHeaders.map(header), ...incidentRows],
      columns: [34, 14, 24, 22, 56, 22, 26, 14, 16, 14, 18, 14, 14, 15, 20, 40, 38].map((width) => ({ width })),
      stickyRowsCount: 1
    },
    {
      sheet: "Por local",
      data: makeSheet(["Local", "Incidencias", "Abiertas", "Completadas", "Coste neto", "Total IVA incl."], byLocalRows),
      columns: [34, 14, 12, 14, 14, 15].map((width) => ({ width })),
      stickyRowsCount: 1
    },
    {
      sheet: "Por proveedor",
      data: makeSheet(["Proveedor", "Incidencias", "Coste neto", "Total IVA incl."], byProviderRows),
      columns: [34, 14, 14, 15].map((width) => ({ width })),
      stickyRowsCount: 1
    },
    {
      sheet: "Listas",
      data: makeSheet(["Lista", "Valor"], listRows),
      columns: [{ width: 24 }, { width: 44 }],
      stickyRowsCount: 1
    }
  ];

  return writeExcelFile(sheets, { fontFamily: "Calibri", fontSize: 11 }).toBuffer();
}

async function readIncidentSheet(buffer: Buffer) {
  try {
    return (await readSheet(buffer, "Incidencias")) as SheetRow[];
  } catch {
    return (await readSheet(buffer, 1)) as SheetRow[];
  }
}

async function loadLookupMaps(): Promise<LookupMaps> {
  const supabase = await createClient();
  const tables: LookupTable[] = ["locals", "zones", "responsables_aviso", "providers", "priorities", "statuses"];
  const entries = await Promise.all(tables.map(async (table) => {
    const { data } = await supabase.from(table).select("*");
    return [table, toLookupMap((data ?? []) as LookupItem[])] as const;
  }));

  return Object.fromEntries(entries) as LookupMaps;
}

function toLookupMap(items: LookupItem[]) {
  const map = new Map<string, LookupItem>();
  for (const item of items) {
    map.set(normalizeLookupKey(item.name), item);
  }
  return map;
}

async function ensureLookup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  maps: LookupMaps,
  table: LookupTable,
  rawName: string,
  extra: Record<string, string | number | boolean | null> = {}
) {
  const name = cleanListValue(rawName) || pendingLabel;
  const key = normalizeLookupKey(name);
  const existing = maps[table].get(key);

  if (existing) return existing;

  const payload = { name, active: true, ...extra };
  const { data, error } = await supabase.from(table).insert(payload).select("*").single();

  if (error) throw error;

  const item = data as LookupItem;
  maps[table].set(key, item);
  return item;
}

async function ensureCategoryGroup(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: existing } = await supabase
    .from("custom_list_groups")
    .select("id,name")
    .ilike("name", "%categor%")
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from("custom_list_groups")
    .insert({ name: "Categorias", sort_order: 10, active: true })
    .select("id")
    .single();

  if (error) return null;
  return data.id as string;
}

async function ensureCategoryItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupId: string,
  name: string
) {
  const { data: existing } = await supabase
    .from("custom_list_items")
    .select("id")
    .eq("group_id", groupId)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return;

  await supabase.from("custom_list_items").insert({
    group_id: groupId,
    name,
    sort_order: 0,
    active: true
  });
}

async function findExistingIncidentId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: ExcelIncidentRow
) {
  if (row.appId) {
    const { data } = await supabase.from("incidents").select("id").eq("id", row.appId).maybeSingle();
    if (data?.id) return data.id as string;
  }

  const { data } = await supabase
    .from("incidents")
    .select("id")
    .eq("excel_sync_key", row.syncKey)
    .maybeSingle();

  return data?.id as string | undefined;
}

async function replaceIncidentZones(
  supabase: Awaited<ReturnType<typeof createClient>>,
  incidentId: string,
  zoneIds: string[]
) {
  const uniqueZoneIds = [...new Set(zoneIds)];
  await supabase.from("incident_zones").delete().eq("incident_id", incidentId);

  if (uniqueZoneIds.length > 0) {
    await supabase.from("incident_zones").insert(
      uniqueZoneIds.map((zona_id) => ({ incident_id: incidentId, zona_id }))
    );
  }
}

function priorityPayload(name: string) {
  const normalized = normalizeLookupKey(name);
  const order = normalized.includes("urgente") || normalized.includes("muy alta")
    ? 45
    : normalized.includes("alta")
      ? 30
      : normalized.includes("media")
        ? 20
        : 10;
  const color = order >= 45 ? "#b42318" : order >= 30 ? "#b24000" : order >= 20 ? "#2563eb" : "#6c665c";
  return { sort_order: order, color };
}

function statusPayload(name: string) {
  const normalized = normalizeLookupKey(name);
  const order = normalized.includes("complet") || normalized.includes("resuelt")
    ? 100
    : normalized.includes("curso")
      ? 90
      : normalized.includes("pend")
        ? 80
        : 10;
  const color = order >= 100 ? "#16754f" : order >= 90 ? "#4f46e5" : order >= 80 ? "#b24000" : "#2563eb";
  return { sort_order: order, color };
}

function buildSummaryRows(incidents: Incident[]) {
  const open = incidents.filter((incident) => !isCompletedStatus(incident.statuses?.name)).length;
  const urgentOpen = incidents.filter((incident) => !isCompletedStatus(incident.statuses?.name) && isUrgentPriority(incident.priorities?.name)).length;
  const oldOpen = incidents.filter((incident) => !isCompletedStatus(incident.statuses?.name) && olderThanDays(incident.fecha_incidencia, 15)).length;
  const net = sum(incidents.map((incident) => incident.importe_neto));
  const total = sum(incidents.map((incident) => incident.importe_factura));

  return [
    ["Incidencias", incidents.length],
    ["Abiertas", open],
    ["Completadas", incidents.length - open],
    ["Muy alta abiertas", urgentOpen],
    ["Mas de 15 dias abiertas", oldOpen],
    ["Importe neto", net],
    ["IVA", roundMoney(total - net)],
    ["Total con IVA", total]
  ];
}

function buildGroupedRows(incidents: Incident[], type: "local" | "provider") {
  const groups = new Map<string, Incident[]>();

  for (const incident of incidents) {
    const key = type === "local" ? incident.locals?.name ?? "-" : incident.providers?.name ?? "-";
    groups.set(key, [...(groups.get(key) ?? []), incident]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([name, rows]) => {
      const open = rows.filter((incident) => !isCompletedStatus(incident.statuses?.name)).length;
      const net = sum(rows.map((incident) => incident.importe_neto));
      const total = sum(rows.map((incident) => incident.importe_factura));
      return type === "local"
        ? [name, rows.length, open, rows.length - open, net, total]
        : [name, rows.length, net, total];
    });
}

function buildListRows(
  lookups: {
    locals: LookupItem[];
    zones: LookupItem[];
    responsables: LookupItem[];
    providers: LookupItem[];
    priorities: LookupItem[];
    statuses: LookupItem[];
  },
  customGroups: CustomListGroup[]
) {
  const categories = customGroups.find((group) => normalizeLookupKey(group.name).includes("categoria"))?.custom_list_items ?? [];
  const rows: Array<[string, string]> = [];
  const append = (list: string, items: Array<{ name: string; active?: boolean }>) => {
    for (const item of items.filter((candidate) => candidate.active !== false)) {
      rows.push([list, item.name]);
    }
  };

  append("Locales", lookups.locals);
  append("Categorias", categories);
  append("Zonas / areas", lookups.zones);
  append("Responsables del aviso", lookups.responsables);
  append("Proveedores", lookups.providers);
  append("Prioridades", lookups.priorities);
  append("Estados", lookups.statuses);

  return rows;
}

function makeSheet(headers: string[], rows: unknown[][]) {
  return [
    headers.map(header),
    ...rows.map((row) => row.map((value) => typeof value === "number" ? money(value) : body(value)))
  ];
}

function header(value: string): CellObject {
  return {
    value,
    fontWeight: "bold",
    textColor: "#FFFFFF",
    backgroundColor: headerColor,
    borderStyle: "thin",
    borderColor,
    wrap: true
  };
}

function body(value: unknown): CellObject {
  return {
    value: cellValue(value),
    borderStyle: "thin",
    borderColor,
    wrap: true,
    alignVertical: "top"
  };
}

function money(value?: number | null): CellObject {
  return {
    value: value ?? "",
    format: "#,##0.00",
    borderStyle: "thin",
    borderColor,
    align: "right"
  };
}

function cellValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value instanceof Date) {
    return value;
  }

  return "";
}

function splitZones(value: string) {
  return value
    .split(/[,;]+|\s+\+\s+/)
    .map(cleanListValue)
    .filter(Boolean);
}

function cellToString(value: CellValue) {
  if (value instanceof Date) return dateToIso(value) ?? "";
  if (value == null) return "";
  return String(value).trim();
}

function cleanListValue(value: string) {
  return value
    .replace(/^\s*\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value: string) {
  return normalizeLookupKey(value).replace(/\s+/g, " ");
}

function normalizeLookupKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizePriority(value: string, urgent: boolean) {
  const normalized = normalizeLookupKey(value);
  if (!normalized || normalized === "-") return urgent ? "Urgente" : "";
  if (normalized.includes("muy alta")) return "Muy alta";
  if (normalized.includes("urgent")) return "Urgente";
  if (normalized.includes("alta")) return "Alta";
  if (normalized.includes("media")) return "Media";
  if (normalized.includes("baja")) return "Baja";
  return value;
}

function normalizeStatus(value: string) {
  const normalized = normalizeLookupKey(value);
  if (!normalized || normalized === "-") return "";
  if (normalized.includes("complet")) return "Completado";
  if (normalized.includes("resuelt")) return "Resuelta";
  if (normalized.includes("cerrad")) return "Cerrada";
  if (normalized.includes("curso")) return "En curso";
  if (normalized.includes("pend")) return "Pendiente";
  if (normalized.includes("nueva")) return "Nueva";
  return value;
}

function isUrgent({
  prioridad,
  descripcion,
  observaciones
}: {
  prioridad: string;
  descripcion: string;
  observaciones: string;
}) {
  const text = normalizeLookupKey(`${prioridad} ${descripcion} ${observaciones}`);
  return /\b(muy alta|alta|urgente|urgencia|sin servicio|no funciona|no enciende|fuga|gas|atasco|bloquead|temperatura|averia)\b/.test(text);
}

function numberValue(value: CellValue) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null || value === "") return undefined;

  const compact = String(value).replace(/\s+/g, "").replace(/[^\d,.\-()]/g, "");
  const negative = compact.startsWith("-") || (compact.startsWith("(") && compact.endsWith(")"));
  const clean = compact.replace(/[()]/g, "").replace(/^-/, "");
  const decimalIndex = Math.max(clean.lastIndexOf(","), clean.lastIndexOf("."));
  const whole = decimalIndex >= 0 ? clean.slice(0, decimalIndex).replace(/[,.]/g, "") : clean.replace(/[,.]/g, "");
  const decimal = decimalIndex >= 0 ? clean.slice(decimalIndex + 1).replace(/[,.]/g, "") : "";
  const parsed = Number(`${negative ? "-" : ""}${whole || "0"}${decimal ? `.${decimal}` : ""}`);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateToIso(value: CellValue) {
  if (!value) return undefined;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  const clean = String(value).trim();
  const iso = clean.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const spanish = clean.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (spanish) return `${spanish[3]}-${spanish[2].padStart(2, "0")}-${spanish[1].padStart(2, "0")}`;

  return undefined;
}

function formatDateForExcel(value?: string | null) {
  if (!value) return "";
  const iso = value.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[3].padStart(2, "0")}/${iso[2].padStart(2, "0")}/${iso[1]}`;
  return value;
}

function formatDateTimeForExcel(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function buildSyncKey(values: unknown[]) {
  return createHash("sha256")
    .update(values.map((value) => String(value ?? "").trim().toLowerCase()).join("|"))
    .digest("hex");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isCompletedStatus(value?: string | null) {
  const normalized = normalizeLookupKey(value ?? "");
  return ["resuelta", "cerrada", "completado", "cancelada"].some((status) => normalized.includes(status));
}

function isUrgentPriority(value?: string | null) {
  const normalized = normalizeLookupKey(value ?? "");
  return normalized.includes("urgente") || normalized.includes("muy alta") || normalized.includes("alta");
}

function olderThanDays(value: string, days: number) {
  const iso = dateToIso(value);
  if (!iso) return false;
  const date = new Date(`${iso}T00:00:00`);
  const diff = Date.now() - date.getTime();
  return diff > days * 24 * 60 * 60 * 1000;
}

function sum(values: Array<number | null | undefined>) {
  return roundMoney(values.reduce<number>((total, value) => total + (Number(value) || 0), 0));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function zoneNames(incident: Incident) {
  const names = incident.incident_zones?.map((item) => item.zones?.name).filter(Boolean);
  return names?.length ? names.join(", ") : incident.zones?.name ?? "";
}
