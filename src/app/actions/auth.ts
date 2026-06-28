"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type AuthState = {
  error?: string;
  success?: string;
};

export async function signInAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!identifier || !password) {
    return { error: "Introduce email o nombre de usuario y contraseña." };
  }

  const email = await resolveLoginEmail(identifier);

  if (!email) {
    return { error: "No se ha encontrado un usuario activo con ese email o nombre." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "No se ha podido iniciar sesión. Revisa las credenciales." };
  }

  redirect("/dashboard");
}

async function resolveLoginEmail(identifier: string) {
  if (identifier.includes("@")) {
    return identifier;
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("email")
    .eq("active", true)
    .ilike("full_name", identifier)
    .limit(2);

  if (error || !data || data.length !== 1) {
    return null;
  }

  return data[0].email;
}

export async function resetPasswordAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") || "").trim();
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!email) {
    return { error: "Introduce tu email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/login`
  });

  if (error) {
    return { error: "No se ha podido enviar el enlace de recuperación." };
  }

  return { success: "Te hemos enviado un enlace de recuperación si el email existe." };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changeOwnPasswordAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const profile = await requireProfile();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "No se ha podido actualizar la contraseña." };
  }

  await supabase
    .from("profiles")
    .update({
      must_change_password: false,
      provided_password: null
    })
    .eq("id", profile.id);

  revalidatePath("/dashboard");
  return { success: "Contraseña actualizada correctamente." };
}
