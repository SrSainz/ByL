import { Settings } from "lucide-react";

export default function SetupPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-white">
            <Settings className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Configuración pendiente</h1>
            <p className="mt-2 text-sm text-muted">
              Crea `.env.local` con las claves de Supabase y reinicia el servidor local.
            </p>
          </div>
        </div>

        <pre className="mt-5 overflow-x-auto rounded-md bg-slate-950 p-4 text-sm text-white">
{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000`}
        </pre>
      </div>
    </main>
  );
}
