"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getIncidentById, getStatusByName } from "@/lib/data";
import { allowedIncidentUpdateFields, canArchiveOrDelete, canEditIncident, isPremiumRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type IncidentFormState = {
  error?: string;
};

function requiredString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function nullableString(formData: FormData, key: string) {
  const value = requiredString(formData, key);
  return value || null;
}

function nullableNumber(formData: FormData, key: string) {
  const value = requiredString(formData, key).replace(",", ".");
  if (!value) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function selectedZoneIds(formData: FormData) {
  return formData
    .getAll("zona_ids")
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function selectedAttachmentIds(formData: FormData) {
  return formData
    .getAll("attachment_ids")
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function validateBasic(formData: FormData) {
  const required = ["fecha_incidencia", "local_id", "descripcion", "responsable_aviso_id"];
  const missing = required.filter((field) => !requiredString(formData, field));

  if (missing.length > 0 || selectedZoneIds(formData).length === 0) {
    return "Completa fecha de incidencia, local, zona, descripcion y responsable.";
  }

  return null;
}

async function replaceIncidentZones(incidentId: string, zoneIds: string[]) {
  const supabase = await createClient();
  const uniqueZoneIds = [...new Set(zoneIds)];

  await supabase.from("incident_zones").delete().eq("incident_id", incidentId);

  if (uniqueZoneIds.length > 0) {
    await supabase.from("incident_zones").insert(
      uniqueZoneIds.map((zona_id) => ({
        incident_id: incidentId,
        zona_id
      }))
    );
  }
}

async function linkAttachments(incidentId: string, attachmentIds: string[]) {
  const uniqueAttachmentIds = [...new Set(attachmentIds)];
  if (uniqueAttachmentIds.length === 0) return;

  const supabase = await createClient();
  await supabase
    .from("incident_attachments")
    .update({ incident_id: incidentId, status: "linked" })
    .in("id", uniqueAttachmentIds);
}

export async function createIncidentAction(
  _: IncidentFormState,
  formData: FormData
): Promise<IncidentFormState> {
  const profile = await requireProfile();
  const validationError = validateBasic(formData);

  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const nueva = await getStatusByName("Nueva");
  const canUseAdminFields = isPremiumRole(profile.role);
  const zoneIds = selectedZoneIds(formData);

  const payload = {
    fecha_incidencia: requiredString(formData, "fecha_incidencia"),
    local_id: requiredString(formData, "local_id"),
    zona_id: zoneIds[0],
    descripcion: requiredString(formData, "descripcion"),
    responsable_aviso_id: requiredString(formData, "responsable_aviso_id"),
    proveedor_id: canUseAdminFields ? nullableString(formData, "proveedor_id") : null,
    prioridad_id: canUseAdminFields ? nullableString(formData, "prioridad_id") : null,
    importe_factura: canUseAdminFields ? nullableNumber(formData, "importe_factura") : null,
    fecha_resolucion: canUseAdminFields ? nullableString(formData, "fecha_resolucion") : null,
    estado_id: canUseAdminFields ? nullableString(formData, "estado_id") ?? nueva?.id ?? null : nueva?.id ?? null,
    created_by: profile.id,
    archived: false
  };

  const { data, error } = await supabase.from("incidents").insert(payload).select("id").single();

  if (error) {
    return { error: "No se ha podido crear la incidencia." };
  }

  await replaceIncidentZones(data.id, zoneIds);
  await linkAttachments(data.id, selectedAttachmentIds(formData));

  revalidatePath("/dashboard");
  revalidatePath("/incidents");
  redirect(`/incidents/${data.id}?created=1`);
}

export async function updateIncidentAction(
  incidentId: string,
  _: IncidentFormState,
  formData: FormData
): Promise<IncidentFormState> {
  const profile = await requireProfile();
  const incident = await getIncidentById(profile, incidentId);

  if (!incident) {
    return { error: "No se ha encontrado la incidencia." };
  }

  if (!canEditIncident(profile, incident)) {
    return { error: "No tienes permisos para editar esta incidencia." };
  }

  const validationError = validateBasic(formData);

  if (validationError) {
    return { error: validationError };
  }

  const zoneIds = selectedZoneIds(formData);
  const candidate = {
    fecha_incidencia: requiredString(formData, "fecha_incidencia"),
    local_id: requiredString(formData, "local_id"),
    zona_id: zoneIds[0],
    descripcion: requiredString(formData, "descripcion"),
    responsable_aviso_id: requiredString(formData, "responsable_aviso_id"),
    proveedor_id: nullableString(formData, "proveedor_id"),
    prioridad_id: nullableString(formData, "prioridad_id"),
    importe_factura: nullableNumber(formData, "importe_factura"),
    fecha_resolucion: nullableString(formData, "fecha_resolucion"),
    estado_id: nullableString(formData, "estado_id")
  };

  const allowed = new Set(allowedIncidentUpdateFields(profile.role));
  const payload = Object.fromEntries(Object.entries(candidate).filter(([key]) => allowed.has(key)));
  const supabase = await createClient();
  const { error } = await supabase.from("incidents").update(payload).eq("id", incidentId);

  if (error) {
    return { error: "No se ha podido actualizar la incidencia." };
  }

  await replaceIncidentZones(incidentId, zoneIds);
  await linkAttachments(incidentId, selectedAttachmentIds(formData));

  revalidatePath("/dashboard");
  revalidatePath("/incidents");
  revalidatePath(`/incidents/${incidentId}`);
  redirect(`/incidents/${incidentId}?updated=1`);
}

export async function archiveIncidentAction(formData: FormData) {
  const profile = await requireProfile();
  const incidentId = requiredString(formData, "incident_id");

  if (!canArchiveOrDelete(profile.role)) {
    redirect("/denied");
  }

  const supabase = await createClient();
  await supabase.from("incidents").update({ archived: true }).eq("id", incidentId);
  revalidatePath("/incidents");
  redirect("/incidents");
}

export async function deleteIncidentAction(formData: FormData) {
  const profile = await requireProfile();
  const incidentId = requiredString(formData, "incident_id");

  if (!canArchiveOrDelete(profile.role)) {
    redirect("/denied");
  }

  const supabase = await createClient();
  await supabase.from("incidents").delete().eq("id", incidentId);
  revalidatePath("/dashboard");
  revalidatePath("/incidents");
  redirect("/incidents");
}

export async function dismissAttachmentAction(formData: FormData) {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/denied");

  const attachmentId = requiredString(formData, "attachment_id");
  const supabase = await createClient();
  await supabase.from("incident_attachments").update({ status: "dismissed" }).eq("id", attachmentId);
  revalidatePath("/admin/invoices");
}

export async function markNotificationReadAction(formData: FormData) {
  const profile = await requireProfile();
  const notificationId = requiredString(formData, "notification_id");
  const supabase = await createClient();

  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", profile.id);

  revalidatePath("/notifications");
}
