"use client";

import { useActionState } from "react";
import { CheckCircle2, FileSpreadsheet, UploadCloud } from "lucide-react";
import { importExcelAction, type ExcelImportState } from "@/app/actions/excel";
import { Button } from "@/components/ui/button";

export function ExcelImportPanel() {
  const [state, formAction, pending] = useActionState<ExcelImportState, FormData>(importExcelAction, {});
  const summary = state.summary;

  return (
    <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Subir Excel</h2>
          <p className="mt-1 text-sm text-muted">
            Primero puedes probarlo sin guardar. Cuando este revisado, guardalo en la app.
          </p>
        </div>
        <FileSpreadsheet className="h-6 w-6 text-primary" aria-hidden="true" />
      </div>

      <form action={formAction} className="mt-4 space-y-3">
        <input className="field" type="file" name="excel" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="mode" value="preview" variant="secondary" disabled={pending}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {pending ? "Leyendo..." : "Probar Excel"}
          </Button>
          <Button type="submit" name="mode" value="save" disabled={pending}>
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            {pending ? "Guardando..." : "Guardar en la app"}
          </Button>
        </div>
      </form>

      {state.error ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      {summary ? (
        <div className="mt-4 rounded-md bg-surface-subtle p-3">
          <p className="font-semibold text-slate-950">
            {summary.saved ? "Excel guardado." : "Excel probado sin guardar nada."}
          </p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Result label="Filas leidas" value={summary.rowsTotal} />
            <Result label="Creadas" value={summary.rowsCreated} />
            <Result label="Actualizadas" value={summary.rowsUpdated} />
            <Result label="Urgentes" value={summary.urgentCount} />
            <Result label="Sin guardar" value={summary.rowsSkipped} />
          </dl>
          {summary.errors.length > 0 ? (
            <div className="mt-3 rounded-md border border-border bg-white p-3 text-sm text-muted">
              <p className="font-semibold text-slate-800">Avisos</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {summary.errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Result({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-white p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-bold text-slate-950">{value}</dd>
    </div>
  );
}
