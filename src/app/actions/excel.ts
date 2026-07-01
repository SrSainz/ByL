"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { runExcelImport, type ExcelImportSummary } from "@/lib/excel-sync";

export type ExcelImportState = {
  error?: string;
  summary?: ExcelImportSummary;
};

export async function importExcelAction(
  _: ExcelImportState,
  formData: FormData
): Promise<ExcelImportState> {
  const profile = await requireRole(["admin"]);
  const file = formData.get("excel");
  const mode = String(formData.get("mode") || "preview");
  const save = mode === "save";

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un Excel antes de continuar." };
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { error: "Sube un archivo .xlsx." };
  }

  if (file.size > 8 * 1024 * 1024) {
    return { error: "El Excel es demasiado grande." };
  }

  try {
    const summary = await runExcelImport({
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
      profile,
      save
    });

    if (save) {
      revalidatePath("/dashboard");
      revalidatePath("/incidents");
      revalidatePath("/admin/excel");
      revalidatePath("/admin/lists");
    }

    return { summary };
  } catch {
    return { error: "No se ha podido leer el Excel. Revisa que tenga una hoja de Incidencias." };
  }
}
