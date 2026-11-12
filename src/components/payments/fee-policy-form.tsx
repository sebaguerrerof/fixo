"use client";
import { useState } from "react";
import { updateFeePolicy } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { jobInputClass } from "@/components/jobs/job-command-form";
import { formatClp } from "@/lib/utils";
import { formatBasisPoints, percentToBasisPoints, previewTerms } from "@/domain/payments/presentation";

/** Superadmin only (the DB enforces it again). The expected version makes a stale tab fail instead of overwriting another change. */
export function FeePolicyForm({ version, basisPoints }: { readonly version: number; readonly basisPoints: number }) {
  const [percent, setPercent] = useState(formatBasisPoints(basisPoints).replace(" %", "")), [reason, setReason] = useState(""), [pending, setPending] = useState(false), [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const bp = percentToBasisPoints(percent), preview = bp === null ? null : previewTerms(100000, { version, feeBasisPoints: bp });
  return <form className="space-y-3 rounded-lg border p-4" onSubmit={async (event) => {
    event.preventDefault(); if (pending || bp === null) return; setPending(true);
    try { const r = await updateFeePolicy({ expectedVersion: version, basisPoints: bp, reason }); setResult({ ok: r.ok, text: r.message }); if (r.ok) window.location.reload(); }
    catch { setResult({ ok: false, text: "No se confirmó la respuesta. Actualiza la página antes de reintentar." }); } finally { setPending(false); }
  }}>
    <h3 className="font-semibold">Cambiar porcentaje de comisión</h3>
    <p className="text-sm text-muted-foreground">Versión vigente: {version} ({formatBasisPoints(basisPoints)}). El cambio sólo afecta órdenes nuevas: las existentes, sus reintentos y su historial conservan su desglose.</p>
    <fieldset disabled={pending} className="min-w-0 space-y-3">
      <label className="grid gap-1 text-sm">Nuevo porcentaje (0 a 20, hasta 2 decimales)<input name="percent" value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="decimal" required aria-invalid={bp === null} className={jobInputClass} /></label>
      {bp === null ? <p role="alert" className="text-sm">Ingresa un porcentaje válido entre 0 y 20 con hasta 2 decimales.</p>
        : preview ? <p className="text-sm">Ejemplo: en un servicio de {formatClp(100000)} el cliente pagaría {formatClp(preview.customerTotalClp)} (comisión {formatClp(preview.platformFeeClp)}) y el profesional tendría asignados {formatClp(preview.professionalAmountClp)}.</p> : null}
      <label className="grid gap-1 text-sm">Motivo (obligatorio, queda en el historial)<textarea name="reason" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={10} maxLength={1000} className={jobInputClass} /></label>
      <label className="flex items-start gap-2 text-sm"><input name="confirm" type="checkbox" required className="mt-1" />Confirmo que este porcentaje se aplicará a las nuevas órdenes.</label>
      <Button type="submit" disabled={bp === null}>{pending ? "Guardando…" : "Guardar nueva versión"}</Button>
    </fieldset>
    {result ? <p role={result.ok ? "status" : "alert"} className="break-words text-sm">{result.text}</p> : null}
  </form>;
}
