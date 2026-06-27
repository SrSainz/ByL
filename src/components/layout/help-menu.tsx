"use client";

import { CircleHelp } from "lucide-react";
import type { UserRole } from "@/lib/types";

const copyByRole: Record<UserRole, string[]> = {
  basic: [
    "Puedes crear incidencias y ver solo las tuyas.",
    "Puedes editar tus incidencias mientras sigan en estado Nueva.",
    "Puedes adjuntar una factura y revisar los datos detectados antes de guardar.",
    "No veras campos de administrador, gestion de usuarios, listas ni exportacion CSV."
  ],
  admin: [
    "Puedes ver y editar todas las incidencias, incluidos proveedor, prioridad, resolucion y estado.",
    "Puedes crear usuarios, cambiar roles, activar o desactivar accesos y gestionar listas.",
    "Puedes archivar o borrar incidencias, revisar facturas pendientes e importar documentos."
  ]
};

export function HelpMenu({ role }: { role: UserRole }) {
  return (
    <details className="relative">
      <summary
        aria-label="Ayuda"
        className="focus-ring inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-white text-slate-800 hover:bg-surface-subtle"
        data-tour="help-button"
      >
        <CircleHelp className="h-5 w-5" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-white p-4 text-sm shadow-lg">
        <h2 className="font-semibold text-slate-950">Ayuda rapida</h2>
        <div className="mt-3 space-y-2 text-slate-700">
          {copyByRole[role].map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
        <button
          className="focus-ring mt-4 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"
          type="button"
          onClick={() => window.dispatchEvent(new Event("byl:start-tour"))}
        >
          Iniciar tutorial guiado
        </button>
      </div>
    </details>
  );
}
