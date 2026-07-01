import Link from "next/link";
import Image from "next/image";
import {
  Bell,
  FileSpreadsheet,
  FileText,
  Home,
  ListChecks,
  LogOut,
  Settings2,
  User,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { ActiveLink } from "@/components/layout/active-link";
import { GuidedTour } from "@/components/layout/guided-tour";
import { HelpMenu } from "@/components/layout/help-menu";
import { PasswordChangeGuard } from "@/components/layout/password-change-guard";
import { RealtimeRefresh } from "@/components/layout/realtime-refresh";
import { getInitials } from "@/lib/format";
import { isAdmin, isPremiumRole } from "@/lib/permissions";
import type { Profile } from "@/lib/types";

const navBase = "focus-ring flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-100";
const navActive = "bg-primary/10 text-primary hover:bg-primary/10";
const mobileNavBase =
  "focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-semibold text-slate-700 hover:bg-surface-subtle";
const mobileNavActive = "bg-primary/10 text-primary hover:bg-primary/10";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  tour: string;
};

export function AppShell({
  profile,
  unreadCount,
  children
}: {
  profile: Profile;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Inicio", icon: Home, tour: "nav-dashboard" },
    { href: "/incidents", label: "Incidencias", icon: ListChecks, tour: "nav-incidents" }
  ];

  if (isPremiumRole(profile.role)) {
    navItems.push({ href: "/notifications", label: "Notificaciones", icon: Bell, tour: "nav-notifications" });
  }

  if (isAdmin(profile.role)) {
    navItems.push(
      { href: "/admin/users", label: "Usuarios", icon: Users, tour: "nav-users" },
      { href: "/admin/lists", label: "Listas", icon: Settings2, tour: "nav-lists" },
      { href: "/admin/invoices", label: "Facturas", icon: FileText, tour: "nav-invoices" },
      { href: "/admin/excel", label: "Excel", icon: FileSpreadsheet, tour: "nav-excel" }
    );
  } else {
    navItems.push({ href: "/profile", label: "Perfil", icon: User, tour: "nav-profile" });
  }

  const mobileItems = navItems.filter((item) => item.href !== "/notifications").slice(0, 6);

  return (
    <div className="min-h-dvh bg-background">
      <header className="safe-top sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
        <div className="mobile-safe-x mx-auto flex max-w-7xl items-center justify-between gap-3 py-3">
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

      <div className="mobile-safe-x mx-auto grid max-w-7xl gap-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:grid-cols-[240px_1fr] md:pb-4">
        <aside className="sticky top-[calc(5rem+env(safe-area-inset-top))] hidden h-fit rounded-lg border border-border bg-white p-2 md:block">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <ActiveLink
                  key={item.href}
                  href={item.href}
                  className={navBase}
                  activeClassName={navActive}
                  data-tour={item.tour}
                  exact={item.href === "/dashboard"}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </ActiveLink>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>

      <nav
        aria-label="Navegación principal"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 px-2 pt-2 shadow-[0_-12px_30px_rgba(23,23,23,0.08)] backdrop-blur md:hidden"
      >
        <div
          className="mx-auto grid max-w-lg gap-1"
          style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
        >
          {mobileItems.map((item) => {
            const Icon = item.icon;
            return (
              <ActiveLink
                key={item.href}
                href={item.href}
                className={mobileNavBase}
                activeClassName={mobileNavActive}
                data-tour={item.tour}
                exact={item.href === "/dashboard"}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="max-w-full truncate">{item.label}</span>
              </ActiveLink>
            );
          })}
        </div>
      </nav>

      <GuidedTour role={profile.role} />
      <PasswordChangeGuard mustChange={profile.must_change_password} />
      <RealtimeRefresh enabled={isAdmin(profile.role)} />
    </div>
  );
}
