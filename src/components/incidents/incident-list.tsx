import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import { isPremiumRole } from "@/lib/permissions";
import type { Incident, Profile } from "@/lib/types";

export function IncidentList({ incidents, profile }: { incidents: Incident[]; profile: Profile }) {
  if (incidents.length === 0) {
    return <EmptyState title="No hay incidencias" description="Crea una incidencia o ajusta los filtros." />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Local / Zonas</th>
              <th className="px-4 py-3">Descripcion</th>
              <th className="px-4 py-3">Responsable</th>
              {isPremiumRole(profile.role) ? <th className="px-4 py-3">Proveedor</th> : null}
              <th className="px-4 py-3">Prioridad</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Creada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {incidents.map((incident) => (
              <tr key={incident.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{incident.fecha_incidencia}</td>
                <td className="px-4 py-3">
                  <Link className="font-semibold text-primary" href={`/incidents/${incident.id}`}>
                    {incident.locals?.name ?? "-"}
                  </Link>
                  <p className="text-xs text-muted">{zoneNames(incident)}</p>
                </td>
                <td className="max-w-xs px-4 py-3">
                  <p className="line-clamp-2">{incident.descripcion}</p>
                </td>
                <td className="px-4 py-3">{incident.responsables_aviso?.name ?? "-"}</td>
                {isPremiumRole(profile.role) ? <td className="px-4 py-3">{incident.providers?.name ?? "-"}</td> : null}
                <td className="px-4 py-3"><Badge label={incident.priorities?.name} color={incident.priorities?.color} /></td>
                <td className="px-4 py-3"><Badge label={incident.statuses?.name} color={incident.statuses?.color} /></td>
                <td className="px-4 py-3 text-muted">{formatDateTime(incident.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-border md:hidden">
        {incidents.map((incident) => (
          <Link key={incident.id} href={`/incidents/${incident.id}`} className="block p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">{incident.locals?.name ?? "-"}</p>
                <p className="text-sm text-muted">{zoneNames(incident)} · {incident.fecha_incidencia}</p>
              </div>
              <Badge label={incident.statuses?.name} color={incident.statuses?.color} />
            </div>
            <p className="mt-3 line-clamp-3 text-sm">{incident.descripcion}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge label={incident.priorities?.name} color={incident.priorities?.color} />
              <span className="text-xs text-muted">{incident.responsables_aviso?.name ?? "-"}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function zoneNames(incident: Incident) {
  const names = incident.incident_zones
    ?.map((item) => item.zones?.name)
    .filter(Boolean);

  if (names?.length) {
    return names.join(", ");
  }

  return incident.zones?.name ?? "-";
}
