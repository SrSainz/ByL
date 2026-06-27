import { AppShell } from "@/components/layout/app-shell";
import { requireProfile } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { isPremiumRole } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseConfig()) {
    redirect("/setup");
  }

  const profile = await requireProfile();
  let unreadCount = 0;

  if (isPremiumRole(profile.role)) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("read", false);

    unreadCount = count ?? 0;
  }

  return (
    <AppShell profile={profile} unreadCount={unreadCount}>
      {children}
    </AppShell>
  );
}
