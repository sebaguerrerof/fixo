"use client";
import { useId, useRef, useState } from "react";
import { proposeExtraCharge } from "@/app/actions/payments";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { brand } from "@/design-system/brand";

/** Technician-only. The operation id is kept for identical retries (the DB replays idempotently) and renewed when the content changes. */
export function ExtraChargeProposalForm({ jobId }: { readonly jobId: string }) {
  const id = useId();
  const [pending, setPending] = useState(false), [result, setResult] = useState<{ ok: boolean; text: string } | null>(null), attempt = useRef<{ key: string; operationId: string } | null>(null);
  return <form className="space-y-4 rounded-lg border border-border bg-card p-4" onSubmit={async (event) => {
    event.preventDefault(); if (pending) return;
    const form = event.currentTarget, data = new FormData(form), concept = String(data.get("concept") ?? ""), amountClp = Number(data.get("amount")), key = JSON.stringify({ concept: concept.trim(), amountClp });
    if (!attempt.current || attempt.current.key !== key) attempt.current = { key, operationId: crypto.randomUUID() };
    setPending(true);
    try { const r = await proposeExtraCharge({ jobId, operationId: attempt.current.operationId, concept, amountClp }); setResult({ ok: r.ok, text: r.message }); if (r.ok) { attempt.current = null; form.reset(); window.location.reload(); } }
    catch { setResult({ ok: false, text: "No se confirmó la respuesta. Puedes reintentar con los mismos datos; se conserva el identificador de la operación." }); } finally { setPending(false); }
  }}>
    <h3 className="text-xl">Proponer un adicional</h3>
    <p className="text-sm leading-6 text-muted-foreground">Indica el importe que recibirías (Q). El cliente verá el desglose con la comisión de {brand.name} y deberá aceptarlo; hasta entonces no es una deuda.</p>
    <fieldset className="min-w-0 space-y-3" disabled={pending}>
      <Field htmlFor={`${id}-concept`} label="Concepto"><Textarea id={`${id}-concept`} maxLength={500} minLength={10} name="concept" required /></Field>
      <Field htmlFor={`${id}-amount`} label="Importe en pesos (entero)"><Input id={`${id}-amount`} inputMode="numeric" max={50000000} min={1000} name="amount" required step={1} type="number" /></Field>
      <Button loading={pending} type="submit">Proponer adicional</Button>
    </fieldset>
    {result ? <div aria-live="polite" className="break-words"><Alert tone={result.ok ? "success" : "danger"}>{result.text}</Alert></div> : null}
  </form>;
}
