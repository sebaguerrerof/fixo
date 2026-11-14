"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { changeAccountAction, observeUserAction } from "@/app/admin/usuarios/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import type { UserRole } from "@/domain/enums/roles";

export function AccountControls({ id, role, isSelf, superadmin }: { id: string; role: UserRole; isSelf: boolean; superadmin: boolean }) {
  const uid = useId();
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false); const router = useRouter();
  const editable = !isSelf && (superadmin || !["moderator", "superadmin"].includes(role));
  return (
    <section className="mt-8 space-y-5 rounded-lg border border-border bg-card p-5">
      <h2 className="text-2xl">Acciones administrativas</h2>
      {editable ? (
        <form className="space-y-4" onSubmit={async (event) => {
          event.preventDefault(); const form = new FormData(event.currentTarget);
          const status = String(form.get("status") ?? ""); const nextRole = String(form.get("role") ?? "");
          if (!status && !nextRole) { setMessage("Selecciona un cambio."); return; }
          if (!window.confirm("¿Confirmas cambiar el acceso de esta cuenta? Se registrará el motivo y tu identidad.")) return;
          setPending(true);
          try { const result = await changeAccountAction({ targetUser: id, newStatus: status || null, newRole: nextRole || null, reason: form.get("reason"), operationId: crypto.randomUUID() }); setMessage(result.message); if (result.ok) router.refresh(); }
          finally { setPending(false); }
        }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field htmlFor={`${uid}-status`} label="Estado de cuenta">
              <Select id={`${uid}-status`} name="status"><option value="">Conservar estado</option><option value="active">Activar</option><option value="suspended">Suspender</option><option value="blocked">Bloquear</option></Select>
            </Field>
            {superadmin ? (
              <Field htmlFor={`${uid}-role`} label="Rol">
                <Select id={`${uid}-role`} name="role"><option value="">Conservar rol</option>{["customer", "technician", "moderator", "superadmin"].map((item) => <option key={item} value={item}>{item}</option>)}</Select>
              </Field>
            ) : null}
          </div>
          <Field htmlFor={`${uid}-reason`} label="Motivo obligatorio"><Textarea id={`${uid}-reason`} maxLength={500} minLength={3} name="reason" required /></Field>
          <Button disabled={pending} loading={pending} type="submit">Confirmar cambio</Button>
        </form>
      ) : <p className="text-sm text-muted-foreground">Tu rol o la protección de la cuenta impiden modificar su acceso desde esta sesión.</p>}
      {(superadmin || !["moderator", "superadmin"].includes(role)) ? (
        <form className="space-y-3 border-t border-border pt-5" onSubmit={async (event) => {
          event.preventDefault(); const reason = String(new FormData(event.currentTarget).get("observation") ?? ""); setPending(true);
          try { const result = await observeUserAction(id, reason); setMessage(result.message); if (result.ok) router.refresh(); }
          finally { setPending(false); }
        }}>
          <Field htmlFor={`${uid}-observation`} label="Observación interna"><Textarea id={`${uid}-observation`} maxLength={500} minLength={3} name="observation" required /></Field>
          <Button disabled={pending} type="submit" variant="outline">Registrar observación</Button>
        </form>
      ) : null}
      {message ? <div aria-live="polite"><Alert tone="info">{message}</Alert></div> : null}
    </section>
  );
}
