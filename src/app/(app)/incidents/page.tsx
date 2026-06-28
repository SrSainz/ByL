import { Plus, SlidersHorizontal } from "lucide-react";
import { createIncidentAction } from "@/app/actions/incidents";
import { IncidentFiltersForm } from "@/components/incidents/incident-filters";
import { IncidentForm } from "@/components/incidents/incident-form";
import { IncidentList } from "@/components/incidents/incident-list";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";
import { getAllLookups, getIncidents, parseFilters } from "@/lib/data";

export default async function IncidentsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const profile = await requireProfile();
  const filters = parseFilters(params);
  const [lookups, incidents] = await Promise.all([
    getAllLookups(),
    getIncidents(profile, filters)
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidencias"
        description="Crea nuevas incidencias y consulta el historial según tus permisos."
      />

      <details className="group rounded-lg border border-border bg-white p-4">
        <summary className="focus-ring flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-1 text-base font-semibold text-slate-950">
          <span className="inline-flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" aria-hidden="true" />
            Crear incidencia
          </span>
          <span className="text-sm font-medium text-muted group-open:hidden">Abrir</span>
          <span className="hidden text-sm font-medium text-muted group-open:inline">Cerrar</span>
        </summary>
        <div className="mt-4">
          <IncidentForm
            profile={profile}
            lookups={lookups}
            action={createIncidentAction}
            submitLabel="Guardar incidencia"
          />
        </div>
      </details>

      <details className="group rounded-lg border border-border bg-white p-4">
        <summary className="focus-ring flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-1 text-base font-semibold text-slate-950">
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" aria-hidden="true" />
            Filtrar incidencias
          </span>
          <span className="text-sm font-medium text-muted group-open:hidden">Abrir</span>
          <span className="hidden text-sm font-medium text-muted group-open:inline">Cerrar</span>
        </summary>
        <div className="mt-4">
          <IncidentFiltersForm filters={filters} lookups={lookups} profile={profile} />
        </div>
      </details>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">Listado de incidencias</h2>
        <IncidentList incidents={incidents} profile={profile} />
      </section>
    </div>
  );
}
