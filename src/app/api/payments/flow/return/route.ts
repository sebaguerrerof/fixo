import "server-only";
import { getAuthOrigin } from "@/config/auth-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Browser return from Flow (POST). It never reads the body, token or query and changes no state: the payment status shown
 * afterwards always comes from the database through the user's own session. 303 turns the POST into a GET on a stable internal page.
 */
export async function POST() {
  return new Response(null, { status: 303, headers: { Location: new URL("/cliente/trabajos", getAuthOrigin()).toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
