import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentProfile();

  if (!profile?.active) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data: attachment, error } = await supabase
    .from("incident_attachments")
    .select("id,file_path")
    .eq("id", id)
    .maybeSingle();

  if (error || !attachment) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const admin = getSupabaseAdmin();
  const signed = await admin.storage
    .from("incident-invoices")
    .createSignedUrl(attachment.file_path, 60);

  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ error: "SIGNED_URL_ERROR" }, { status: 500 });
  }

  return NextResponse.redirect(signed.data.signedUrl);
}
