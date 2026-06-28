"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { LookupTable, UserRole } from "@/lib/types";

const roles: UserRole[] = ["basic", "admin"];
const lookupTables: LookupTable[] = [
  "locals",
  "zones",
  "responsables_aviso",
  "providers",
  "priorities",
  "statuses"
];

function str(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function createUserAction(formData: FormData) {
  await requireRole(["admin"]);
  const email = str(formData, "email");
  const password = str(formData, "password");
  const fullName = str(formData, "full_name");
  const role = str(formData, "role") as UserRole;

  if (!email || !password || !roles.includes(role)) {
    return;
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName
    }
  });

  if (!error && data.user) {
    await admin.from("profiles").upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      role,
      active: true,
      provided_password: password,
      must_change_password: true
    });
  }

  revalidatePath("/admin/users");
}

export async function updateUserAction(formData: FormData) {
  await requireRole(["admin"]);
  const id = str(formData, "id");
  const role = str(formData, "role") as UserRole;
  const fullName = str(formData, "full_name");
  const providedPassword = str(formData, "provided_password");
  const active = formData.get("active") === "on";

  if (!id || !roles.includes(role)) {
    return;
  }

  const payload: Record<string, string | boolean> = {
    role,
    full_name: fullName,
    active
  };

  if (providedPassword) {
    const admin = getSupabaseAdmin();
    await admin.auth.admin.updateUserById(id, { password: providedPassword });
    payload.provided_password = providedPassword;
    payload.must_change_password = true;
  }

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update(payload)
    .eq("id", id);

  revalidatePath("/admin/users");
}

export async function createLookupAction(formData: FormData) {
  await requireRole(["admin"]);
  const table = str(formData, "table") as LookupTable;
  const name = str(formData, "name");
  const sortOrder = Number(str(formData, "sort_order") || "0");
  const localId = str(formData, "local_id") || null;
  const color = str(formData, "color") || null;

  if (!lookupTables.includes(table) || !name) {
    return;
  }

  const payload: Record<string, string | number | boolean | null> = {
    name,
    active: true
  };

  if (table === "priorities" || table === "statuses") {
    payload.sort_order = sortOrder;
    payload.color = color;
  }

  if (table === "zones") {
    payload.local_id = localId;
  }

  const supabase = await createClient();
  await supabase.from(table).insert(payload);
  revalidatePath("/admin/lists");
}

export async function updateLookupAction(formData: FormData) {
  await requireRole(["admin"]);
  const table = str(formData, "table") as LookupTable;
  const id = str(formData, "id");
  const name = str(formData, "name");
  const active = formData.get("active") === "on";
  const sortOrder = Number(str(formData, "sort_order") || "0");
  const localId = str(formData, "local_id") || null;
  const color = str(formData, "color") || null;

  if (!lookupTables.includes(table) || !id || !name) {
    return;
  }

  const payload: Record<string, string | number | boolean | null> = { name, active };

  if (table === "priorities" || table === "statuses") {
    payload.sort_order = sortOrder;
    payload.color = color;
  }

  if (table === "zones") {
    payload.local_id = localId;
  }

  const supabase = await createClient();
  await supabase.from(table).update(payload).eq("id", id);
  revalidatePath("/admin/lists");
}

export async function deleteLookupAction(formData: FormData) {
  await requireRole(["admin"]);
  const table = str(formData, "table") as LookupTable;
  const id = str(formData, "id");

  if (!lookupTables.includes(table) || !id) {
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);

  if (error) {
    await supabase.from(table).update({ active: false }).eq("id", id);
  }

  revalidatePath("/admin/lists");
  revalidatePath("/incidents");
}
