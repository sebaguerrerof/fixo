"use client";
import { useState } from "react";
import { requestPaymentReconciliation } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";

/** Superadmin only. It schedules a provider re-check; it never sets a payment state. */
export function ReconcileButton({ attemptId, label }: { readonly attemptId: string; readonly label: string }) {
  const [pending, setPending] = useState(false), [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  return <div className="space-y-1"><Button type="button" variant="outline" disabled={pending} onClick={async () => {
    if (pending) return; setPending(true);
    try { const r = await requestPaymentReconciliation({ attemptId }); setResult({ ok: r.ok, text: r.message }); } catch { setResult({ ok: false, text: "No se confirmó la respuesta." }); } finally { setPending(false); }
  }}>{pending ? "Programando…" : label}</Button>{result ? <p role={result.ok ? "status" : "alert"} className="text-xs">{result.text}</p> : null}</div>;
}
