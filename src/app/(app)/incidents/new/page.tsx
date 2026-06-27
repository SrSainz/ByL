import { createIncidentAction } from "@/app/actions/incidents";
import { IncidentForm } from "@/components/incidents/incident-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";
import { getAllLookups } from "@/lib/data";

export default async function NewIncidentPage() {
  const profile = await requireProfile();
  const lookups = await getAllLookups();

  return (
    <div>
      <PageHeader title="Crear incidencia" description="Registra una nueva incidencia de mantenimiento." />
      <IncidentForm
        profile={profile}
        lookups={lookups}
        action={createIncidentAction}
        submitLabel="Crear incidencia"
      />
    </div>
  );
}
