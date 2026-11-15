"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
export function JobEvidenceForm({ incidentId, jobId }: { readonly incidentId: string; readonly jobId: string }) {
  const id = useId();
  const [message, setMessage] = useState(""), [pending, start] = useTransition(), router = useRouter();
  return (
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); const form = e.currentTarget, data = new FormData(form); start(async () => { try { const response = await fetch(`/api/job-incidents/${incidentId}/evidence?job=${jobId}`, { method: "POST", body: data }); if (!response.ok) throw new Error(); setMessage("Evidencia incorporada de forma privada."); form.reset(); router.refresh(); } catch { setMessage("No pudimos incorporar el archivo. Revisa los adjuntos antes de reintentar."); } }); }}>
      <Field htmlFor={id} label="Evidencia opcional (JPEG o PNG, hasta 4 MiB; cinco archivos por participante)">
        <Input accept="image/jpeg,image/png" className="h-auto min-h-11 py-2 file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-secondary-foreground" disabled={pending} id={id} name="photo" required type="file" />
      </Field>
      <Button loading={pending} type="submit" variant="outline">Adjuntar evidencia</Button>
      <div aria-live="polite" role="status">{message ? <Alert tone="info">{message}</Alert> : null}</div>
    </form>
  );
}
