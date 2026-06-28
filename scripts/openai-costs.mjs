import fs from "node:fs";

function loadEnv() {
  if (!fs.existsSync(".env.local")) return;

  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

loadEnv();

const apiKey = process.env.OPENAI_API_KEY;
const days = Number(process.argv.find((arg) => arg.startsWith("--days="))?.split("=")[1] || 1);
const startTime = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

if (!apiKey) {
  console.error("Missing OPENAI_API_KEY.");
  process.exit(1);
}

const url = new URL("https://api.openai.com/v1/organization/costs");
url.searchParams.set("start_time", String(startTime));
url.searchParams.set("bucket_width", "1d");
url.searchParams.set("limit", String(Math.max(days, 1)));

const response = await fetch(url, {
  headers: { authorization: `Bearer ${apiKey}` }
});

const payload = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(JSON.stringify({
    ok: false,
    status: response.status,
    message: payload.error?.message || "OpenAI costs endpoint failed. The key may need organization billing permissions."
  }, null, 2));
  process.exit(2);
}

console.log(JSON.stringify(payload, null, 2));
