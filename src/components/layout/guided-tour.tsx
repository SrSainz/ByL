"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UserRole } from "@/lib/types";

type Step = {
  selector: string;
  title: string;
  body: string;
};

const roleSteps: Record<UserRole, Step[]> = {
  basic: [
    {
      selector: "[data-tour='nav-dashboard']",
      title: "Inicio",
      body: "Aqui ves tus incidencias, cuantas siguen abiertas y las ultimas que has creado."
    },
    {
      selector: "[data-tour='nav-incidents']",
      title: "Incidencias",
      body: "En la parte superior puedes crear una incidencia y en la inferior consultar tu historial."
    },
    {
      selector: "[data-tour='invoice-upload']",
      title: "Factura",
      body: "Adjunta un PDF y pulsa Leer factura para rellenar datos automaticamente. Revisa todo antes de guardar."
    },
    {
      selector: "[data-tour='incident-form']",
      title: "Datos obligatorios",
      body: "Rellena fecha, local, una o varias zonas, responsable y descripcion. Solo podras editar mientras este en estado Nueva."
    }
  ],
  admin: [
    {
      selector: "[data-tour='nav-dashboard']",
      title: "Inicio admin",
      body: "Tienes vision global de incidencias, estados, prioridades y notificaciones pendientes."
    },
    {
      selector: "[data-tour='nav-incidents']",
      title: "Gestion de incidencias",
      body: "Puedes ver todas las incidencias, usar filtros, editar campos de seguimiento y adjuntar facturas."
    },
    {
      selector: "[data-tour='nav-users'], [data-tour='user-management']",
      title: "Usuarios",
      body: "Crea usuarios, asigna rol basic o admin, activa o desactiva accesos y registra la contrasena proporcionada."
    },
    {
      selector: "[data-tour='nav-lists']",
      title: "Listas",
      body: "Gestiona locales, zonas, responsables, proveedores, prioridades, estados y colores de badges."
    },
    {
      selector: "[data-tour='nav-invoices']",
      title: "Facturas",
      body: "Revisa PDFs importados o pendientes y descarta los que no deban vincularse a incidencias."
    }
  ]
};

export function GuidedTour({ role }: { role: UserRole }) {
  const steps = useMemo(() => roleSteps[role], [role]);
  const storageKey = `byl-tour-completed-${role}`;
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const close = useCallback(() => {
    window.localStorage.setItem(storageKey, "true");
    setIsOpen(false);
  }, [storageKey]);

  const start = useCallback(() => {
    setIndex(0);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    const completed = window.localStorage.getItem(storageKey);
    if (!completed) {
      const timer = window.setTimeout(start, 600);
      return () => window.clearTimeout(timer);
    }
  }, [start, storageKey]);

  useEffect(() => {
    const handler = () => start();
    window.addEventListener("byl:start-tour", handler);
    return () => window.removeEventListener("byl:start-tour", handler);
  }, [start]);

  useEffect(() => {
    if (!isOpen) return;

    const update = () => {
      const element = Array.from(document.querySelectorAll(steps[index]?.selector)).find((candidate) => {
        const candidateRect = candidate.getBoundingClientRect();
        return candidateRect.width > 0 && candidateRect.height > 0;
      });
      if (element) {
        const nextRect = element.getBoundingClientRect();
        setRect(nextRect);
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      } else {
        setRect(null);
      }
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [index, isOpen, steps]);

  if (!isOpen) {
    return null;
  }

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const highlightStyle = rect
    ? {
        left: rect.left - 8,
        top: rect.top - 8,
        width: rect.width + 16,
        height: rect.height + 16
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-950/65" />
      {highlightStyle ? (
        <div
          className="pointer-events-none fixed rounded-lg border-2 border-primary bg-white/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.65)]"
          style={highlightStyle}
        />
      ) : null}
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border border-border bg-white p-4 shadow-xl sm:bottom-6 sm:left-auto sm:right-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Paso {index + 1} de {steps.length}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">{step.title}</h2>
        <p className="mt-2 text-sm text-slate-700">{step.body}</p>
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <button className="focus-ring rounded-md px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-subtle" onClick={close}>
            Omitir
          </button>
          <div className="flex gap-2">
            <button
              className="focus-ring rounded-md border border-border px-3 py-2 text-sm font-semibold disabled:opacity-40"
              disabled={index === 0}
              onClick={() => setIndex((value) => Math.max(value - 1, 0))}
            >
              Anterior
            </button>
            <button
              className="focus-ring rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"
              onClick={() => (isLast ? close() : setIndex((value) => value + 1))}
            >
              {isLast ? "Finalizar" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
