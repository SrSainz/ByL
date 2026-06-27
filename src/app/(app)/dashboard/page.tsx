import { AlertCircle, Bell, CheckCircle2, ClipboardList } from "lucide-react";
import { IncidentList } from "@/components/incidents/incident-list";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Badge } from "@/components/ui/badge";
import { requireProfile } from "@/lib/auth";
import { getIncidents } from "@/lib/data";
import { isPremiumRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const incidents = await getIncidents(profile);
  const total = incidents.length;
  const resolved = incidents.filter((incident) => ["Resuelta", "Cerrada"].includes(incident.statuses?.name ?? "")).length;
  const newCount = incidents.filter((incident) => incident.statuses?.name === "Nueva").length;
  const open = incidents.filter((incident) => !["Resuelta", "Cerrada", "Cancelada"].includes(incident.statuses?.name ?? "")).length;
  const latest = incidents.slice(0, 5);
  const pendingNotifications = await getPendingNotifications(profile.id, profile.role);
  const byPriority = countBy(incidents.map((incident) => incident.priorities?.name ?? "Sin prioridad"));
  const byStatus = countBy(incidents.map((incident) => incident.statuses?.name ?? "Sin estado"));

  return (
    <div>
      <PageHeader title="Inicio" description="Resumen operativo de incidencias y actividad reciente." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={isPremiumRole(profile.role) ? "Total incidencias" : "Mis incidencias"} value={total} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label={isPremiumRole(profile.role) ? "Incidencias nuevas" : "Abiertas"} value={isPremiumRole(profile.role) ? newCount : open} icon={<AlertCircle className="h-5 w-5" />} />
        <StatCard label="Resueltas" value={resolved} icon={<CheckCircle2 className="h-5 w-5" />} />
        {isPremiumRole(profile.role) ? (
          <StatCard label="Notificaciones pendientes" value={pendingNotifications} icon={<Bell className="h-5 w-5" />} />
        ) : (
          <StatCard label="Abiertas" value={open} detail="No resueltas ni cerradas" />
        )}
      </div>

      {isPremiumRole(profile.role) ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Breakdown title="Por prioridad" values={byPriority} />
          <Breakdown title="Por estado" values={byStatus} />
        </div>
      ) : null}

      <div className="mt-6">
        <PageHeader title="Últimas incidencias" />
        <IncidentList incidents={latest} profile={profile} />
      </div>
    </div>
  );
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function Breakdown({ title, values }: { title: string; values: Record<string, number> }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-3 space-y-2">
        {Object.entries(values).map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <Badge label={label} />
            <span className="font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

async function getPendingNotifications(userId: string, role: string) {
  if (!isPremiumRole(role as UserRole)) return 0;

  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  return count ?? 0;
}
