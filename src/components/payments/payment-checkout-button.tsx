"use client";
import { useRef, useState } from "react";
import { startPayment } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { formatClp } from "@/lib/utils";

interface Props { readonly jobId: string; readonly extraChargeId: string | null; readonly policyVersion: number; readonly professionalAmountClp: number; readonly platformFeeClp: number; readonly totalClp: number }

/** The displayed Q/F/T is informational: the server recomputes everything and only receives identifiers, policy version, consent and a key. */
export function PaymentCheckoutButton({ jobId, extraChargeId, policyVersion, professionalAmountClp, platformFeeClp, totalClp }: Props) {
  const [pending, setPending] = useState(false), [message, setMessage] = useState<string | null>(null), key = useRef(crypto.randomUUID());
  return <form className="space-y-3 rounded-lg border p-4" onSubmit={async (event) => {
    event.preventDefault(); if (pending) return; setPending(true); setMessage(null);
    try {
      const result = await startPayment({ jobId, extraChargeId, expectedPolicyVersion: policyVersion, consent: true, idempotencyKey: key.current });
      if (result.ok) {
        // Defense in depth: the DB already refuses a stale policy version, but never open a checkout whose total differs from the consented one.
        if (result.totalClp !== totalClp) { setMessage("El total cambió. Actualiza la página, revisa el nuevo desglose y confirma nuevamente."); return; }
        // Open the provider checkout without a Referer and without the URL ever entering Fixo's history/query strings.
        const a = document.createElement("a"); a.href = result.checkoutUrl; a.rel = "noreferrer noopener"; document.body.appendChild(a); a.click(); a.remove(); return;
      }
      // A definitively ended attempt must not be replayed with the same key; ambiguous/pending outcomes keep it so nothing is duplicated.
      if (result.renewKey) key.current = crypto.randomUUID();
      setMessage(result.message);
    } catch { setMessage("No se confirmó la respuesta. Actualiza la página para ver el estado antes de reintentar."); } finally { setPending(false); }
  }}>
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
      <dt>Importe del profesional (Q)</dt><dd className="text-right">{formatClp(professionalAmountClp)}</dd>
      <dt>Comisión Fixo (F)</dt><dd className="text-right">{formatClp(platformFeeClp)}</dd>
      <dt className="font-semibold">Total a pagar (T = Q + F)</dt><dd className="text-right font-semibold">{formatClp(totalClp)}</dd>
    </dl>
    <p className="text-xs text-muted-foreground">Pago de prueba (Flow Sandbox): no se realiza ningún cobro real. El profesional tiene asignado el importe Q; Fixo cubre los costes del medio de pago dentro de su comisión.</p>
    <fieldset disabled={pending} className="min-w-0 space-y-3">
      <label className="flex items-start gap-2 text-sm"><input name="consent" type="checkbox" required className="mt-1" />Acepto pagar el total de {formatClp(totalClp)}, que incluye la comisión de Fixo.</label>
      <Button type="submit" disabled={pending}>{pending ? "Preparando pago…" : `Pagar ${formatClp(totalClp)}`}</Button>
    </fieldset>
    {message ? <p role="alert" className="break-words text-sm">{message} <button type="button" className="underline" onClick={() => window.location.reload()}>Actualizar</button></p> : null}
  </form>;
}
