import { createClient } from "@/lib/supabase/server";
import { isPremiumRole } from "@/lib/permissions";
import type { Incident, IncidentAttachment, IncidentFilters, LookupItem, LookupTable, Notification, Profile } from "@/lib/types";

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
  if (filters.from) query = query.eq("fecha_incidencia", filters.from);
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
      if (filters.status_group === "resolved") return ["Resuelta", "Cerrada"].includes(status);
      return !["Resuelta", "Cerrada", "Cancelada"].includes(status);
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

export async function getPendingInvoiceAttachments(profile: Profile) {
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

  return (data ?? []);
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
