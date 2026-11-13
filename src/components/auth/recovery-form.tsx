"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function RecoveryForm() {
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  return <form className="space-y-5" onSubmit={async event => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setPending(true);
    try { await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recover", input: { email: form.get("email") } }) }); }
    catch { /* Keep the public response neutral, including network errors. */ }
    finally { setPending(false); setMessage("Si el correo corresponde a una cuenta habilitada, recibirás instrucciones para continuar. Revisa también tu carpeta de spam."); }
  }}><label className="block space-y-2"><span className="text-sm font-semibold">Correo electrónico</span><input name="email" type="email" required autoComplete="email" maxLength={254} className="h-12 w-full rounded-xl border bg-background px-3" /></label><Button className="w-full" disabled={pending}>{pending ? "Procesando…" : "Solicitar recuperación"}</Button>{message ? <p role="status" className="rounded-xl bg-muted p-4 text-sm leading-6">{message}</p> : null}</form>;
}
