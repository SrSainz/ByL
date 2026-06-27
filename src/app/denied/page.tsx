import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function DeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-lg rounded-lg border border-border bg-white p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto h-12 w-12 text-danger" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold text-slate-950">Acceso denegado</h1>
        <p className="mt-2 text-sm text-muted">
          Tu usuario no tiene permisos para acceder a esta sección o está desactivado.
        </p>
        <Link className="mt-5 inline-flex text-sm font-semibold text-primary" href="/login">
          Volver al login
        </Link>
      </div>
    </main>
  );
}
