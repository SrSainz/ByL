import Link from "next/link";
import { Archive, ExternalLink, FileText, Pencil, Trash2 } from "lucide-react";
import { archiveIncidentAction, deleteIncidentAction } from "@/app/actions/incidents";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";
import { getIncidentById } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { canArchiveOrDelete, canEditIncident, canSeePremiumFields } from "@/lib/permissions";

export default async function IncidentDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const profile = await requireProfile();
  const incident = await getIncidentById(profile, id);

  if (!incident) {
    return (
      <div className="rounded-lg border border-border bg-white p-6">
        <h1 className="text-xl font-semibold">Incidencia no encontrada</h1>
        <Link className="mt-3 inline-flex text-sm font-semibold text-primary" href="/incidents">
          Volver a incidencias
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Detalle de incidencia"
        description={`Creada ${formatDateTime(incident.created_at)}`}
        actions={
          <>
            {canEditIncident(profile, incident) ? (
              <ButtonLink href={`/incidents/${incident.id}/edit`} variant="secondary">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Editar
              </ButtonLink>
            ) : null}
          </>
        }
      />
      {query.created ? <Notice message="Incidencia creada correctamente." /> : null}
      {query.updated ? <Notice message="Incidencia actualizada correctamente." /> : null}
      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-border bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Información básica</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Info label="Fecha incidencia" value={incident.fecha_incidencia} />
            <Info label="Local" value={incident.locals?.name} />
            <Info label="Zonas" value={zoneNames(incident)} />
            <Info label="Responsable aviso" value={incident.responsables_aviso?.name} />
          </dl>
          <div className="mt-5">
            <p className="label">Descripción</p>
            <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{incident.descripcion}</p>
          </div>
          {incident.incident_attachments?.length ? (
            <div className="mt-5">
              <p className="label">Facturas adjuntas</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {incident.incident_attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    href={`/api/invoices/${attachment.id}/download`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    {attachment.file_name}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">Seguimiento</h2>
            <dl className="mt-4 space-y-4">
              <Info label="Estado" value={<Badge label={incident.statuses?.name} color={incident.statuses?.color} />} />
              <Info label="Prioridad" value={<Badge label={incident.priorities?.name} color={incident.priorities?.color} />} />
              {canSeePremiumFields(profile.role) ? (
                <>
                  <Info label="Proveedor" value={incident.providers?.name} />
                  <Info label="Importe factura" value={formatAmount(incident.importe_factura)} />
                  <Info label="Fecha resolución" value={incident.fecha_resolucion} />
                  <Info label="Creada por" value={incident.profiles?.full_name || incident.profiles?.email} />
                </>
              ) : null}
            </dl>
          </div>

          {canArchiveOrDelete(profile.role) ? (
            <div className="rounded-lg border border-border bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-950">Admin</h2>
              <div className="mt-4 flex flex-col gap-2">
                <form action={archiveIncidentAction}>
                  <input type="hidden" name="incident_id" value={incident.id} />
                  <Button className="w-full" variant="secondary" type="submit">
                    <Archive className="h-4 w-4" aria-hidden="true" />
                    Archivar
                  </Button>
                </form>
                <form action={deleteIncidentAction}>
                  <input type="hidden" name="incident_id" value={incident.id} />
                  <Button className="w-full" variant="danger" type="submit">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Borrar
                  </Button>
                </form>
              </div>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-slate-950">{value || "-"}</dd>
    </div>
  );
}

function formatAmount(value?: number | null) {
  if (value == null) return undefined;
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

function zoneNames(incident: { zones?: { name?: string | null } | null; incident_zones?: Array<{ zones?: { name?: string | null } | null }> }) {
  const names = incident.incident_zones?.map((item) => item.zones?.name).filter(Boolean);
  return names?.length ? names.join(", ") : incident.zones?.name;
}

function Notice({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-success">
      {message}
    </div>
  );
}
