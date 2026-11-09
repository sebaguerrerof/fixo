// Trusted worker; run outside Vercel with maintained ClamAV signatures.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { inspectDocument } from "./lib/inspect-document.mjs";
const id = process.argv[2]; assert.match(id ?? "", /^[0-9a-f-]{36}$/);
const env = { ...process.env };
if (process.env.FIXO_INSPECTION_LOAD_LOCAL === "true") {
  for (const line of (await readFile(".env.local", "utf8")).split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$/);
    if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname, process.env.FIXO_INSPECTION_PROJECT + ".supabase.co");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const row = await admin.from("technician_documents").select("id,storage_path,current_document").eq("id", id).single();
assert.equal(row.error, null); assert.equal(row.data.current_document, true);
const file = await admin.storage.from("technician-documents").download(row.data.storage_path); assert.equal(file.error, null);
const bytes = Buffer.from(await file.data.arrayBuffer());
const result = await inspectDocument(bytes, file.data.type);
const recorded = await admin.rpc("record_professional_inspection", { document_id: id, content_sha256: result.sha256, content_mime: result.mime, content_size: result.size, scan_result: result.result, engine: result.engine });
assert.equal(recorded.error, null);
console.log(JSON.stringify({ document: id, result: result.result, engine: result.engine, bytes: result.size }));
if (result.result !== "clean") process.exitCode = 1;
