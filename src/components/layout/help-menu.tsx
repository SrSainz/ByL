"use client";

import { useEffect, useState } from "react";
import { CircleHelp, Download, PlayCircle } from "lucide-react";
import type { UserRole } from "@/lib/types";

const copyByRole: Record<UserRole, string[]> = {
  basic: [
    "Crea incidencias y consulta solo las tuyas.",
    "Adjunta una factura PDF, pulsa Leer factura y revisa los datos antes de guardar.",
    "Puedes editar una incidencia propia mientras siga en estado Nueva.",
    "No verás gestión de usuarios, listas, estados internos ni exportación."
  ],
  admin: [
    "Ves y editas todas las incidencias, facturas, importes, prioridades y estados.",
    "Gestionas usuarios, contraseñas proporcionadas, roles, listas y colores.",
    "Puedes revisar facturas pendientes, archivar incidencias y mantener la configuración."
  ]
};

function getInstallHelp() {
  if (typeof navigator === "undefined") {
    return "Instala la app desde el navegador cuando aparezca el icono de instalación.";
  }

  const agent = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(agent)) {
    return "En iPhone o iPad: abre Safari, pulsa Compartir y elige Añadir a pantalla de inicio.";
  }

  if (/android/.test(agent)) {
    return "En Android: abre el menú del navegador y pulsa Instalar app o Añadir a pantalla de inicio.";
  }

  return "En Windows o escritorio: usa el icono de instalación de la barra del navegador o el menú del navegador.";
}

export function HelpMenu({ role }: { role: UserRole }) {
  const [installHelp, setInstallHelp] = useState("Instala la app desde el navegador cuando aparezca el icono de instalación.");

  useEffect(() => {
    const timer = window.setTimeout(() => setInstallHelp(getInstallHelp()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <details className="relative">
      <summary
        aria-label="Ayuda"
        className="focus-ring inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-white text-slate-800 hover:bg-surface-subtle"
        data-tour="help-button"
      >
        <CircleHelp className="h-5 w-5" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-[min(23rem,calc(100vw-2rem))] rounded-lg border border-border bg-white p-4 text-sm shadow-lg">
        <h2 className="font-semibold text-slate-950">Ayuda rápida</h2>
        <div className="mt-3 space-y-2 text-slate-700">
          {copyByRole[role].map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>

        <div className="mt-4 rounded-md border border-border bg-surface-subtle p-3">
          <p className="flex items-center gap-2 font-semibold text-slate-950">
            <Download className="h-4 w-4" aria-hidden="true" />
            Instalar como app
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">{installHelp}</p>
        </div>

        <button
          className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"
          type="button"
          onClick={() => window.dispatchEvent(new Event("byl:start-tour"))}
        >
          <PlayCircle className="h-4 w-4" aria-hidden="true" />
          Iniciar tutorial guiado
        </button>
      </div>
    </details>
  );
}
