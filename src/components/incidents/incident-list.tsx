import Link from "next/link";
import { Trash2 } from "lucide-react";
import { deleteIncidentAction } from "@/app/actions/incidents";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import { canArchiveOrDelete, isPremiumRole } from "@/lib/permissions";
import type { Incident, Profile } from "@/lib/types";

export function IncidentList({ incidents, profile }: { incidents: Incident[]; profile: Profile }) {
  const canDelete = canArchiveOrDelete(profile.role);

  if (incidents.length === 0) {
    return <EmptyState title="No hay incidencias" description="Crea una incidencia o ajusta los filtros." />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Local / Zonas</th>
              <th className="px-4 py-3">Descripción</th>
              <th className="px-4 py-3">Responsable</th>
              {isPremiumRole(profile.role) ? <th className="px-4 py-3">Proveedor</th> : null}
              {isPremiumRole(profile.role) ? <th className="px-4 py-3">Importe</th> : null}
              <th className="px-4 py-3">Prioridad</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Creada</th>
              {canDelete ? <th className="px-4 py-3 text-right">Acciones</th> : null}
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
                {isPremiumRole(profile.role) ? <td className="px-4 py-3 font-medium">{formatAmount(incident.importe_factura)}</td> : null}
                <td className="px-4 py-3"><Badge label={incident.priorities?.name} color={incident.priorities?.color} /></td>
                <td className="px-4 py-3"><Badge label={incident.statuses?.name} color={incident.statuses?.color} /></td>
                <td className="px-4 py-3 text-muted">{formatDateTime(incident.created_at)}</td>
                {canDelete ? (
                  <td className="px-4 py-3">
                    <DeleteIncidentButton incidentId={incident.id} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-border md:hidden">
        {incidents.map((incident) => (
          <article key={incident.id} className="p-4">
            <Link href={`/incidents/${incident.id}`} className="block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{incident.locals?.name ?? "-"}</p>
                  <p className="text-sm text-muted">{zoneNames(incident)} - {incident.fecha_incidencia}</p>
                </div>
                <Badge label={incident.statuses?.name} color={incident.statuses?.color} />
              </div>
              <p className="mt-3 line-clamp-3 text-sm">{incident.descripcion}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge label={incident.priorities?.name} color={incident.priorities?.color} />
                <span className="text-xs text-muted">{incident.responsables_aviso?.name ?? "-"}</span>
              </div>
            </Link>
            {canDelete ? (
              <div className="mt-3">
                <DeleteIncidentButton incidentId={incident.id} />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function DeleteIncidentButton({ incidentId }: { incidentId: string }) {
  return (
    <form action={deleteIncidentAction} className="flex justify-end">
      <input type="hidden" name="incident_id" value={incidentId} />
      <button
        aria-label="Eliminar incidencia"
        className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-white transition hover:bg-primary/90"
        title="Eliminar incidencia"
        type="submit"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
}

function formatAmount(value?: number | null) {
  if (value == null) return "-";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
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
