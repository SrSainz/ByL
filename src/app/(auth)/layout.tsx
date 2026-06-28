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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fffdf7_0,#f1eee6_42%,#e8ded1_100%)] px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_420px]">
        <section className="hidden lg:block">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Mantenimiento ByL</p>
          <h2 className="mt-4 max-w-xl text-4xl font-semibold leading-tight text-slate-950">
            Incidencias, facturas y seguimiento en un solo sitio.
          </h2>
          <p className="mt-4 max-w-lg text-base text-muted">
            Los usuarios basic registran avisos de forma sencilla. Administración revisa, asigna, adjunta facturas y cierra cada caso con trazabilidad.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/70 bg-white/70 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-950">Para usuarios</p>
              <p className="mt-1 text-sm text-muted">Crea una incidencia, adjunta una factura y consulta el estado.</p>
            </div>
            <div className="rounded-lg border border-white/70 bg-white/70 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-950">Para admin</p>
              <p className="mt-1 text-sm text-muted">Gestiona usuarios, listas, importes, estados y facturas pendientes.</p>
            </div>
          </div>
        </section>
        <div className="w-full rounded-lg border border-border bg-white/95 p-6 shadow-xl shadow-black/5 backdrop-blur">
          {children}
        </div>
      </div>
    </main>
  );
}
