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
import type { LookupItem, UserRole } from "@/lib/types";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const incidents = await getIncidents(profile);
  const total = incidents.length;
  const resolved = incidents.filter((incident) => ["Resuelta", "Cerrada"].includes(incident.statuses?.name ?? "")).length;
  const newCount = incidents.filter((incident) => incident.statuses?.name === "Nueva").length;
  const open = incidents.filter((incident) => !["Resuelta", "Cerrada", "Cancelada"].includes(incident.statuses?.name ?? "")).length;
  const latest = incidents.slice(0, 5);
  const pendingNotifications = await getPendingNotifications(profile.id, profile.role);
  const lookups = await getAllLookups();
  const byPriority = isPremiumRole(profile.role) ? breakdownFromLookups(lookups.priorities, incidents, "prioridad") : [];
  const byStatus = breakdownFromLookups(lookups.statuses, incidents, "estado");

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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {isPremiumRole(profile.role) ? <Breakdown title="Por prioridad" values={byPriority} /> : null}
        <Breakdown title={isPremiumRole(profile.role) ? "Por estado" : "Mis incidencias por estado"} values={byStatus} />
      </div>

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
  const total = values.reduce((sum, item) => sum + item.value, 0);
  const chartBackground = buildConicGradient(values);
  const visibleValues = total > 0 ? values : [];

  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-muted">
          {total} total
        </span>
      </div>
      <div className={total > 0 ? "mt-4 grid gap-4 sm:grid-cols-[160px,1fr] sm:items-center" : "mt-3 space-y-3"}>
        {total > 0 ? (
          <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full p-4" style={{ background: chartBackground }}>
            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
              <span className="text-2xl font-bold text-slate-950">{total}</span>
              <span className="text-xs font-medium text-muted">incidencias</span>
            </div>
          </div>
        ) : (
          <div className="rounded-md bg-surface-subtle px-3 py-3 text-sm text-muted">
            Sin incidencias asignadas en esta comparativa.
          </div>
        )}
        <div className="space-y-2">
          {visibleValues.map((item, index) => {
            const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;

            return (
              <Link
                key={item.id}
                className="focus-ring flex min-h-11 items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50"
                href={item.href}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: chartColor(item, index) }}
                    aria-hidden="true"
                  />
                  <Badge label={item.label} color={item.color} className="max-w-[14rem] truncate" />
                </span>
                <span className="shrink-0 text-right text-sm font-semibold text-slate-950">
                  {item.value}
                  <span className="ml-1 text-xs font-medium text-muted">({percent}%)</span>
                </span>
              </Link>
            );
          })}
          {visibleValues.length === 0 ? <p className="text-sm text-muted">No hay datos para comparar.</p> : null}
        </div>
      </div>
    </div>
  );
}

const chartPalette = ["#b24000", "#111111", "#2563eb", "#16a34a", "#eab308", "#dc2626", "#7c3aed", "#0891b2"];

function chartColor(item: BreakdownItem, index: number) {
  return item.color || chartPalette[index % chartPalette.length];
}

function buildConicGradient(values: BreakdownItem[]) {
  const total = values.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0) {
    return "conic-gradient(#e5e7eb 0% 100%)";
  }

  let cursor = 0;
  const segments = values
    .map((item, index) => {
      if (item.value <= 0) return null;

      const start = cursor;
      cursor += (item.value / total) * 100;
      return `${chartColor(item, index)} ${start}% ${cursor}%`;
    })
    .filter(Boolean);

  return `conic-gradient(${segments.join(", ")})`;
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
