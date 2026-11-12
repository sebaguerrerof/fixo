/**
 * Sandbox payments may only touch the explicitly authorized isolated Supabase project (PLAN sections 6 and 11).
 * The general NEXT_PUBLIC_SUPABASE_URL must match FIXO_PAYMENTS_SUPABASE_ORIGIN exactly; there is no fallback.
 */
export class PaymentsTargetError extends Error {
  constructor() { super("El destino de datos no está autorizado para pagos Sandbox."); this.name = "PaymentsTargetError"; }
}

type Env = Readonly<Record<string, string | undefined>>;
function originOf(value: string | undefined): string | null {
  try { const u = new URL(value ?? ""); return u.username || u.password || u.search || u.hash || u.pathname !== "/" ? null : u.origin; } catch { return null; }
}

export function assertAuthorizedPaymentsTarget(env: Env = process.env): void {
  const expected = originOf(env.FIXO_PAYMENTS_SUPABASE_ORIGIN), actual = originOf(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!expected || !actual || expected !== actual) throw new PaymentsTargetError();
}
