import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { prepareRequestPhoto } from "@/services/service-requests/prepare-request-photo";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabasePublicConfig } from "@/integrations/supabase/config";
import { getAuthOrigin } from "@/config/auth-origin";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { getServiceRequestRepository } from "@/repositories/repository-factory";
import { asRecords, asString } from "@/repositories/supabase/supabase-helpers";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" };
const uuid = z.string().uuid();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let uploaded: { remove: () => Promise<unknown> } | undefined;
  try {
    if (request.headers.get("origin") !== getAuthOrigin()) return Response.json({ ok: false }, { status: 403, headers });
    const { id } = await params; if (!uuid.safeParse(id).success) throw new Error();
    const user = await getServerAuthenticatedUser(); if (user?.role !== "customer") throw new Error();
    // Authorization is proved using the caller session/RPC, never service-role SELECT.
    const row = await getServiceRequestRepository().findById(id);
    if (row?.customerId !== user.id || !["submitted", "matching", "receiving_quotes"].includes(row.status)) throw new Error();
    const client = await getSupabaseServerClient(); const current = await client.rpc("marketplace_photos", { request_id: id });
    if (current.error || asRecords(current.data).length >= 5) throw new Error();
    const reader = request.body?.getReader(); if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let size = 0;
    try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 5 * 1024 * 1024) { await reader.cancel(); throw new Error(); } chunks.push(part.value); } } finally { reader.releaseLock(); }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
    const file = form.get("photo"); if (!(file instanceof File) || file.size < 8 || file.size > 4194304 || !["image/jpeg", "image/png"].includes(file.type)) throw new Error();
    const safe = await prepareRequestPhoto(Buffer.from(await file.arrayBuffer()));
    const photo = randomUUID(), path = `${user.id}/${id}/${photo}.jpg`, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error();
    // Narrow privileged operation: upload validated/re-encoded bytes only. No bypassed user-data reads.
    const uploader = createClient(getSupabasePublicConfig().url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const saved = await uploader.storage.from("service-request-photos").upload(path, safe, { contentType: "image/jpeg", upsert: false, cacheControl: "0" });
    if (saved.error) throw new Error(); uploaded = { remove: async () => uploader.storage.from("service-request-photos").remove([path]) };
    const registered = await client.rpc("marketplace_register_photo", { request_id: id, photo_id: photo, content_sha256: createHash("sha256").update(safe).digest("hex"), content_size: safe.length });
    if (registered.error) throw new Error(); uploaded = undefined;
    return Response.json({ ok: true }, { headers });
  } catch {
    if (uploaded) await uploaded.remove();
    return Response.json({ ok: false }, { status: 400, headers });
  }
}
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params, photo = new URL(request.url).searchParams.get("photo");
    if (!uuid.safeParse(id).success || !uuid.safeParse(photo).success) throw new Error();
    const client = await getSupabaseServerClient(); const list = await client.rpc("marketplace_photos", { request_id: id }); if (list.error) throw new Error();
    const row = asRecords(list.data).find(p => p.id === photo); if (!row) throw new Error();
    const download = await client.storage.from("service-request-photos").download(asString(row.storage_path), { cacheNonce: randomUUID() }, { cache: "no-store" }); if (download.error) throw new Error();
    return new Response(download.data, { headers: { ...headers, "Content-Type": "image/jpeg", "Content-Disposition": "inline; filename=solicitud.jpg" } });
  } catch { return new Response("Fotografía no disponible.", { status: 404, headers }); }
}
