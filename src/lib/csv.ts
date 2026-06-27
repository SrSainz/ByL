import type { Incident } from "@/lib/types";

function escapeCsv(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function incidentsToCsv(incidents: Incident[]) {
  const headers = [
    "ID",
    "Fecha incidencia",
    "Local",
    "Zona",
    "Descripcion",
    "Responsable",
    "Proveedor",
    "Prioridad",
    "Fecha resolucion",
    "Estado",
    "Creado por",
    "Creado"
  ];

  const rows = incidents.map((incident) => [
    incident.id,
    incident.fecha_incidencia,
    incident.locals?.name,
    zoneNames(incident),
    incident.descripcion,
    incident.responsables_aviso?.name,
    incident.providers?.name,
    incident.priorities?.name,
    incident.fecha_resolucion,
    incident.statuses?.name,
    incident.profiles?.email,
    incident.created_at
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function zoneNames(incident: Incident) {
  const names = incident.incident_zones
    ?.map((item) => item.zones?.name)
    .filter(Boolean);

  return names?.length ? names.join(", ") : incident.zones?.name;
}
