"use client";
import { useRef, useState } from "react";
import { startPayment } from "@/app/actions/payments";
import { PriceBreakdown } from "@/components/payments/price-breakdown";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxRow } from "@/components/ui/field";
import { formatClp } from "@/lib/utils";
import { brand } from "@/design-system/brand";

interface Props { readonly jobId: string; readonly extraChargeId: string | null; readonly policyVersion: number; readonly professionalAmountClp: number; readonly platformFeeClp: number; readonly totalClp: number }

/** The displayed Q/F/T is informational: the server recomputes everything and only receives identifiers, policy version, consent and a key. */
export function PaymentCheckoutButton({ jobId, extraChargeId, policyVersion, professionalAmountClp, platformFeeClp, totalClp }: Props) {
  const [pending, setPending] = useState(false), [message, setMessage] = useState<string | null>(null), key = useRef(crypto.randomUUID());
  return <form className="space-y-4 rounded-lg border border-border bg-card p-4" onSubmit={async (event) => {
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
    <PriceBreakdown rows={[
      { label: "Importe del profesional (Q)", value: formatClp(professionalAmountClp) },
      { label: `Comisión ${brand.name} (F)`, value: formatClp(platformFeeClp) },
      { label: "Total a pagar (T = Q + F)", value: formatClp(totalClp), strong: true },
    ]} />
    <p className="text-xs leading-5 text-muted-foreground">Pago de prueba (Flow Sandbox): no se realiza ningún cobro real. El profesional tiene asignado el importe Q; {brand.name} cubre los costes del medio de pago dentro de su comisión.</p>
    <fieldset className="min-w-0 space-y-3" disabled={pending}>
      <CheckboxRow className="items-start"><Checkbox name="consent" required />Acepto pagar el total de {formatClp(totalClp)}, que incluye la comisión de {brand.name}.</CheckboxRow>
      <Button loading={pending} type="submit">{`Pagar ${formatClp(totalClp)}`}</Button>
    </fieldset>
    {message ? <div className="break-words" role="alert"><Alert tone="danger">{message} <Button onClick={() => window.location.reload()} type="button" variant="link">Actualizar</Button></Alert></div> : null}
  </form>;
}
