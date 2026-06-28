import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { buildInvoiceSuggestion, safeFileName } from "@/lib/invoices";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { InvoiceParsedData, LookupItem } from "@/lib/types";

export const runtime = "nodejs";

const MAX_AI_TEXT_CHARS = Number(process.env.INVOICE_AI_MAX_TEXT_CHARS || 6_000);
const OPENAI_MAX_OUTPUT_TOKENS = Number(process.env.OPENAI_INVOICE_MAX_OUTPUT_TOKENS || 700);

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

const invoiceSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    fecha_incidencia: { type: ["string", "null"] },
    local_name: { type: ["string", "null"] },
    zona_names: { type: "array", items: { type: "string" } },
    categoria_name: { type: ["string", "null"] },
    concept: { type: ["string", "null"] },
    descripcion: { type: ["string", "null"] },
    proveedor_name: { type: ["string", "null"] },
    prioridad_name: { type: ["string", "null"] },
    importe_factura: { type: ["number", "string", "null"] },
    fecha_resolucion: { type: ["string", "null"] },
    estado_name: { type: ["string", "null"] },
    invoice_number: { type: ["string", "null"] },
    invoice_date: { type: ["string", "null"] },
    invoice_base_amount: { type: ["number", "string", "null"] },
    vat_amount: { type: ["number", "string", "null"] },
    vat_rate: { type: ["number", "string", "null"] },
    total_amount: { type: ["number", "string", "null"] },
    confidence: { type: ["number", "null"] }
  },
  required: [
    "fecha_incidencia",
    "local_name",
    "zona_names",
    "categoria_name",
    "concept",
    "descripcion",
    "proveedor_name",
    "prioridad_name",
    "importe_factura",
    "fecha_resolucion",
    "estado_name",
    "invoice_number",
    "invoice_date",
    "invoice_base_amount",
    "vat_amount",
    "vat_rate",
    "total_amount",
    "confidence"
  ]
};

const systemPrompt = [
  "Extrae datos de facturas de mantenimiento.",
  "Devuelve solo JSON valido, sin markdown.",
  "descripcion debe contener el concepto real, numero de factura, fecha, base imponible, IVA y total si aparecen.",
  "concept debe ser el texto bajo el encabezado CONCEPTO, no el nombre del archivo.",
  "categoria_name debe ser una categoria corta de mantenimiento si se entiende: fontaneria, electricidad, maquinaria, climatizacion, limpieza, obra, gas, recambios u otra similar.",
  "importe_factura y total_amount deben ser el TOTAL FACTURA con IVA incluido.",
  "El importe de una factura rectificativa, abono o devolucion debe ser negativo.",
  "No confundas el cliente BRASA Y LEÑA con el proveedor.",
  "Si el nombre del archivo contiene un proveedor claro, priorizalo para proveedor_name."
].join(" ");

function parseModelJson(text?: string) {
  if (!text) return {};
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const match = clean.match(/\{[\s\S]*\}/);

  try {
    return JSON.parse(match?.[0] ?? clean) as InvoiceParsedData;
  } catch {
    return {};
  }
}

function guessProviderFromFileName(fileName: string) {
  const base = fileName
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  const tokens = base.split(/\s+/).filter(Boolean);
  const provider = tokens.find((token) => /[a-z]/i.test(token) && !/^\d+[.,]?$/.test(token));

  return provider?.replace(/[^\p{L}\p{N}.&]/gu, "") || null;
}

function refineParsedData(parsedData: InvoiceParsedData, fileName: string) {
  const guessedProvider = guessProviderFromFileName(fileName);
  const providerLooksLikeClient = parsedData.proveedor_name
    ? /brasa\s+y\s+leña/i.test(parsedData.proveedor_name)
    : false;

  if (guessedProvider && (!parsedData.proveedor_name || providerLooksLikeClient)) {
    return { ...parsedData, proveedor_name: guessedProvider };
  }

  return parsedData;
}

function parseOpenAIOutput(payload: {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
}) {
  return payload.output_text || payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((item) => item.text)
    .join("");
}

