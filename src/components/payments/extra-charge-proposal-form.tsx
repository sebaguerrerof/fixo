"use client";
import { useRef, useState } from "react";
import { proposeExtraCharge } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { jobInputClass } from "@/components/jobs/job-command-form";

/** Technician-only. The operation id is kept for identical retries (the DB replays idempotently) and renewed when the content changes. */
export function ExtraChargeProposalForm({ jobId }: { readonly jobId: string }) {
  const [pending, setPending] = useState(false), [result, setResult] = useState<{ ok: boolean; text: string } | null>(null), attempt = useRef<{ key: string; operationId: string } | null>(null);
  return <form className="space-y-3 rounded-lg border p-4" onSubmit={async (event) => {
    event.preventDefault(); if (pending) return;
    const form = event.currentTarget, data = new FormData(form), concept = String(data.get("concept") ?? ""), amountClp = Number(data.get("amount")), key = JSON.stringify({ concept: concept.trim(), amountClp });
    if (!attempt.current || attempt.current.key !== key) attempt.current = { key, operationId: crypto.randomUUID() };
    setPending(true);
    try { const r = await proposeExtraCharge({ jobId, operationId: attempt.current.operationId, concept, amountClp }); setResult({ ok: r.ok, text: r.message }); if (r.ok) { attempt.current = null; form.reset(); window.location.reload(); } }
    catch { setResult({ ok: false, text: "No se confirmó la respuesta. Puedes reintentar con los mismos datos; se conserva el identificador de la operación." }); } finally { setPending(false); }
  }}>
    <h3 className="font-semibold">Proponer un adicional</h3>
    <p className="text-sm text-muted-foreground">Indica el importe que recibirías (Q). El cliente verá el desglose con la comisión de Fixo y deberá aceptarlo; hasta entonces no es una deuda.</p>
    <fieldset disabled={pending} className="min-w-0 space-y-3">
      <label className="grid gap-1 text-sm">Concepto<textarea name="concept" required minLength={10} maxLength={500} className={jobInputClass} /></label>
      <label className="grid gap-1 text-sm">Importe en pesos (entero)<input name="amount" type="number" required min={1000} max={50000000} step={1} inputMode="numeric" className={jobInputClass} /></label>
      <Button type="submit">{pending ? "Registrando…" : "Proponer adicional"}</Button>
    </fieldset>
    {result ? <p role={result.ok ? "status" : "alert"} className="break-words text-sm">{result.text}</p> : null}
  </form>;
}
