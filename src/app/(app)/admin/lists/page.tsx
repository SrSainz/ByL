import { Trash2 } from "lucide-react";
import { createLookupAction, deleteLookupAction, updateLookupAction } from "@/app/actions/admin";
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
  const lookups = await getAllLookups();

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
            <form action={createLookupAction} className="mt-4 grid gap-3 sm:grid-cols-[minmax(220px,2fr)_120px_120px_minmax(160px,1fr)_auto]">
              <input type="hidden" name="table" value={section.table} />
              <input className="field min-w-0" name="name" placeholder="Nuevo valor" required />
              {section.sort ? <input className="field" name="sort_order" type="number" placeholder="Orden" /> : <span className="hidden sm:block" />}
              {section.color ? <input aria-label="Color" className="field h-10 p-1" name="color" type="color" defaultValue="#b24000" /> : <span className="hidden sm:block" />}
              {section.local ? (
                <select className="field min-w-0" name="local_id" defaultValue="">
                  <option value="">Sin local</option>
                  {lookups.locals.map((local) => <option key={local.id} value={local.id}>{local.name}</option>)}
                </select>
              ) : <span className="hidden sm:block" />}
              <button className="focus-ring rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Añadir</button>
            </form>
            <div className="mt-4 space-y-2">
              {dataByTable[section.table].map((item) => (
                <LookupRow
                  key={item.id}
                  item={item}
                  lookups={lookups.locals}
                  section={section}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function LookupRow({
  item,
  lookups,
  section
}: {
  item: LookupItem;
  lookups: LookupItem[];
  section: { table: LookupTable; title: string; sort?: boolean; local?: boolean; color?: boolean };
}) {
  const updateFormId = `lookup-update-${section.table}-${item.id}`;
  const deleteFormId = `lookup-delete-${section.table}-${item.id}`;

  return (
    <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(260px,2fr)_100px_96px_minmax(160px,1fr)_100px_auto_auto]">
      <form id={updateFormId} action={updateLookupAction} />
      <form id={deleteFormId} action={deleteLookupAction} />
      <input form={updateFormId} type="hidden" name="table" value={section.table} />
      <input form={updateFormId} type="hidden" name="id" value={item.id} />
      <input form={deleteFormId} type="hidden" name="table" value={section.table} />
      <input form={deleteFormId} type="hidden" name="id" value={item.id} />

      <input form={updateFormId} className="field min-w-0" name="name" defaultValue={item.name} />
      {section.sort ? (
        <input form={updateFormId} className="field" name="sort_order" type="number" defaultValue={item.sort_order ?? 0} />
      ) : <span className="hidden sm:block" />}
      {section.color ? (
        <input form={updateFormId} aria-label="Color" className="field h-10 p-1" name="color" type="color" defaultValue={item.color ?? "#b24000"} />
      ) : <span className="hidden sm:block" />}
      {section.local ? (
        <select form={updateFormId} className="field min-w-0" name="local_id" defaultValue={item.local_id ?? ""}>
          <option value="">Sin local</option>
          {lookups.map((local) => <option key={local.id} value={local.id}>{local.name}</option>)}
        </select>
      ) : <span className="hidden sm:block" />}
      <label className="inline-flex items-center gap-2 text-sm">
        <input form={updateFormId} name="active" type="checkbox" defaultChecked={item.active} />
        Activo
      </label>
      <button form={updateFormId} className="focus-ring rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-slate-50">
        Guardar
      </button>
      <button
        form={deleteFormId}
        aria-label={`Eliminar ${item.name}`}
        className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-3 py-2 text-white transition hover:bg-primary/90"
        title="Eliminar"
        type="submit"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