async function extractWithOpenAIPdf(buffer: Buffer, fileName: string): Promise<InvoiceParsedData> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
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
      max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Archivo: ${fileName}\nLee esta factura PDF y extrae los campos solicitados.`
            },
            {
              type: "input_file",
              filename: fileName,
              file_data: `data:application/pdf;base64,${buffer.toString("base64")}`
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "invoice_extraction",
          schema: invoiceSchema,
          strict: true
        }
      }
    })
  });

  if (!response.ok) {
    return {};
  }

  const payload = await response.json();
  const text = parseOpenAIOutput(payload);

  return parseModelJson(text);
}

async function extractWithOpenAI(rawText: string, fileName: string, buffer?: Buffer): Promise<InvoiceParsedData> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {};
  }

  if (rawText.trim().length < 40) {
    return buffer ? extractWithOpenAIPdf(buffer, fileName) : {};
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_INVOICE_MODEL || "gpt-4.1-mini",
      max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Archivo: ${fileName}\n\nTexto PDF:\n${rawText.slice(0, MAX_AI_TEXT_CHARS)}`
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "invoice_extraction",
          schema: invoiceSchema,
          strict: true
        }
      }
    })
  });

  if (!response.ok) {
    return {};
  }

  const payload = await response.json();
  const text = parseOpenAIOutput(payload);

  return parseModelJson(text);
}

async function extractWithLmStudio(rawText: string, fileName: string): Promise<InvoiceParsedData> {
  const baseUrl = process.env.LM_STUDIO_BASE_URL?.replace(/\/$/, "");
  const model = process.env.LM_STUDIO_INVOICE_MODEL || process.env.LM_STUDIO_MODEL || "gemma-3-4b-it";

  if (!baseUrl || rawText.trim().length < 40) {
    return {};
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: OPENAI_MAX_OUTPUT_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            `Archivo: ${fileName}`,
            "Devuelve exactamente estas claves JSON:",
            Object.keys(invoiceSchema.properties).join(", "),
            `Texto PDF:\n${rawText.slice(0, MAX_AI_TEXT_CHARS)}`
          ].join("\n\n")
        }
      ]
    })
  });

  if (!response.ok) {
    return {};
  }

  const payload = await response.json();
  return parseModelJson(payload.choices?.[0]?.message?.content);
}

async function extractInvoiceData(rawText: string, fileName: string, buffer: Buffer) {
  if (hasDeterministicInvoiceData(rawText)) {
    return {};
  }

  const provider = process.env.INVOICE_AI_PROVIDER || (process.env.LM_STUDIO_BASE_URL ? "lmstudio" : "openai");

  if (provider === "lmstudio") {
    const localResult = await extractWithLmStudio(rawText, fileName);
    if (Object.keys(localResult).length > 0 || rawText.trim().length >= 40) return localResult;
    return extractWithOpenAIPdf(buffer, fileName);
  }

  return extractWithOpenAI(rawText, fileName, buffer);
}

function hasDeterministicInvoiceData(rawText: string) {
  const hasInvoiceIdentity = /\bfactura\b/i.test(rawText) || /fecha\s+factura/i.test(rawText);
  const hasTotals =
    /total\s+factura/i.test(rawText) ||
    /total\s+a\s+pagar/i.test(rawText) ||
    /imp\.?\s*total/i.test(rawText) ||
    /base\s+imponible/i.test(rawText) ||
    /\bbase\b[\s\S]{0,120}\biva\b/i.test(rawText);
  const hasLines = /c\s*o\s*n\s*c\s*e\s*p\s*t\s*o/i.test(rawText) || /albar[aá]n/i.test(rawText) || /\b(unid|neto|roll|par)\b/i.test(rawText);
  return hasInvoiceIdentity && hasTotals && hasLines;
}

async function getLookups() {
  const admin = getSupabaseAdmin();
  const [locals, zones, responsables, providers, priorities, statuses] = await Promise.all([
    admin.from("locals").select("*"),
    admin.from("zones").select("*"),
    admin.from("responsables_aviso").select("*"),
    admin.from("providers").select("*"),
    admin.from("priorities").select("*"),
    admin.from("statuses").select("*")
  ]);

  return {
    locals: (locals.data ?? []) as LookupItem[],
    zones: (zones.data ?? []) as LookupItem[],
    responsables: (responsables.data ?? []) as LookupItem[],
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
  const aiData = refineParsedData(await extractInvoiceData(rawText, file.name, buffer), file.name);
  const lookups = await getLookups();
  const suggestions = buildInvoiceSuggestion({
    fileName: file.name,
    rawText,
    parsedData: aiData,
    lookups
  });
  const storedParsedData: InvoiceParsedData = {
    ...aiData,
    fecha_incidencia: suggestions.fecha_incidencia ?? aiData.fecha_incidencia ?? null,
    descripcion: suggestions.descripcion ?? aiData.descripcion ?? null,
    importe_factura: suggestions.importe_factura ?? aiData.importe_factura ?? null,
    total_amount: suggestions.importe_factura ?? aiData.total_amount ?? null
  };

  const extraction = await admin
    .from("invoice_extractions")
    .insert({
      attachment_id: attachment.data.id,
      status: "completed",
      raw_text: rawText,
      parsed_data: storedParsedData,
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
