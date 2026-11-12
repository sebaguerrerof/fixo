import "server-only";
import { handleConfirmation } from "@/services/payments/flow-callback-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public Flow confirmation trigger. All logic (budget, limits, persistence) lives in the handler so it can be tested with a short deadline. */
export async function POST(request: Request) { return handleConfirmation(request); }
