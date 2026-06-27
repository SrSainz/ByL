import type { CSSProperties } from "react";
import { classNames } from "@/lib/format";

const toneByLabel: Record<string, string> = {
  Nueva: "bg-blue-50 text-blue-700 ring-blue-200",
  "En revisión": "bg-amber-50 text-amber-800 ring-amber-200",
  Asignada: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  "En proceso": "bg-indigo-50 text-indigo-800 ring-indigo-200",
  Resuelta: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  Cerrada: "bg-slate-100 text-slate-700 ring-slate-300",
  Cancelada: "bg-red-50 text-red-700 ring-red-200",
  Baja: "bg-slate-100 text-slate-700 ring-slate-300",
  Media: "bg-sky-50 text-sky-700 ring-sky-200",
  Alta: "bg-orange-50 text-orange-800 ring-orange-200",
  Urgente: "bg-red-50 text-red-700 ring-red-200"
};

export function Badge({
  label,
  color,
  className
}: {
  label?: string | null;
  color?: string | null;
  className?: string;
}) {
  if (!label) {
    return <span className="text-sm text-muted">-</span>;
  }

  const customStyle = color
    ? ({
        backgroundColor: color,
        borderColor: color,
        color: readableTextColor(color)
      } satisfies CSSProperties)
    : undefined;

  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        color ? "ring-transparent" : toneByLabel[label] ?? "bg-slate-100 text-slate-700 ring-slate-300",
        className
      )}
      style={customStyle}
    >
      {label}
    </span>
  );
}

function readableTextColor(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return "#ffffff";
  }

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return brightness > 145 ? "#171717" : "#ffffff";
}
