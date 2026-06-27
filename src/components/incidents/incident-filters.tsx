import { Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import type { IncidentFilters, LookupItem, Profile } from "@/lib/types";
import { isPremiumRole } from "@/lib/permissions";

type Lookups = {
  locals: LookupItem[];
  zones: LookupItem[];
  responsables: LookupItem[];
  providers: LookupItem[];
  priorities: LookupItem[];
  statuses: LookupItem[];
};

export function IncidentFiltersForm({
  filters,
  lookups,
  profile
}: {
  filters: IncidentFilters;
  lookups: Lookups;
  profile: Profile;
}) {
  const exportParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) exportParams.set(key, value);
  });

  return (
    <form className="mb-4 rounded-lg border border-border bg-white p-4" action="/incidents" data-tour="incident-filters">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className="field" name="q" placeholder="Descripción" defaultValue={filters.q ?? ""} />
        <Select name="local" items={lookups.locals} defaultValue={filters.local} label="Local" />
        <Select name="zona" items={lookups.zones} defaultValue={filters.zona} label="Zona" />
        <Select name="estado" items={lookups.statuses} defaultValue={filters.estado} label="Estado" />
        <Select name="prioridad" items={lookups.priorities} defaultValue={filters.prioridad} label="Prioridad" />
        <Select name="responsable" items={lookups.responsables} defaultValue={filters.responsable} label="Responsable" />
        {isPremiumRole(profile.role) ? (
          <Select name="proveedor" items={lookups.providers} defaultValue={filters.proveedor} label="Proveedor" />
        ) : null}
        <label className="space-y-1">
          <span className="label">Fecha de incidencia</span>
          <input className="field" name="from" type="date" defaultValue={filters.from ?? ""} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Search className="h-4 w-4" aria-hidden="true" />
          Filtrar
        </button>
        <ButtonLink href="/incidents" variant="secondary">Limpiar</ButtonLink>
        {isPremiumRole(profile.role) ? (
          <ButtonLink href={`/incidents/export?${exportParams.toString()}`} variant="secondary">Exportar CSV</ButtonLink>
        ) : null}
      </div>
    </form>
  );
}

function Select({
  items,
  label,
  defaultValue,
  name
}: {
  items: LookupItem[];
  label: string;
  defaultValue?: string;
  name: string;
}) {
  return (
    <select className="field" name={name} defaultValue={defaultValue ?? ""}>
      <option value="">{label}</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  );
}
