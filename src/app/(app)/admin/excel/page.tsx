import { Download, FileSpreadsheet } from "lucide-react";
import { ExcelImportPanel } from "@/components/excel/excel-import-panel";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { getExcelImports } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export default async function ExcelAdminPage() {
  await requireRole(["admin"]);
  const imports = await getExcelImports();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Excel"
        description="Prueba, importa o descarga incidencias en formato Excel."
        actions={
          <ButtonLink href="/admin/excel/export" variant="primary">
            <Download className="h-4 w-4" aria-hidden="true" />
            Descargar Excel
          </ButtonLink>
        }
      />

      <ExcelImportPanel />

      <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-950">Ultimos Excel guardados</h2>
        </div>
        {imports.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Todavia no se ha guardado ningun Excel en la app.</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {imports.map((item) => (
              <article key={item.id} className="grid gap-2 py-3 md:grid-cols-[minmax(220px,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950">{item.file_name}</p>
                  <p className="text-sm text-muted">
                    {item.rows_created} creadas, {item.rows_updated} actualizadas, {item.urgent_count} urgentes
                  </p>
                </div>
                <p className="text-sm text-muted">{formatDateTime(item.created_at)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
