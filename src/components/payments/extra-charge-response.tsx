"use client";
import { useState } from "react";
import { respondExtraCharge } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { formatClp } from "@/lib/utils";
import { jobInputClass } from "@/components/jobs/job-command-form";

interface Props { readonly jobId: string; readonly extraChargeId: string; readonly policyVersion: number; readonly professionalAmountClp: number; readonly platformFeeClp: number; readonly totalClp: number }

/** Only the customer sees this. Acceptance is the financial consent for the displayed total; a rejection creates no debt. */
export function ExtraChargeResponse({ jobId, extraChargeId, policyVersion, professionalAmountClp, platformFeeClp, totalClp }: Props) {
  const [pending, setPending] = useState(false), [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null), [reason, setReason] = useState("");
  async function respond(decision: "accepted" | "rejected") {
    if (pending) return; setPending(true);
    try {
      const r = await respondExtraCharge({ jobId, extraChargeId, decision, expectedPolicyVersion: decision === "accepted" ? policyVersion : null, reason: decision === "rejected" ? reason : null });
      setMessage({ ok: r.ok, text: r.message }); if (r.ok) window.location.reload();
    } catch { setMessage({ ok: false, text: "No se confirmó la respuesta. Actualiza la página antes de reintentar." }); } finally { setPending(false); }
  }
  return <form className="space-y-3 rounded-lg border p-4" onSubmit={(e) => { e.preventDefault(); void respond("accepted"); }}>
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
      <dt>Importe del profesional (Q)</dt><dd className="text-right">{formatClp(professionalAmountClp)}</dd>
      <dt>Comisión Fixo (F)</dt><dd className="text-right">{formatClp(platformFeeClp)}</dd>
      <dt className="font-semibold">Total (T = Q + F)</dt><dd className="text-right font-semibold">{formatClp(totalClp)}</dd>
    </dl>
    <fieldset disabled={pending} className="min-w-0 space-y-3">
      <label className="flex items-start gap-2 text-sm"><input name="consent" type="checkbox" required className="mt-1" />Acepto este adicional y pagar {formatClp(totalClp)}, que incluye la comisión de Fixo.</label>
      <label className="grid gap-1 text-sm">Motivo del rechazo (opcional)<textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} className={jobInputClass} /></label>
      <div className="flex flex-wrap gap-3"><Button type="submit">{pending ? "Registrando…" : "Aceptar adicional"}</Button><Button type="button" variant="outline" onClick={() => void respond("rejected")}>Rechazar</Button></div>
    </fieldset>
    {message ? <p role={message.ok ? "status" : "alert"} className="break-words text-sm">{message.text}</p> : null}
  </form>;
}
