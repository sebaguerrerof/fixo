"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function JobEvidenceForm({ incidentId, jobId }: { readonly incidentId: string; readonly jobId: string }) {
  const [message, setMessage] = useState(""), [pending, start] = useTransition(), router = useRouter();
  return <form className="space-y-3" onSubmit={e => { e.preventDefault(); const form = e.currentTarget, data = new FormData(form); start(async () => { try { const response = await fetch(`/api/job-incidents/${incidentId}/evidence?job=${jobId}`, { method: "POST", body: data }); if (!response.ok) throw new Error(); setMessage("Evidencia incorporada de forma privada."); form.reset(); router.refresh(); } catch { setMessage("No pudimos incorporar el archivo. Revisa los adjuntos antes de reintentar."); } }); }}><label className="grid gap-1 text-sm">Evidencia opcional (JPEG o PNG, hasta 4 MiB; cinco archivos por participante)<input required name="photo" type="file" accept="image/jpeg,image/png" disabled={pending} className="w-full min-w-0 text-sm" /></label><Button disabled={pending} variant="outline">{pending ? "Incorporando…" : "Adjuntar evidencia"}</Button><p role="status" className="text-sm">{message}</p></form>;
}
