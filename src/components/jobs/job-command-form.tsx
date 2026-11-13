"use client";
import { useRef, useState, type ReactNode } from "react";
import { performJobCommand } from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";
export const jobInputClass = "w-full min-w-0 rounded-lg border bg-background p-2 text-sm";
export function JobCommandForm({ jobId, revision, action, label, children, values = {} }: { readonly jobId: string; readonly revision: number; readonly action: string; readonly label: string; readonly children?: ReactNode; readonly values?: Record<string, string> }) {
  const [pending, setPending] = useState(false), [result, setResult] = useState<{ ok: boolean; message: string } | null>(null), attempt = useRef<{ key: string; operationId: string; revision: number } | null>(null);
  return <form className="space-y-3 rounded-lg border p-4" onSubmit={async event => {
    event.preventDefault(); if (pending) return;
    const form = event.currentTarget, fields = new FormData(form), payload = { ...values, ...Object.fromEntries([...fields.entries()].filter(([k]) => k !== "confirm")) }, key = JSON.stringify({ action, payload });
    if (!attempt.current || attempt.current.key !== key) attempt.current = { key, operationId: crypto.randomUUID(), revision };
    const operation = attempt.current;
    setPending(true);
    try { const r = await performJobCommand({ jobId, expectedRevision: operation.revision, operationId: operation.operationId, command: { action, payload } }); setResult(r); if (r.ok) { attempt.current = null; form.reset(); window.location.reload(); } } catch { setResult({ ok: false, message: "No se confirmó la respuesta. Puedes reintentar con los mismos campos; se conserva el identificador de la operación." }); } finally { setPending(false); }
  }}><h3 className="font-semibold">{label}</h3><fieldset disabled={pending} className="min-w-0 space-y-3">{children}<label className="flex items-start gap-2 text-sm"><input name="confirm" type="checkbox" required className="mt-1" />Confirmo que deseo registrar esta acción.</label><Button type="submit" disabled={pending}>{pending ? "Registrando…" : label}</Button></fieldset>{result ? <p role={result.ok ? "status" : "alert"} className="break-words text-sm">{result.message}</p> : null}</form>;
}
export function JobReason({ label = "Motivo" }: { readonly label?: string }) { return <label className="grid gap-1 text-sm">{label}<textarea name="reason" required minLength={10} maxLength={1000} className={jobInputClass} /></label>; }
export function JobMessage({ name = "message", label = "Mensaje", min = 10 }: { readonly name?: string; readonly label?: string; readonly min?: number }) { return <label className="grid gap-1 text-sm">{label}<textarea name={name} required minLength={min} maxLength={name === "description" ? 3000 : 1000} className={jobInputClass} /></label>; }
