import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getAllLookups, getCustomListGroups, getIncidents } from "@/lib/data";
import { buildExcelWorkbook } from "@/lib/excel-sync";

export const runtime = "nodejs";

export async function GET() {
  const profile = await requireRole(["admin"]);
  const [incidents, lookups, customGroups] = await Promise.all([
    getIncidents(profile),
    getAllLookups(),
    getCustomListGroups()
  ]);
  const buffer = await buildExcelWorkbook({ incidents, lookups, customGroups });
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="incidencias-byl-${date}.xlsx"`
    }
  });
}
