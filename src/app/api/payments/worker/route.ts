import "server-only";
import { handleWorkerRun } from "@/services/payments/payment-worker-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** One bounded pass must finish well inside the scheduler's HTTP timeout (25 s in the Supabase Cron job). */
export const maxDuration = 30;

/** Internal, secret-protected trigger for one bounded payments worker pass (Bearer FIXO_PAYMENTS_WORKER_SECRET). */
export async function POST(request: Request) { return handleWorkerRun(request); }
