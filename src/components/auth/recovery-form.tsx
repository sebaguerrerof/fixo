"use client";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function RecoveryForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form className="space-y-5" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      setPending(true);
      try { await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recover", input: { email: form.get("email") } }) }); }
      catch { /* Keep the public response neutral, including network errors. */ }
      finally { setPending(false); setMessage("Si el correo corresponde a una cuenta habilitada, recibirás instrucciones para continuar. Revisa también tu carpeta de spam."); }
    }}>
      <Field htmlFor="email" label="Correo electrónico">
        <Input autoComplete="email" id="email" inputMode="email" maxLength={254} name="email" required type="email" />
      </Field>
      <Button className="w-full" loading={pending} size="lg" type="submit">Solicitar recuperación</Button>
      {message ? <Alert tone="info">{message}</Alert> : null}
    </form>
  );
}
