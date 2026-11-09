import { AuthCard } from "@/components/auth/auth-card";
import { PendingSubmit } from "@/components/auth/pending-submit";
import { confirmAuthLink } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirmar acceso | Fixo", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function CallbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const token = typeof query.token_hash === "string" ? query.token_hash : "";
  const code = typeof query.code === "string" ? query.code : "";
  const type = typeof query.type === "string" ? query.type : "email";
  const valid = !query.error && (/^[A-Za-z0-9_-]{32,256}$/.test(token) || /^[A-Za-z0-9_-]{10,256}$/.test(code)) && ["email", "signup", "invite", "recovery"].includes(type);
  return <AuthCard title={valid ? "Confirma tu acceso" : "El enlace no está disponible"} description={valid ? "Continúa para validar el enlace de Fixo. El enlace se puede utilizar una sola vez." : "Puede haber expirado o ya haberse utilizado. Solicita un nuevo enlace desde el registro, recuperación o administración."}>{valid ? <form action={confirmAuthLink}><input type="hidden" name="token_hash" value={token} /><input type="hidden" name="code" value={code} /><input type="hidden" name="type" value={type} /><PendingSubmit label="Continuar de forma segura" /></form> : null}</AuthCard>;
}
