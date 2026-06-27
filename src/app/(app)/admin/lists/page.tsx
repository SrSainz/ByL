import { createLookupAction, updateLookupAction } from "@/app/actions/admin";
import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth";
import { getAllLookups } from "@/lib/data";
import type { LookupItem, LookupTable } from "@/lib/types";

const sections: Array<{ table: LookupTable; title: string; sort?: boolean; local?: boolean; color?: boolean }> = [
  { table: "locals", title: "Locales" },
  { table: "zones", title: "Zonas", local: true },
  { table: "responsables_aviso", title: "Responsables del aviso" },
  { table: "providers", title: "Proveedores" },
  { table: "priorities", title: "Prioridades", sort: true, color: true },
  { table: "statuses", title: "Estados", sort: true, color: true }
];

export default async function ListsAdminPage() {
  await requireRole(["admin"]);
  const lookups = await getAllLookups(false);

  const dataByTable: Record<LookupTable, LookupItem[]> = {
    locals: lookups.locals,
    zones: lookups.zones,
    responsables_aviso: lookups.responsables,
    providers: lookups.providers,
    priorities: lookups.priorities,
    statuses: lookups.statuses
  };

  return (
    <div>
      <PageHeader title="Gestión de listas" description="Administra los valores de los desplegables." />
      <div className="space-y-5">
        {sections.map((section) => (
          <section key={section.table} className="rounded-lg border border-border bg-white p-4">
            <h2 className="text-base font-semibold text-slate-950">{section.title}</h2>
            <form action={createLookupAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px_120px_1fr_auto]">
              <input type="hidden" name="table" value={section.table} />
              <input className="field" name="name" placeholder="Nuevo valor" required />
              {section.sort ? <input className="field" name="sort_order" type="number" placeholder="Orden" /> : <span className="hidden sm:block" />}
              {section.color ? <input aria-label="Color" className="field h-10 p-1" name="color" type="color" defaultValue="#b24000" /> : <span className="hidden sm:block" />}
              {section.local ? (
                <select className="field" name="local_id" defaultValue="">
                  <option value="">Sin local</option>
                  {lookups.locals.map((local) => <option key={local.id} value={local.id}>{local.name}</option>)}
                </select>
              ) : <span className="hidden sm:block" />}
              <button className="focus-ring rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Añadir</button>
            </form>
            <div className="mt-4 space-y-2">
              {dataByTable[section.table].map((item) => (
                <form key={item.id} action={updateLookupAction} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_120px_120px_1fr_120px_auto]">
                  <input type="hidden" name="table" value={section.table} />
                  <input type="hidden" name="id" value={item.id} />
                  <input className="field" name="name" defaultValue={item.name} />
                  {section.sort ? <input className="field" name="sort_order" type="number" defaultValue={item.sort_order ?? 0} /> : <span className="hidden sm:block" />}
                  {section.color ? <input aria-label="Color" className="field h-10 p-1" name="color" type="color" defaultValue={item.color ?? "#b24000"} /> : <span className="hidden sm:block" />}
                  {section.local ? (
                    <select className="field" name="local_id" defaultValue={item.local_id ?? ""}>
                      <option value="">Sin local</option>
                      {lookups.locals.map((local) => <option key={local.id} value={local.id}>{local.name}</option>)}
                    </select>
                  ) : <span className="hidden sm:block" />}
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input name="active" type="checkbox" defaultChecked={item.active} />
                    Activo
                  </label>
                  <button className="focus-ring rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-slate-50">Guardar</button>
                </form>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
