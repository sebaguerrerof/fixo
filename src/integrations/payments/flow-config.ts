import "server-only";

/** Sandbox is the only supported environment: fixed API and checkout hosts, no arbitrary URLs. */
export const FLOW_SANDBOX_API_BASE = "https://sandbox.flow.cl/api";
export const FLOW_SANDBOX_CHECKOUT_HOST = "sandbox.flow.cl";

export type FlowConfig =
  | { readonly mode: "disabled" }
  | { readonly mode: "sandbox"; readonly apiKey: string; readonly secretKey: string; readonly apiBase: typeof FLOW_SANDBOX_API_BASE; readonly callbackOrigin: string };

type Env = Readonly<Record<string, string | undefined>>;

/** Fails closed: anything other than an explicit, complete sandbox configuration is disabled or an error. */
export function loadFlowConfig(env: Env = process.env): FlowConfig {
  const mode = (env.FIXO_FLOW_MODE ?? "disabled").trim();
  if (mode === "disabled") return { mode: "disabled" };
  if (mode !== "sandbox") throw new Error("FIXO_FLOW_MODE sólo admite disabled o sandbox.");
  const apiKey = env.FLOW_API_KEY?.trim(), secretKey = env.FLOW_SECRET_KEY?.trim();
  if (!apiKey || !secretKey) throw new Error("Faltan credenciales Flow Sandbox.");
  let origin: URL;
  try { origin = new URL(env.FIXO_FLOW_CALLBACK_ORIGIN ?? ""); } catch { throw new Error("FIXO_FLOW_CALLBACK_ORIGIN debe ser un origen HTTPS válido."); }
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) throw new Error("FIXO_FLOW_CALLBACK_ORIGIN debe ser un origen HTTPS sin ruta.");
  return { mode: "sandbox", apiKey, secretKey, apiBase: FLOW_SANDBOX_API_BASE, callbackOrigin: origin.origin };
}
