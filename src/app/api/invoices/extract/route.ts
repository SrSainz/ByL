import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { buildInvoiceSuggestion, safeFileName } from "@/lib/invoices";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { InvoiceParsedData, LookupItem } from "@/lib/types";

export const runtime = "nodejs";

async function extractPdfText(buffer: Buffer) {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    return String(parsed.text || "").slice(0, 40_000);
  } catch {
    return "";
  }
}

async function extractWithOpenAI(rawText: string, fileName: string): Promise<InvoiceParsedData> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || rawText.trim().length < 40) {
    return {};
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_INVOICE_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: "Extrae datos de facturas de mantenimiento. Devuelve solo JSON valido."
        },
        {
          role: "user",
          content: `Archivo: ${fileName}\n\nTexto PDF:\n${rawText.slice(0, 18_000)}`
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "invoice_extraction",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              fecha_incidencia: { type: ["string", "null"] },
              local_name: { type: ["string", "null"] },
              zona_names: { type: "array", items: { type: "string" } },
              descripcion: { type: ["string", "null"] },
              proveedor_name: { type: ["string", "null"] },
              prioridad_name: { type: ["string", "null"] },
              estado_name: { type: ["string", "null"] },
              invoice_number: { type: ["string", "null"] },
              invoice_date: { type: ["string", "null"] },
              total_amount: { type: ["string", "null"] },
              confidence: { type: ["number", "null"] }
            },
            required: [
              "fecha_incidencia",
              "local_name",
              "zona_names",
              "descripcion",
              "proveedor_name",
              "prioridad_name",
              "estado_name",
              "invoice_number",
              "invoice_date",
              "total_amount",
              "confidence"
            ]
          },
          strict: true
        }
      }
    })
  });

  if (!response.ok) {
    return {};
  }

  const payload = await response.json();
  const text = payload.output_text || payload.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? []).map((item: { text?: string }) => item.text).join("");

  try {
    return JSON.parse(text || "{}") as InvoiceParsedData;
  } catch {
    return {};
  }
}

async function getLookups() {
  const admin = getSupabaseAdmin();
  const [locals, zones, providers, priorities, statuses] = await Promise.all([
    admin.from("locals").select("*"),
    admin.from("zones").select("*"),
    admin.from("providers").select("*"),
    admin.from("priorities").select("*"),
    admin.from("statuses").select("*")
  ]);

  return {
    locals: (locals.data ?? []) as LookupItem[],
    zones: (zones.data ?? []) as LookupItem[],
    providers: (providers.data ?? []) as LookupItem[],
    priorities: (priorities.data ?? []) as LookupItem[],
    statuses: (statuses.data ?? []) as LookupItem[]
  };
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();

  if (!profile?.active) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("invoice");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "INVALID_FILE", message: "Adjunta un PDF." }, { status: 400 });
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "UNSUPPORTED_FILE", message: "Solo se admiten facturas PDF." }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "FILE_TOO_LARGE", message: "El PDF supera 10 MB." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const admin = getSupabaseAdmin();
  const fileName = safeFileName(file.name);
  const filePath = `${profile.id}/${crypto.randomUUID()}-${fileName}`;

  const upload = await admin.storage
    .from("incident-invoices")
    .upload(filePath, buffer, {
      contentType: "application/pdf",
      upsert: false
    });

  if (upload.error) {
    return NextResponse.json({ error: "UPLOAD_ERROR", message: upload.error.message }, { status: 500 });
  }

  const attachment = await admin
    .from("incident_attachments")
    .insert({
      uploaded_by: profile.id,
      file_path: filePath,
      file_name: file.name,
      mime_type: "application/pdf",
      size_bytes: file.size,
      status: "pending"
    })
    .select("*")
    .single();

  if (attachment.error) {
    return NextResponse.json({ error: "ATTACHMENT_ERROR", message: attachment.error.message }, { status: 500 });
  }

  const rawText = await extractPdfText(buffer);
  const aiData = await extractWithOpenAI(rawText, file.name);
  const lookups = await getLookups();
  const suggestions = buildInvoiceSuggestion({
    fileName: file.name,
    rawText,
    parsedData: aiData,
    lookups
  });

  const extraction = await admin
    .from("invoice_extractions")
    .insert({
      attachment_id: attachment.data.id,
      status: "completed",
      raw_text: rawText,
      parsed_data: aiData,
      confidence: aiData.confidence ?? null
    })
    .select("*")
    .single();

  return NextResponse.json({
    attachment: attachment.data,
    extraction: extraction.data,
    suggestions
  });
}
