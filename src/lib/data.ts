import { createClient } from "@/lib/supabase/server";
import { isPremiumRole } from "@/lib/permissions";
import type {
  CustomListGroup,
  CustomListItem,
  Incident,
  ExcelImport,
  IncidentAttachment,
  IncidentFilters,
  InvoiceFilters,
  LookupItem,
  LookupTable,
  Notification,
  Profile
} from "@/lib/types";

export const INCIDENT_SELECT = `
  *,
  locals(*),
  zones:zones!incidents_zona_id_fkey(*),
  incident_zones(zona_id,zones:zones!incident_zones_zona_id_fkey(*)),
  incident_attachments(*,invoice_extractions(*)),
  responsables_aviso(*),
  providers(*),
  priorities(*),
  statuses(*),
  profiles(id,email,full_name,role)
`;

export async function getLookup(table: LookupTable, activeOnly = true) {
  const supabase = await createClient();
  let query = supabase.from(table).select("*");

  if (activeOnly) {
    query = query.eq("active", true);
  }

  if (table === "priorities" || table === "statuses") {
    query = query.order("sort_order", { ascending: true });
  } else {
    query = query.order("name", { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as LookupItem[];
}

export async function getAllLookups(activeOnly = true) {
  const [locals, zones, responsables, providers, priorities, statuses] = await Promise.all([
    getLookup("locals", activeOnly),
    getLookup("zones", activeOnly),
    getLookup("responsables_aviso", activeOnly),
    getLookup("providers", activeOnly),
    getLookup("priorities", activeOnly),
    getLookup("statuses", activeOnly)
  ]);

  return { locals, zones, responsables, providers, priorities, statuses };
}

export async function getCustomListGroups(activeOnly = true) {
  const supabase = await createClient();
  let groupsQuery = supabase
    .from("custom_list_groups")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  let itemsQuery = supabase
    .from("custom_list_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (activeOnly) {
    groupsQuery = groupsQuery.eq("active", true);
    itemsQuery = itemsQuery.eq("active", true);
  }

  const [groups, items] = await Promise.all([groupsQuery, itemsQuery]);

  if (groups.error) throw groups.error;
  if (items.error) throw items.error;

  const itemsByGroup = new Map<string, CustomListItem[]>();
  for (const item of (items.data ?? []) as CustomListItem[]) {
    itemsByGroup.set(item.group_id, [...(itemsByGroup.get(item.group_id) ?? []), item]);
  }

  return ((groups.data ?? []) as CustomListGroup[]).map((group) => ({
    ...group,
    custom_list_items: itemsByGroup.get(group.id) ?? []
  }));
}

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): IncidentFilters {
  const get = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const statusGroup = get("status_group");

  return {
    local: get("local") || undefined,
    zona: get("zona") || undefined,
    estado: get("estado") || undefined,
    prioridad: get("prioridad") || undefined,
    responsable: get("responsable") || undefined,
    proveedor: get("proveedor") || undefined,
    from: get("from") || undefined,
    to: get("to") || undefined,
    q: get("q") || undefined,
    status_group: statusGroup === "new" || statusGroup === "pending" || statusGroup === "resolved"
      ? statusGroup
      : undefined
  };
}

export function parseInvoiceFilters(searchParams: Record<string, string | string[] | undefined>): InvoiceFilters {
  const get = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    provider: get("provider") || undefined,
    date: get("date") || undefined,
    number: get("number") || undefined,
    amount: get("amount") || undefined,
    priority: get("priority") || undefined,
    category: get("category") || undefined,
    zone: get("zone") || undefined
  };
}

export async function getIncidents(profile: Profile, filters: IncidentFilters = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("incidents")
    .select(INCIDENT_SELECT)
    .eq("archived", false)
    .order("created_at", { ascending: false });

  if (!isPremiumRole(profile.role)) {
    query = query.eq("created_by", profile.id);
  }

  if (filters.local) query = query.eq("local_id", filters.local);
  // Multi-zone filtering is applied after fetching because Supabase cannot
  // express an OR across the base table and an embedded relation reliably.
  if (filters.estado) query = query.eq("estado_id", filters.estado);
  if (filters.prioridad) query = query.eq("prioridad_id", filters.prioridad);
  if (filters.responsable) query = query.eq("responsable_aviso_id", filters.responsable);
  if (filters.proveedor) query = query.eq("proveedor_id", filters.proveedor);
  if (filters.from) query = query.gte("fecha_incidencia", filters.from);
  if (filters.to) query = query.lte("fecha_incidencia", filters.to);
  if (filters.q) query = query.ilike("descripcion", `%${filters.q}%`);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  let rows = (data ?? []) as Incident[];

  if (filters.zona) {
    rows = rows.filter((incident) =>
      incident.zona_id === filters.zona
      || incident.incident_zones?.some((item) => item.zona_id === filters.zona)
    );
  }

  if (filters.status_group) {
    rows = rows.filter((incident) => {
      const status = incident.statuses?.name ?? "";

      if (filters.status_group === "new") return status === "Nueva";
      if (filters.status_group === "resolved") return ["Resuelta", "Cerrada", "Completado"].includes(status);
      return !["Resuelta", "Cerrada", "Completado", "Cancelada"].includes(status);
    });
  }

  return rows;
}

export async function getIncidentById(profile: Profile, id: string) {
  const supabase = await createClient();
  let query = supabase.from("incidents").select(INCIDENT_SELECT).eq("id", id);

  if (!isPremiumRole(profile.role)) {
    query = query.eq("created_by", profile.id);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data as Incident | null;
}

export async function getPendingInvoiceAttachments(profile: Profile, filters: InvoiceFilters = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("incident_attachments")
    .select("*,invoice_extractions(*)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (!isPremiumRole(profile.role)) {
    query = query.eq("uploaded_by", profile.id);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as IncidentAttachment[]).filter((attachment) => matchesInvoiceFilters(attachment, filters));
}

export async function getInvoiceAttachmentById(profile: Profile, id: string) {
  const supabase = await createClient();
  let query = supabase
    .from("incident_attachments")
    .select("*,invoice_extractions(*)")
    .eq("id", id);

  if (!isPremiumRole(profile.role)) {
    query = query.eq("uploaded_by", profile.id);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data as IncidentAttachment | null;
}

export async function getStatusByName(name: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("statuses").select("*").eq("name", name).maybeSingle();

  if (error) {
    throw error;
  }

  return data as LookupItem | null;
}

export async function getNotifications(profile: Profile) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*,incidents(id,profiles(id,email,full_name))")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Notification[];
}

export async function getExcelImports(limit = 8) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("excel_imports")
    .select("*,profiles(id,email,full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as ExcelImport[];
}

function matchesInvoiceFilters(attachment: IncidentAttachment, filters: InvoiceFilters) {
  const extraction = Array.isArray(attachment.invoice_extractions)
    ? attachment.invoice_extractions[0]
    : attachment.invoice_extractions;
  const parsed = extraction?.parsed_data ?? {};
  const haystack = normalizeFilterText([
    attachment.file_name,
    parsed.proveedor_name,
    parsed.invoice_number,
    parsed.invoice_date,
    parsed.fecha_incidencia,
    parsed.prioridad_name,
    parsed.categoria_name,
    parsed.category_name,
    parsed.concept,
    parsed.descripcion,
    ...(parsed.zona_names ?? [])
  ].filter(Boolean).join(" "));

  if (filters.provider && !haystack.includes(normalizeFilterText(filters.provider))) return false;
  if (filters.number && !normalizeFilterText(parsed.invoice_number ?? "").includes(normalizeFilterText(filters.number))) return false;
  if (filters.priority && normalizeFilterText(parsed.prioridad_name ?? "") !== normalizeFilterText(filters.priority)) return false;
  if (filters.category && !haystack.includes(normalizeFilterText(filters.category))) return false;
  if (filters.zone && !haystack.includes(normalizeFilterText(filters.zone))) return false;

  if (filters.date) {
    const invoiceDate = normalizeInvoiceDate(parsed.invoice_date ?? parsed.fecha_incidencia);
    if (invoiceDate !== filters.date) return false;
  }

  if (filters.amount) {
    const expected = parseFilterAmount(filters.amount);
    const current = parseFilterAmount(parsed.importe_factura ?? parsed.total_amount);
    if (expected == null || current == null || Math.abs(expected - current) > 0.009) return false;
  }

  return true;
}

function normalizeFilterText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeInvoiceDate(value?: string | null) {
  if (!value) return "";
  const clean = value.trim();
  const iso = clean.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const spanish = clean.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  if (spanish) return `${spanish[3]}-${spanish[2].padStart(2, "0")}-${spanish[1].padStart(2, "0")}`;

  return clean;
}

function parseFilterAmount(value?: string | number | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;

  const clean = value
    .replace(/\s+/g, "")
    .replace(/[^\d,.\-()]/g, "");
  const negative = clean.startsWith("-") || (clean.startsWith("(") && clean.endsWith(")"));
  const normalized = clean.replace(/[()]/g, "").replace(/^-/, "");
  const decimalIndex = Math.max(normalized.lastIndexOf(","), normalized.lastIndexOf("."));
  const whole = decimalIndex >= 0 ? normalized.slice(0, decimalIndex).replace(/[,.]/g, "") : normalized.replace(/[,.]/g, "");
  const decimals = decimalIndex >= 0 ? normalized.slice(decimalIndex + 1).replace(/[,.]/g, "") : "";
  const parsed = Number(`${negative ? "-" : ""}${whole || "0"}${decimals ? `.${decimals}` : ""}`);

  return Number.isFinite(parsed) ? parsed : null;
}
