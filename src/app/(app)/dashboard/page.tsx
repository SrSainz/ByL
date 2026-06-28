import Link from "next/link";
import { AlertCircle, Bell, CheckCircle2, ClipboardList } from "lucide-react";
import { IncidentList } from "@/components/incidents/incident-list";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Badge } from "@/components/ui/badge";
import { requireProfile } from "@/lib/auth";
import { getAllLookups, getIncidents } from "@/lib/data";
import { isPremiumRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { LookupItem } from "@/lib/types";
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
  const lookups = isPremiumRole(profile.role) ? await getAllLookups() : null;
  const byPriority = lookups ? breakdownFromLookups(lookups.priorities, incidents, "prioridad") : [];
  const byStatus = lookups ? breakdownFromLookups(lookups.statuses, incidents, "estado") : [];

  return (
    <div>
      <PageHeader title="Inicio" description="Resumen operativo de incidencias y actividad reciente." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={isPremiumRole(profile.role) ? "Total incidencias" : "Mis incidencias"}
          value={total}
          icon={<ClipboardList className="h-5 w-5" />}
          href="/incidents"
        />
        <StatCard
          label="Incidencias nuevas"
          value={newCount}
          icon={<AlertCircle className="h-5 w-5" />}
          href="/incidents?status_group=new"
        />
        <StatCard
          label="Pendientes"
          value={open}
          detail="No resueltas ni cerradas"
          icon={<AlertCircle className="h-5 w-5" />}
          href="/incidents?status_group=pending"
        />
        <StatCard
          label="Resueltas"
          value={resolved}
          icon={<CheckCircle2 className="h-5 w-5" />}
          href="/incidents?status_group=resolved"
        />
        {isPremiumRole(profile.role) ? (
          <StatCard
            label="Notificaciones pendientes"
            value={pendingNotifications}
            icon={<Bell className="h-5 w-5" />}
            href="/notifications"
          />
        ) : null}
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

type BreakdownItem = {
  id: string;
  label: string;
  value: number;
  color?: string | null;
  href: string;
};

function breakdownFromLookups(
  items: LookupItem[],
  incidents: Awaited<ReturnType<typeof getIncidents>>,
  type: "prioridad" | "estado"
): BreakdownItem[] {
  return items.map((item) => ({
    id: item.id,
    label: item.name,
    value: incidents.filter((incident) =>
      type === "prioridad" ? incident.prioridad_id === item.id : incident.estado_id === item.id
    ).length,
    color: item.color,
    href: `/incidents?${type}=${item.id}`
  }));
}

function Breakdown({ title, values }: { title: string; values: BreakdownItem[] }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-3 space-y-2">
        {values.map((item) => (
          <Link
            key={item.id}
            className="focus-ring flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50"
            href={item.href}
          >
            <Badge label={item.label} color={item.color} />
            <span className="font-semibold">{item.value}</span>
          </Link>
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
