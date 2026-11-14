"use client";
import { useId, useState } from "react";
import { respondExtraCharge } from "@/app/actions/payments";
import { PriceBreakdown } from "@/components/payments/price-breakdown";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxRow, Field, Textarea } from "@/components/ui/field";
import { formatClp } from "@/lib/utils";
import { brand } from "@/design-system/brand";

interface Props { readonly jobId: string; readonly extraChargeId: string; readonly policyVersion: number; readonly professionalAmountClp: number; readonly platformFeeClp: number; readonly totalClp: number }

/** Only the customer sees this. Acceptance is the financial consent for the displayed total; a rejection creates no debt. */
export function ExtraChargeResponse({ jobId, extraChargeId, policyVersion, professionalAmountClp, platformFeeClp, totalClp }: Props) {
  const id = useId();
  const [pending, setPending] = useState(false), [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null), [reason, setReason] = useState("");
  async function respond(decision: "accepted" | "rejected") {
    if (pending) return; setPending(true);
    try {
      const r = await respondExtraCharge({ jobId, extraChargeId, decision, expectedPolicyVersion: decision === "accepted" ? policyVersion : null, reason: decision === "rejected" ? reason : null });
      setMessage({ ok: r.ok, text: r.message }); if (r.ok) window.location.reload();
    } catch { setMessage({ ok: false, text: "No se confirmó la respuesta. Actualiza la página antes de reintentar." }); } finally { setPending(false); }
  }
  return (
    <form className="space-y-4 rounded-lg border border-border bg-card p-4" onSubmit={(e) => { e.preventDefault(); void respond("accepted"); }}>
      <PriceBreakdown rows={[
        { label: "Importe del profesional (Q)", value: formatClp(professionalAmountClp) },
        { label: `Comisión ${brand.name} (F)`, value: formatClp(platformFeeClp) },
        { label: "Total (T = Q + F)", value: formatClp(totalClp), strong: true },
      ]} />
      <fieldset className="min-w-0 space-y-3" disabled={pending}>
        <CheckboxRow className="items-start"><Checkbox name="consent" required />Acepto este adicional y pagar {formatClp(totalClp)}, que incluye la comisión de {brand.name}.</CheckboxRow>
        <Field htmlFor={`${id}-reason`} label="Motivo del rechazo (opcional)"><Textarea id={`${id}-reason`} maxLength={1000} onChange={(e) => setReason(e.target.value)} value={reason} /></Field>
        <div className="flex flex-wrap gap-3"><Button loading={pending} type="submit">Aceptar adicional</Button><Button onClick={() => void respond("rejected")} type="button" variant="outline">Rechazar</Button></div>
      </fieldset>
      {message ? <div aria-live="polite" className="break-words"><Alert tone={message.ok ? "success" : "danger"}>{message.text}</Alert></div> : null}
    </form>
  );
}
