import Link from "next/link";
import Image from "next/image";
import {
  Bell,
  FileText,
  Home,
  ListChecks,
  LogOut,
  Menu,
  Settings2,
  User,
  Users
} from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { GuidedTour } from "@/components/layout/guided-tour";
import { HelpMenu } from "@/components/layout/help-menu";
import { PasswordChangeGuard } from "@/components/layout/password-change-guard";
import { getInitials } from "@/lib/format";
import { isAdmin, isPremiumRole } from "@/lib/permissions";
import type { Profile } from "@/lib/types";

const navBase = "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-100";

export function AppShell({
  profile,
  unreadCount,
  children
}: {
  profile: Profile;
  unreadCount: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-3 font-semibold text-slate-950">
            <Image
              alt="Logo APP Mantenimiento ByL"
              className="h-10 w-10 rounded-md"
              height={40}
              src="/logo-byl.png"
              width={40}
            />
            <span className="hidden sm:inline">Gestión de incidencias</span>
            <span className="sm:hidden">Incidencias</span>
          </Link>
          <div className="flex items-center gap-2">
            <HelpMenu role={profile.role} />
            {isPremiumRole(profile.role) ? (
              <Link
                href="/notifications"
                className="focus-ring relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-white text-slate-700 hover:bg-slate-50"
                aria-label="Notificaciones"
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-danger px-1.5 text-center text-xs font-bold text-white">
                    {unreadCount}
                  </span>
                ) : null}
              </Link>
            ) : null}
            <details className="relative" data-tour="profile-menu">
              <summary className="focus-ring flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                {getInitials(profile.full_name, profile.email)}
              </summary>
              <div className="absolute right-0 mt-2 w-64 rounded-lg border border-border bg-white p-2 shadow-lg">
                <div className="border-b border-border px-3 py-2">
                  <p className="truncate text-sm font-semibold">{profile.full_name || profile.email}</p>
                  <p className="text-xs uppercase tracking-wide text-muted">{profile.role}</p>
                </div>
                <Link href="/profile" className={navBase}>
                  <User className="h-4 w-4" aria-hidden="true" />
                  Perfil
                </Link>
                <form action={signOutAction}>
                  <button className={`${navBase} w-full`} type="submit">
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Salir
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 md:grid-cols-[240px_1fr]">
        <aside className="hidden rounded-lg border border-border bg-white p-2 md:block">
          <nav className="space-y-1">
            <Link href="/dashboard" className={navBase} data-tour="nav-dashboard">
              <Home className="h-4 w-4" aria-hidden="true" />
              Inicio
            </Link>
            <Link href="/incidents" className={navBase} data-tour="nav-incidents">
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              Incidencias
            </Link>
            {isPremiumRole(profile.role) ? (
              <Link href="/notifications" className={navBase} data-tour="nav-notifications">
                <Bell className="h-4 w-4" aria-hidden="true" />
                Notificaciones
              </Link>
            ) : null}
            {isAdmin(profile.role) ? (
              <>
                <Link href="/admin/users" className={navBase} data-tour="nav-users">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  Usuarios
                </Link>
                <Link href="/admin/lists" className={navBase} data-tour="nav-lists">
                  <Settings2 className="h-4 w-4" aria-hidden="true" />
                  Listas
                </Link>
                <Link href="/admin/invoices" className={navBase} data-tour="nav-invoices">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Facturas
                </Link>
              </>
            ) : null}
          </nav>
        </aside>

        <details className="rounded-lg border border-border bg-white p-2 md:hidden">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-2 text-sm font-semibold">
            <Menu className="h-5 w-5" aria-hidden="true" />
            Menú
          </summary>
          <nav className="mt-2 space-y-1">
            <Link href="/dashboard" className={navBase} data-tour="nav-dashboard">Inicio</Link>
            <Link href="/incidents" className={navBase} data-tour="nav-incidents">Incidencias</Link>
            {isPremiumRole(profile.role) ? <Link href="/notifications" className={navBase} data-tour="nav-notifications">Notificaciones</Link> : null}
            {isAdmin(profile.role) ? <Link href="/admin/users" className={navBase} data-tour="nav-users">Usuarios</Link> : null}
            {isAdmin(profile.role) ? <Link href="/admin/lists" className={navBase} data-tour="nav-lists">Listas</Link> : null}
            {isAdmin(profile.role) ? <Link href="/admin/invoices" className={navBase} data-tour="nav-invoices">Facturas</Link> : null}
          </nav>
        </details>

        <main className="min-w-0">{children}</main>
      </div>
      <GuidedTour role={profile.role} />
      <PasswordChangeGuard mustChange={profile.must_change_password} />
    </div>
  );
}
