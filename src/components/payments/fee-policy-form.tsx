"use client";
import { useId, useState } from "react";
import { updateFeePolicy } from "@/app/actions/payments";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxRow, Field, Input, Textarea } from "@/components/ui/field";
import { formatClp } from "@/lib/utils";
import { formatBasisPoints, percentToBasisPoints, previewTerms } from "@/domain/payments/presentation";

/** Superadmin only (the DB enforces it again). The expected version makes a stale tab fail instead of overwriting another change. */
export function FeePolicyForm({ version, basisPoints }: { readonly version: number; readonly basisPoints: number }) {
  const id = useId();
  const [percent, setPercent] = useState(formatBasisPoints(basisPoints).replace(" %", "")), [reason, setReason] = useState(""), [pending, setPending] = useState(false), [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const bp = percentToBasisPoints(percent), preview = bp === null ? null : previewTerms(100000, { version, feeBasisPoints: bp });
  return <form className="space-y-4 rounded-lg border border-border bg-card p-4" onSubmit={async (event) => {
    event.preventDefault(); if (pending || bp === null) return; setPending(true);
    try { const r = await updateFeePolicy({ expectedVersion: version, basisPoints: bp, reason }); setResult({ ok: r.ok, text: r.message }); if (r.ok) window.location.reload(); }
    catch { setResult({ ok: false, text: "No se confirmó la respuesta. Actualiza la página antes de reintentar." }); } finally { setPending(false); }
  }}>
    <h3 className="text-xl">Cambiar porcentaje de comisión</h3>
    <p className="text-sm leading-6 text-muted-foreground">Versión vigente: {version} ({formatBasisPoints(basisPoints)}). El cambio sólo afecta órdenes nuevas: las existentes, sus reintentos y su historial conservan su desglose.</p>
    <fieldset className="min-w-0 space-y-3" disabled={pending}>
      <Field error={bp === null ? "Ingresa un porcentaje válido entre 0 y 20 con hasta 2 decimales." : undefined} htmlFor={`${id}-percent`} label="Nuevo porcentaje (0 a 20, hasta 2 decimales)">
        <Input aria-describedby={`${id}-percent-msg`} aria-invalid={bp === null ? true : undefined} id={`${id}-percent`} inputMode="decimal" name="percent" onChange={(e) => setPercent(e.target.value)} required value={percent} />
      </Field>
      {preview ? <p className="text-sm leading-6">Ejemplo: en un servicio de {formatClp(100000)} el cliente pagaría {formatClp(preview.customerTotalClp)} (comisión {formatClp(preview.platformFeeClp)}) y el profesional tendría asignados {formatClp(preview.professionalAmountClp)}.</p> : null}
      <Field htmlFor={`${id}-reason`} label="Motivo (obligatorio, queda en el historial)"><Textarea id={`${id}-reason`} maxLength={1000} minLength={10} name="reason" onChange={(e) => setReason(e.target.value)} required value={reason} /></Field>
      <CheckboxRow className="items-start"><Checkbox name="confirm" required />Confirmo que este porcentaje se aplicará a las nuevas órdenes.</CheckboxRow>
      <Button disabled={bp === null} loading={pending} type="submit">Guardar nueva versión</Button>
    </fieldset>
    {result ? <div aria-live="polite" className="break-words"><Alert tone={result.ok ? "success" : "danger"}>{result.text}</Alert></div> : null}
  </form>;
}
