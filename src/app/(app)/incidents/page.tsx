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
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Crear incidencia</h2>
          <p className="text-sm text-muted">Rellena los datos necesarios y pulsa guardar.</p>
        </div>
        <IncidentForm
          profile={profile}
          lookups={lookups}
          action={createIncidentAction}
          submitLabel="Guardar incidencia"
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Filtrar incidencias</h2>
          <p className="text-sm text-muted">Filtra por local, zona, responsable, estado, prioridad o fecha.</p>
        </div>
        <IncidentFiltersForm filters={filters} lookups={lookups} profile={profile} />
        <IncidentList incidents={incidents} profile={profile} />
      </section>
    </div>
  );
}
