import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseConfig()) {
    redirect("/setup");
  }

  const profile = await getCurrentProfile();

  if (profile?.active) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}
