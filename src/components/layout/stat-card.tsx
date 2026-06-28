import Link from "next/link";
import type { ReactNode } from "react";
import { classNames } from "@/lib/format";

export function StatCard({
  label,
  value,
  detail,
  icon,
  href
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon?: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon ? <div className="text-slate-400">{icon}</div> : null}
      </div>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
      {detail ? <p className="mt-1 text-sm text-muted">{detail}</p> : null}
    </>
  );
  const className = classNames(
    "rounded-lg border border-border bg-white p-4 transition",
    href && "focus-ring block hover:border-primary/60 hover:shadow-sm"
  );

  if (href) {
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}
