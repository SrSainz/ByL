import Link from "next/link";
import { Check } from "lucide-react";
import { markNotificationReadAction } from "@/app/actions/incidents";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth";
import { getNotifications } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export default async function NotificationsPage() {
  const profile = await requireRole(["admin"]);
  const notifications = await getNotifications(profile);

  return (
    <div>
      <PageHeader title="Notificaciones" description="Avisos internos generados por nuevas incidencias basic." />
      {notifications.length === 0 ? (
        <EmptyState title="Sin notificaciones" description="Cuando un usuario basic cree una incidencia aparecerá aquí." />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <article key={notification.id} className="rounded-lg border border-border bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">{notification.title}</p>
                  <p className="mt-1 text-sm text-slate-700">{notification.message}</p>
                  <p className="mt-2 text-xs text-muted">{formatDateTime(notification.created_at)}</p>
                  {notification.incident_id ? (
                    <Link className="mt-2 inline-flex text-sm font-semibold text-primary" href={`/incidents/${notification.incident_id}`}>
                      Abrir incidencia
                    </Link>
                  ) : null}
                </div>
                {notification.read ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Leída</span>
                ) : (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notification_id" value={notification.id} />
                    <Button type="submit" variant="secondary">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Marcar leída
                    </Button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
