import { ChevronDown, Plus, Save, Trash2 } from "lucide-react";
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
      <div className="space-y-3">
        {sections.map((section, index) => (
          <LookupSection
            key={section.table}
            items={dataByTable[section.table]}
            locals={lookups.locals}
            open={index === 0}
            section={section}
          />
        ))}
      </div>
    </div>
  );
}

function LookupSection({
  section,
  items,
  locals,
  open
}: {
  section: { table: LookupTable; title: string; sort?: boolean; local?: boolean; color?: boolean };
  items: LookupItem[];
  locals: LookupItem[];
  open: boolean;
}) {
  const activeCount = items.filter((item) => item.active).length;

  return (
    <details className="group rounded-lg border border-border bg-white shadow-sm" open={open}>
      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-4 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-950">{section.title}</h2>
          <p className="mt-1 text-sm text-muted">
            {items.length} valores, {activeCount} activos
          </p>
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 text-muted transition group-open:rotate-180" aria-hidden="true" />
      </summary>

      <div className="border-t border-border px-4 pb-4">
        <form action={createLookupAction} className="mt-4 rounded-md bg-surface-subtle p-3">
          <input type="hidden" name="table" value={section.table} />
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto]">
            <label className="space-y-1">
              <span className="label">Nuevo valor</span>
              <input className="field w-full min-w-0" name="name" placeholder="Escribe el nombre completo" required />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-end">
              {section.sort ? (
                <label className="space-y-1">
                  <span className="label">Orden</span>
                  <input className="field w-full lg:w-24" name="sort_order" type="number" placeholder="0" />
                </label>
              ) : null}
              {section.color ? (
                <label className="space-y-1">
                  <span className="label">Color</span>
                  <input aria-label="Color" className="field h-11 w-full p-1 lg:w-20" name="color" type="color" defaultValue="#b24000" />
                </label>
              ) : null}
              {section.local ? (
                <label className="space-y-1 sm:col-span-2 lg:col-span-1">
                  <span className="label">Local asociado</span>
                  <select className="field w-full min-w-0 lg:w-64" name="local_id" defaultValue="">
                    <option value="">Sin local</option>
                    {locals.map((local) => <option key={local.id} value={local.id}>{local.name}</option>)}
                  </select>
                </label>
              ) : null}
              <button className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Añadir
              </button>
            </div>
          </div>
        </form>

        <div className="mt-4 max-h-[68vh] space-y-2 overflow-auto pr-1">
          {items.map((item) => (
            <LookupRow
              key={item.id}
              item={item}
              lookups={locals}
              section={section}
            />
          ))}
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
              Todavía no hay valores en esta lista.
            </p>
          ) : null}
        </div>
      </div>
    </details>
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
    <div className="rounded-md border border-border bg-white p-3">
      <form id={updateFormId} action={updateLookupAction} />
      <form id={deleteFormId} action={deleteLookupAction} />
      <input form={updateFormId} type="hidden" name="table" value={section.table} />
      <input form={updateFormId} type="hidden" name="id" value={item.id} />
      <input form={deleteFormId} type="hidden" name="table" value={section.table} />
      <input form={deleteFormId} type="hidden" name="id" value={item.id} />

      <div className="grid gap-3 xl:grid-cols-[minmax(320px,1fr)_auto]">
        <label className="min-w-0 space-y-1">
          <span className="label">Nombre</span>
          <input
            form={updateFormId}
            className="field w-full min-w-0"
            name="name"
            defaultValue={item.name}
            title={item.name}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:flex xl:items-end">
          {section.sort ? (
            <label className="space-y-1">
              <span className="label">Orden</span>
              <input form={updateFormId} className="field w-full xl:w-24" name="sort_order" type="number" defaultValue={item.sort_order ?? 0} />
            </label>
          ) : null}
          {section.color ? (
            <label className="space-y-1">
              <span className="label">Color</span>
              <input form={updateFormId} aria-label="Color" className="field h-11 w-full p-1 xl:w-20" name="color" type="color" defaultValue={item.color ?? "#b24000"} />
            </label>
          ) : null}
          {section.local ? (
            <label className="space-y-1 sm:col-span-2 lg:col-span-1">
              <span className="label">Local</span>
              <select form={updateFormId} className="field w-full min-w-0 xl:w-64" name="local_id" defaultValue={item.local_id ?? ""}>
                <option value="">Sin local</option>
                {lookups.map((local) => <option key={local.id} value={local.id}>{local.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm">
            <input form={updateFormId} name="active" type="checkbox" defaultChecked={item.active} />
            Activo
          </label>
          <button form={updateFormId} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-slate-50">
            <Save className="h-4 w-4" aria-hidden="true" />
            Guardar
          </button>
          <button
            form={deleteFormId}
            aria-label={`Eliminar ${item.name}`}
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-3 py-2 text-white transition hover:bg-primary/90"
            title="Eliminar"
            type="submit"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
