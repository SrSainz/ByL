import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { incidentsToCsv } from "@/lib/csv";
import { getIncidents, parseFilters } from "@/lib/data";

export async function GET(request: NextRequest) {
  const profile = await requireProfile();
  const filters = parseFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const incidents = await getIncidents(profile, filters);
  const csv = incidentsToCsv(incidents);

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="incidencias-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
