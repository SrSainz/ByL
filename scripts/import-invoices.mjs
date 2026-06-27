import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";

const DEFAULT_FOLDER = "C:\\Users\\alvar\\Desktop\\AIDA\\Estudio LUART\\ByL\\MANTENIMIENTO";
const args = new Set(process.argv.slice(2));
const upload = args.has("--upload");
const folderArg = process.argv.find((arg) => arg.startsWith("--folder="));
const folder = folderArg ? folderArg.slice("--folder=".length) : DEFAULT_FOLDER;

async function loadEnvFile(file) {
  try {
    const text = await fs.readFile(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^"|"$/g, "");
      }
    }
  } catch {
    // Optional.
  }
}

async function listPdfFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return listPdfFiles(fullPath);
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) return [fullPath];
    return [];
  }));
  return files.flat();
}

function safeName(name) {
  return name.replace(/[^\w.\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 160) || "factura.pdf";
}

await loadEnvFile(path.join(process.cwd(), ".env.local"));

const files = await listPdfFiles(folder);
console.log(`Encontrados ${files.length} PDF en ${folder}`);

if (!upload) {
  for (const file of files.slice(0, 20)) console.log(`- ${file}`);
  if (files.length > 20) console.log(`...${files.length - 20} mas`);
  console.log("Dry-run completado. Usa --upload para subirlos a Supabase como facturas pendientes.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.env.INVOICE_IMPORT_USER_ID;

if (!url || !key || !userId) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o INVOICE_IMPORT_USER_ID.");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

let imported = 0;
for (const file of files) {
  const buffer = await fs.readFile(file);
  const fileName = path.basename(file);
  const filePath = `${userId}/import-${randomUUID()}-${safeName(fileName)}`;
  const { error: uploadError } = await supabase.storage
    .from("incident-invoices")
    .upload(filePath, buffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    console.error(`No se pudo subir ${fileName}: ${uploadError.message}`);
    continue;
  }

  const attachment = await supabase
    .from("incident_attachments")
    .insert({
      uploaded_by: userId,
      file_path: filePath,
      file_name: fileName,
      mime_type: "application/pdf",
      size_bytes: buffer.length,
      status: "pending"
    })
    .select("id")
    .single();

  if (attachment.error) {
    console.error(`No se pudo registrar ${fileName}: ${attachment.error.message}`);
    continue;
  }

  let rawText = "";
  try {
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    rawText = String(parsed.text || "").slice(0, 40_000);
  } catch {
    rawText = "";
  }

  await supabase.from("invoice_extractions").insert({
    attachment_id: attachment.data.id,
    status: "completed",
    raw_text: rawText,
    parsed_data: {
      descripcion: fileName.replace(/\.pdf$/i, "").replaceAll("_", " "),
      confidence: rawText ? 40 : 0
    },
    confidence: rawText ? 40 : 0
  });

  imported += 1;
  console.log(`Importada ${imported}/${files.length}: ${fileName}`);
}

console.log(`Importacion finalizada: ${imported} facturas pendientes.`);
