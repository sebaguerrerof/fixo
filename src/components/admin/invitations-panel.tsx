"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { invitationAction, revokeInvitationAction } from "@/app/admin/usuarios/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { InvitationRecord } from "@/services/admin/user-administration-service";

export function InvitationsPanel({ invitations, superadmin, enabled }: { invitations: InvitationRecord[]; superadmin: boolean; enabled: boolean }) {
  const id = useId();
  const router = useRouter(); const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  // Keep a request ID through ambiguous network failures; only a deliberate new submission resets it.
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  return (
    <div className="space-y-8">
      {!enabled ? <div role="status"><Alert tone="warning">El envío de invitaciones no está habilitado en este entorno. La configuración debe revisarse antes de activarlo.</Alert></div> : null}
      <form className="space-y-4 rounded-lg border border-border bg-card p-5" onSubmit={async (event) => {
        event.preventDefault();
        if (!window.confirm("¿Confirmas invitar a esta persona por correo?")) return;
        const input = Object.fromEntries(new FormData(event.currentTarget)); setPending(true);
        try { const result = await invitationAction({ email: input.email, fullName: input.fullName, role: input.role, operationId, resend: false }); setMessage(result.message); if (result.ok) { setOperationId(crypto.randomUUID()); router.refresh(); } }
        catch { setMessage("Resultado no confirmado. Conserva los datos y revisa el listado antes de reintentar."); }
        finally { setPending(false); }
      }}>
        <h2 className="text-2xl">Invitar usuario</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor={`${id}-name`} label="Nombre completo"><Input id={`${id}-name`} maxLength={120} minLength={2} name="fullName" required /></Field>
          <Field htmlFor={`${id}-email`} label="Correo"><Input id={`${id}-email`} inputMode="email" maxLength={254} name="email" required type="email" /></Field>
          <Field htmlFor={`${id}-role`} label="Rol solicitado">
            <Select id={`${id}-role`} name="role">{(superadmin ? ["customer", "technician", "moderator", "superadmin"] : ["customer", "technician"]).map((role) => <option key={role}>{role}</option>)}</Select>
          </Field>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">El usuario definirá su contraseña desde un enlace de un solo uso. Un técnico invitado queda pendiente de revisión profesional.</p>
        <Button disabled={pending || !enabled} loading={pending} type="submit">Enviar invitación</Button>
      </form>
      {message ? <div aria-live="polite"><Alert tone="info">{message}</Alert></div> : null}
      <section>
        <h2 className="text-2xl">Invitaciones recientes</h2>
        <p className="mt-2 text-sm text-muted-foreground">Hasta 100 invitaciones visibles para tu rol. Los resultados inciertos requieren revisión antes de reenviar.</p>
        <div className="mt-4 space-y-3">
          {invitations.length ? invitations.map((inv) => (
            <article className="rounded-lg border border-border bg-card p-5" key={inv.id}>
              <div className="flex flex-wrap justify-between gap-3">
                <div><h3 className="text-xl">{inv.full_name}</h3><p className="break-all text-sm text-muted-foreground">{inv.email}</p></div>
                <p className="text-sm">{inv.role} · {inv.state} · envío: {inv.delivery}</p>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Expira: {inv.expires_at}</p>
              {["pending", "expired"].includes(inv.state) ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button disabled={pending || !enabled} onClick={async () => {
                    if (!window.confirm("¿Confirmas reenviar? Confirma el destinatario y el rol antes de emitir un nuevo enlace.")) return;
                    setPending(true);
                    try { const result = await invitationAction({ email: inv.email, fullName: inv.full_name, role: inv.role, operationId: crypto.randomUUID(), resend: true }); setMessage(result.message); router.refresh(); }
                    finally { setPending(false); }
                  }} type="button" variant="outline">Reenviar</Button>
                  <Button disabled={pending} onClick={async () => {
                    const reason = window.prompt("Motivo de revocación (mínimo 3 caracteres)");
                    if (!reason || reason.trim().length < 3) return;
                    setPending(true);
                    try { const result = await revokeInvitationAction(inv.id, reason); setMessage(result.message); router.refresh(); }
                    finally { setPending(false); }
                  }} type="button" variant="outline">Revocar</Button>
                </div>
              ) : null}
            </article>
          )) : <Alert tone="info">No hay invitaciones registradas visibles para tu rol.</Alert>}
        </div>
      </section>
    </div>
  );
}
