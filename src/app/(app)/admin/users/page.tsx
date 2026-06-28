import { createUserAction, updateUserAction } from "@/app/actions/admin";
import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

const roleOptions: UserRole[] = ["basic", "admin"];

export default async function UsersAdminPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  const users = (data ?? []) as Profile[];
  const groups = [
    { role: "admin" as const, title: "Administradores", users: users.filter((user) => user.role === "admin") },
    { role: "basic" as const, title: "Usuarios básicos", users: users.filter((user) => user.role === "basic") }
  ];

  return (
    <div>
      <PageHeader title="Gestión de usuarios" description="Crea usuarios, cambia roles y activa o desactiva accesos." />

      <section className="rounded-lg border border-border bg-white p-4" data-tour="user-management">
        <h2 className="text-base font-semibold text-slate-950">Crear usuario</h2>
        <form action={createUserAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_160px_1fr_auto]">
          <input className="field" name="email" type="email" placeholder="email@empresa.com" required />
          <input className="field" name="full_name" placeholder="Nombre completo" />
          <select className="field" name="role" defaultValue="basic">
            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <input className="field" name="password" type="text" placeholder="Contraseña proporcionada" required />
          <button className="focus-ring rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Crear</button>
        </form>
      </section>

      <div className="mt-5 space-y-5">
        {groups.map((group) => (
          <UserGroup key={group.role} title={group.title} users={group.users} />
        ))}
      </div>
    </div>
  );
}

function UserGroup({ title, users }: { title: string; users: Profile[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="border-b border-border bg-slate-50 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="text-xs text-muted">{users.length} usuario{users.length === 1 ? "" : "s"}</p>
      </div>

      {users.length === 0 ? (
        <p className="p-4 text-sm text-muted">No hay usuarios en este grupo.</p>
      ) : (
        <>
          <div className="hidden">
            {users.map((user) => (
              <form key={user.id} id={`user-form-${user.id}`} action={updateUserAction} />
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Contraseña</th>
                  <th className="px-4 py-3">Activo</th>
                  <th className="px-4 py-3">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => <UserTableRow key={user.id} user={user} />)}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-border md:hidden">
            {users.map((user) => (
              <div key={user.id} className="p-4">
                <UserMobileCard user={user} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function UserTableRow({ user }: { user: Profile }) {
  const formId = `user-form-${user.id}`;

  return (
    <tr>
      <td className="px-4 py-3">
        {user.email}
        <input form={formId} type="hidden" name="id" value={user.id} />
      </td>
      <td className="px-4 py-3">
        <input form={formId} className="field" name="full_name" defaultValue={user.full_name ?? ""} />
      </td>
      <td className="px-4 py-3">
        <select form={formId} className="field" name="role" defaultValue={user.role}>
          {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          form={formId}
          className="field"
          name="provided_password"
          defaultValue={user.provided_password ?? ""}
          placeholder="Nueva contraseña"
          type="text"
        />
      </td>
      <td className="px-4 py-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input form={formId} name="active" type="checkbox" defaultChecked={user.active} />
          Activo
        </label>
      </td>
      <td className="px-4 py-3">
        <button form={formId} className="focus-ring w-full rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
          Guardar
        </button>
      </td>
    </tr>
  );
}

function UserMobileCard({ user }: { user: Profile }) {
  return (
    <form action={updateUserAction} className="space-y-3">
      <input type="hidden" name="id" value={user.id} />
      <p className="font-semibold">{user.email}</p>
      <div>
        <label className="label">Nombre</label>
        <input className="field" name="full_name" defaultValue={user.full_name ?? ""} />
      </div>
      <div>
        <label className="label">Rol</label>
        <select className="field" name="role" defaultValue={user.role}>
          {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Contraseña proporcionada</label>
        <input
          className="field"
          name="provided_password"
          defaultValue={user.provided_password ?? ""}
          placeholder="Nueva contraseña"
          type="text"
        />
      </div>
      <label className="inline-flex items-center gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={user.active} />
        Activo
      </label>
      <button className="focus-ring w-full rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
        Guardar
      </button>
    </form>
  );
}
