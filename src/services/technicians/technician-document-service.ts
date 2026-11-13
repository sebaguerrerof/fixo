import { z } from "zod";
import { isDemoModeEnabled } from "@/config/demo-mode";
import { hasPermission } from "@/domain/auth/permissions";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";

export const DOCUMENT_BUCKET = "technician-documents";
export const DOCUMENT_URL_TTL_SECONDS = 60;

/** Server-only by transitive next/headers import. Uses the caller JWT, never service role. */
export async function getTechnicianDocumentUrl(documentId: string): Promise<string> {
  if (isDemoModeEnabled()) throw new Error("Documento no disponible.");
  if (!z.uuid().safeParse(documentId).success) throw new Error("Documento no disponible.");
  const user = await getServerAuthenticatedUser();
  if (!user || (!hasPermission(user.role, "document:read_own") && !hasPermission(user.role, "document:read_all"))) {
    throw new Error("Documento no disponible.");
  }
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.from("technician_documents")
    .select("technician_id, storage_path, inspection_status, current_document").eq("id", documentId).maybeSingle();
  if (error || !data || typeof data.technician_id !== "string" || typeof data.storage_path !== "string") throw new Error("Documento no disponible.");
  if (data.technician_id !== user.id && !hasPermission(user.role, "document:read_all")) throw new Error("Documento no disponible.");
  if (data.inspection_status !== "clean" || !data.current_document) throw new Error("Documento no disponible.");
  const parts = data.storage_path.split("/");
  if (parts.length !== 2 || parts[0] !== data.technician_id
    || !/^[a-zA-Z0-9_-]+\.(?:pdf|jpe?g|png)$/.test(parts[1])) throw new Error("Documento no disponible.");
  // Do not expose a bearer URL whose warmed CDN cache can outlive its token.
  return `/api/technician-documents/${documentId}`;
}
