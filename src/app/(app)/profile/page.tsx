import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";

export default async function ProfilePage() {
  const profile = await requireProfile();

  return (
    <div>
      <PageHeader title="Perfil" description="Información de tu cuenta." />
      <div className="rounded-lg border border-border bg-white p-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Info label="Nombre" value={profile.full_name || "-"} />
          <Info label="Email" value={profile.email || "-"} />
          <Info label="Rol" value={profile.role} />
          <Info label="Estado" value={profile.active ? "Activo" : "Inactivo"} />
        </dl>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-950">{value}</dd>
    </div>
  );
}
