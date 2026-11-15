"use client";
import { useId, useRef, useState, type ReactNode } from "react";

import { performJobCommand } from "@/app/actions/jobs";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxRow, Field, Input, Select, Textarea } from "@/components/ui/field";

export function JobCommandForm({ jobId, revision, action, label, children, values = {} }: { readonly jobId: string; readonly revision: number; readonly action: string; readonly label: string; readonly children?: ReactNode; readonly values?: Record<string, string> }) {
  const [pending, setPending] = useState(false), [result, setResult] = useState<{ ok: boolean; message: string } | null>(null), attempt = useRef<{ key: string; operationId: string; revision: number } | null>(null);
  return (
    <form className="space-y-4 rounded-lg border border-border bg-card p-4" onSubmit={async (event) => {
      event.preventDefault(); if (pending) return;
      const form = event.currentTarget, fields = new FormData(form), payload = { ...values, ...Object.fromEntries([...fields.entries()].filter(([k]) => k !== "confirm")) }, key = JSON.stringify({ action, payload });
      if (!attempt.current || attempt.current.key !== key) attempt.current = { key, operationId: crypto.randomUUID(), revision };
      const operation = attempt.current;
      setPending(true);
      try { const r = await performJobCommand({ jobId, expectedRevision: operation.revision, operationId: operation.operationId, command: { action, payload } }); setResult(r); if (r.ok) { attempt.current = null; form.reset(); window.location.reload(); } }
      catch { setResult({ ok: false, message: "No se confirmó la respuesta. Puedes reintentar con los mismos campos; se conserva el identificador de la operación." }); }
      finally { setPending(false); }
    }}>
      <h3 className="text-xl">{label}</h3>
      <fieldset className="min-w-0 space-y-3" disabled={pending}>
        {children}
        <CheckboxRow className="items-start"><Checkbox name="confirm" required />Confirmo que deseo registrar esta acción.</CheckboxRow>
        <Button loading={pending} type="submit">{label}</Button>
      </fieldset>
      {result ? <div aria-live="polite" className="break-words"><Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert></div> : null}
    </form>
  );
}

/** A labelled single-line control for job forms (date, time, text, number). */
export function JobFieldInput({ label, name, type = "text", required = true }: { readonly label: string; readonly name: string; readonly type?: string; readonly required?: boolean }) {
  const id = useId();
  return <Field htmlFor={id} label={label}><Input id={id} name={name} required={required} type={type} /></Field>;
}

/** A labelled select for job forms. */
export function JobFieldSelect({ label, name, children }: { readonly label: string; readonly name: string; readonly children: ReactNode }) {
  const id = useId();
  return <Field htmlFor={id} label={label}><Select id={id} name={name}>{children}</Select></Field>;
}

/** A labelled multi-line control for job forms. */
export function JobFieldTextarea({ label, name, required, minLength, maxLength = 1000 }: { readonly label: string; readonly name: string; readonly required?: boolean; readonly minLength?: number; readonly maxLength?: number }) {
  const id = useId();
  return <Field htmlFor={id} label={label}><Textarea id={id} maxLength={maxLength} minLength={minLength} name={name} required={required} /></Field>;
}

export function JobReason({ label = "Motivo" }: { readonly label?: string }) { return <JobFieldTextarea label={label} minLength={10} name="reason" required />; }
export function JobMessage({ name = "message", label = "Mensaje", min = 10 }: { readonly name?: string; readonly label?: string; readonly min?: number }) { return <JobFieldTextarea label={label} maxLength={name === "description" ? 3000 : 1000} minLength={min} name={name} required />; }
