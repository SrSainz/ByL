import { createClient } from "@supabase/supabase-js";

// The service-role client runs only on the server and performs admin-only
// operations that are guarded by server actions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminClient: ReturnType<typeof createClient<any>> | null = null;

export function getSupabaseAdmin() {
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Missing Supabase service role configuration.");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adminClient = createClient<any>(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return adminClient;
}
