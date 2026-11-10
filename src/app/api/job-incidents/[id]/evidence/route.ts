import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getAuthOrigin } from "@/config/auth-origin";
import { getSupabasePublicConfig } from "@/integrations/supabase/config";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { prepareRequestPhoto } from "@/services/service-requests/prepare-request-photo";
import { JobOperationsService } from "@/services/jobs/job-operations-service";
import { asRecords, asString } from "@/repositories/supabase/supabase-helpers";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const uuid = z.string().uuid(), bucket = "job-incident-evidence";
const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" };
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let uploaded: { remove: () => Promise<unknown> } | undefined;
  try {
    if (request.headers.get("origin") !== getAuthOrigin()) return Response.json({ ok: false }, { status: 403, headers });
    const { id } = await params, jobId = new URL(request.url).searchParams.get("job");
    if (!uuid.safeParse(id).success || !uuid.safeParse(jobId).success) throw new Error();
    const user = await getServerAuthenticatedUser(); if (!user) throw new Error();
    const detail = await new JobOperationsService().detail(jobId!);
    const incident = detail?.incidents.find(i => i.id === id);
    if (!detail?.canOperate || !incident || incident.state === "resolved" || ![detail.job.customerId, detail.job.technicianId].includes(user.id) || incident.attachments.filter(a => a.actorId === user.id).length >= 5) throw new Error();
    const reader = request.body?.getReader(); if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let size = 0;
    try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 5 * 1024 * 1024) { await reader.cancel(); throw new Error(); } chunks.push(part.value); } } finally { reader.releaseLock(); }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
    const file = form.get("photo"); if (!(file instanceof File) || file.size < 8 || file.size > 4194304 || !["image/jpeg", "image/png"].includes(file.type)) throw new Error();
    const safe = await prepareRequestPhoto(Buffer.from(await file.arrayBuffer())), attachment = randomUUID(), path = `${user.id}/${id}/${attachment}.jpg`, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error();
    // The caller RPC authorized metadata above. Privilege is limited to validated bytes at this unique path.
    const uploader = createClient(getSupabasePublicConfig().url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const saved = await uploader.storage.from(bucket).upload(path, safe, { contentType: "image/jpeg", upsert: false, cacheControl: "0" });
    if (saved.error) throw new Error(); uploaded = { remove: async () => uploader.storage.from(bucket).remove([path]) };
    const client = await getSupabaseServerClient(), registered = await client.rpc("job_register_evidence", { incident_id: id, attachment_id: attachment, content_sha256: createHash("sha256").update(safe).digest("hex"), content_size: safe.length });
    if (registered.error) throw new Error(); uploaded = undefined;
    return Response.json({ ok: true }, { headers });
  } catch { if (uploaded) await uploaded.remove().catch(() => {}); return Response.json({ ok: false }, { status: 400, headers }); }
}
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params, photo = new URL(request.url).searchParams.get("photo");
    if (!uuid.safeParse(id).success || !uuid.safeParse(photo).success) throw new Error();
    const client = await getSupabaseServerClient(), list = await client.rpc("job_evidence", { incident_id: id }); if (list.error) throw new Error();
    const item = asRecords(list.data).find(a => a.id === photo); if (!item) throw new Error();
    const download = await client.storage.from(bucket).download(asString(item.storage_path), { cacheNonce: randomUUID() }, { cache: "no-store" }); if (download.error) throw new Error();
    return new Response(download.data, { headers: { ...headers, "Content-Type": "image/jpeg", "Content-Disposition": "inline; filename=evidencia.jpg" } });
  } catch { return new Response("Evidencia no disponible.", { status: 404, headers }); }
}
