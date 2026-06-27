import { notFound, redirect } from "next/navigation";
import { updateIncidentAction } from "@/app/actions/incidents";
import { IncidentForm } from "@/components/incidents/incident-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";
import { getAllLookups, getIncidentById } from "@/lib/data";
import { canEditIncident } from "@/lib/permissions";

export default async function EditIncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const [incident, lookups] = await Promise.all([
    getIncidentById(profile, id),
    getAllLookups()
  ]);

  if (!incident) {
    notFound();
  }

  if (!canEditIncident(profile, incident)) {
    redirect("/denied");
  }

  const action = updateIncidentAction.bind(null, incident.id);

  return (
    <div>
      <PageHeader title="Editar incidencia" description="Actualiza la información permitida para tu rol." />
      <IncidentForm
        profile={profile}
        lookups={lookups}
        incident={incident}
        action={action}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
