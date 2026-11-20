"use client";
import { useId, useRef, useState } from "react";

import { changePasswordAction } from "@/app/perfil/password-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

const RULE = "Al menos 12 caracteres, mayúscula, minúscula y número";

export function ChangePasswordForm() {
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const inFlight = useRef(false);
  return (
    <form className="space-y-5" onSubmit={async (event) => {
      event.preventDefault();
      if (inFlight.current) return;
      inFlight.current = true; setPending(true); setResult(null);
      const form = event.currentTarget;
      const data = new FormData(form);
      try {
        const outcome = await changePasswordAction({ currentPassword: data.get("currentPassword"), password: data.get("password"), confirmPassword: data.get("confirmPassword") });
        setResult(outcome);
        if (outcome.ok) form.reset();
      } catch {
        setResult({ ok: false, message: "No pudimos cambiar la contraseña. Inténtalo nuevamente." });
      } finally { inFlight.current = false; setPending(false); }
    }}>
      <Field htmlFor={f("currentPassword")} label="Contraseña actual"><Input autoComplete="current-password" id={f("currentPassword")} maxLength={128} name="currentPassword" required type="password" /></Field>
      <Field htmlFor={f("password")} label="Contraseña nueva"><Input autoComplete="new-password" id={f("password")} maxLength={128} minLength={12} name="password" pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,128}" required title={RULE} type="password" /></Field>
      <Field htmlFor={f("confirmPassword")} label="Repite la contraseña nueva"><Input autoComplete="new-password" id={f("confirmPassword")} maxLength={128} minLength={12} name="confirmPassword" required title={RULE} type="password" /></Field>
      {result ? <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert> : null}
      <Button loading={pending} type="submit">Cambiar contraseña</Button>
    </form>
  );
}
