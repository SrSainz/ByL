"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { UserRole } from "@/lib/types";

type Step = {
  selector: string;
  title: string;
  body: string;
};

type TargetRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

const roleSteps: Record<UserRole, Step[]> = {
  basic: [
    {
      selector: "[data-tour='nav-dashboard']",
      title: "Inicio",
      body: "Aquí ves el resumen de tus incidencias, las abiertas, las resueltas y las últimas que has creado."
    },
    {
      selector: "[data-tour='nav-incidents']",
      title: "Incidencias",
      body: "Entra aquí para registrar una incidencia nueva y consultar tu historial. En móvil lo tienes siempre en la barra inferior."
    },
    {
      selector: "[data-tour='invoice-upload']",
      title: "Factura PDF",
      body: "Puedes adjuntar una factura y usar Leer factura. La app propone datos, pero tú siempre revisas antes de guardar."
    },
    {
      selector: "[data-tour='incident-form']",
      title: "Guardar aviso",
      body: "Rellena fecha, local, una o varias zonas, responsable y descripción. Si el estado sigue en Nueva podrás editarla."
    },
    {
      selector: "[data-tour='help-button']",
      title: "Ayuda e instalación",
      body: "Este botón abre la guía, explica tu rol y muestra cómo instalar la web como app en móvil o Windows."
    }
  ],
  admin: [
    {
      selector: "[data-tour='nav-dashboard']",
      title: "Inicio admin",
      body: "Tienes visión global de incidencias, estados, prioridades y avisos pendientes."
    },
    {
      selector: "[data-tour='nav-incidents']",
      title: "Gestión de incidencias",
      body: "Puedes ver todas las incidencias, filtrar, editar seguimiento, cambiar estados y adjuntar facturas."
    },
    {
      selector: "[data-tour='nav-users'], [data-tour='user-management']",
      title: "Usuarios",
      body: "Crea usuarios basic o admin, activa accesos y deja registrada la contraseña proporcionada cuando corresponda."
    },
    {
      selector: "[data-tour='nav-lists']",
      title: "Listas y colores",
      body: "Gestiona locales, zonas, responsables, proveedores, prioridades, estados y los colores visibles en los badges."
    },
    {
      selector: "[data-tour='nav-invoices']",
      title: "Facturas pendientes",
      body: "Revisa PDFs importados, comprueba la lectura automática y decide si crear, enlazar o descartar cada factura."
    },
    {
      selector: "[data-tour='help-button']",
      title: "Ayuda por rol",
      body: "El botón de ayuda resume lo que puede hacer cada usuario y cómo instalar la aplicación."
    }
  ]
};

function visibleTarget(selector: string) {
  return Array.from(document.querySelectorAll(selector)).find((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

export function GuidedTour({ role }: { role: UserRole }) {
  const steps = useMemo(() => roleSteps[role], [role]);
  const storageKey = `byl-tour-completed-${role}-v2`;
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [isCompact, setIsCompact] = useState(false);

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
      const timer = window.setTimeout(start, 800);
      return () => window.clearTimeout(timer);
    }
  }, [start, storageKey]);

  useEffect(() => {
    const handler = () => start();
    window.addEventListener("byl:start-tour", handler);
    return () => window.removeEventListener("byl:start-tour", handler);
  }, [start]);

  useEffect(() => {
    const updateCompact = () => setIsCompact(window.innerWidth < 768);
    updateCompact();
    window.addEventListener("resize", updateCompact);
    return () => window.removeEventListener("resize", updateCompact);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const update = () => {
      const selector = steps[index]?.selector;
      const element = selector ? visibleTarget(selector) : null;

      if (!element) {
        setRect(null);
        return;
      }

      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      window.requestAnimationFrame(() => {
        const nextRect = element.getBoundingClientRect();
        setRect({
          left: nextRect.left,
          top: nextRect.top,
          width: nextRect.width,
          height: nextRect.height,
          right: nextRect.right,
          bottom: nextRect.bottom
        });
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [index, isOpen, steps]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") setIndex((value) => Math.min(value + 1, steps.length - 1));
      if (event.key === "ArrowLeft") setIndex((value) => Math.max(value - 1, 0));
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, isOpen, steps.length]);

  if (!isOpen) {
    return null;
  }

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const highlightStyle: CSSProperties | undefined = rect
    ? {
        left: Math.max(rect.left - 8, 8),
        top: Math.max(rect.top - 8, 8),
        width: rect.width + 16,
        height: rect.height + 16
      }
    : undefined;
  const cardStyle: CSSProperties | undefined =
    rect && !isCompact
      ? {
          left: rect.right + 360 < window.innerWidth ? rect.right + 20 : Math.max(rect.left - 380, 20),
          top: Math.min(Math.max(rect.top, 88), window.innerHeight - 280)
        }
      : undefined;

  return (
    <div aria-modal="true" className="fixed inset-0 z-50" role="dialog">
      <div className="absolute inset-0 bg-slate-950/70" />
      {highlightStyle ? (
        <div
          className="pointer-events-none fixed rounded-lg border-2 border-primary bg-white/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.7)] transition-all duration-200"
          style={highlightStyle}
        />
      ) : null}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-md rounded-t-lg border border-border bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl md:bottom-auto md:left-auto md:right-auto md:rounded-lg"
        style={cardStyle}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Paso {index + 1} de {steps.length}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">{step.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{step.body}</p>
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
