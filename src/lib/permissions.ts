import type { Incident, Profile, UserRole } from "@/lib/types";

export function isPremiumRole(role?: UserRole | null) {
  return role === "admin";
}

export function isAdmin(role?: UserRole | null) {
  return role === "admin";
}

export function canSeePremiumFields(role?: UserRole | null) {
  return isAdmin(role);
}

export function canManageUsers(role?: UserRole | null) {
  return isAdmin(role);
}

export function canManageLists(role?: UserRole | null) {
  return isAdmin(role);
}

export function canArchiveOrDelete(role?: UserRole | null) {
  return isAdmin(role);
}

export function canReadIncident(profile: Profile, incident: Incident) {
  return isPremiumRole(profile.role) || incident.created_by === profile.id;
}

export function canEditIncident(profile: Profile, incident: Incident) {
  if (isPremiumRole(profile.role)) {
    return true;
  }

  return incident.created_by === profile.id && incident.statuses?.name === "Nueva";
}

export function allowedIncidentUpdateFields(role: UserRole) {
  const basicFields = [
    "fecha_incidencia",
    "local_id",
    "zona_id",
    "descripcion",
    "responsable_aviso_id"
  ];

  if (isPremiumRole(role)) {
    return [
      ...basicFields,
      "proveedor_id",
      "prioridad_id",
      "categoria",
      "numero_factura",
      "fecha_factura",
      "importe_neto",
      "iva_factura",
      "importe_factura",
      "observaciones",
      "excel_sync_key",
      "excel_last_synced_at",
      "fecha_resolucion",
      "estado_id",
      "archived"
    ];
  }

  return basicFields;
}
