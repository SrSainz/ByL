"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

const watchedTables = [
  "incidents",
  "incident_zones",
  "incident_attachments",
  "invoice_extractions",
  "notifications",
  "locals",
  "zones",
  "responsables_aviso",
  "providers",
  "priorities",
  "statuses",
  "custom_list_groups",
  "custom_list_items",
  "excel_imports"
];

export function RealtimeRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 350);
    };
    const channel = supabase.channel("admin-live-sync");

    for (const table of watchedTables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }

    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [enabled, router]);

  return null;
}
