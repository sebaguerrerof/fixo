"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelServiceRequest } from "@/app/cliente/solicitudes/[id]/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
export function CancelRequestButton({ id, revision }: { readonly id: string; readonly revision: number }) {
  const router = useRouter(); const [pending, start] = useTransition(); const [message, setMessage] = useState("");
  return <div className="space-y-2"><Button variant="outline" disabled={pending} onClick={() => {
    if (!window.confirm("¿Cancelar esta solicitud y rechazar sus cotizaciones?")) return;
    start(async () => { const r = await cancelServiceRequest(id, revision); if (r.ok) router.refresh(); else setMessage(r.message ?? "No pudimos cancelar."); });
  }}>{pending ? "Cancelando…" : "Cancelar solicitud"}</Button>{message ? <Alert tone="danger">{message}</Alert> : null}</div>;
}
export function RequestPhotoForm({ id: requestId }: { readonly id: string }) {
  const id = useId();
  const router = useRouter(); const [pending, start] = useTransition(); const [message, setMessage] = useState("");
  return <form className="space-y-3" onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    start(async () => { try { const response = await fetch(`/api/service-requests/${requestId}/photos`, { method: "POST", body: data }); if (!response.ok) throw new Error(); setMessage("Fotografía guardada."); form.reset(); router.refresh(); } catch { setMessage("No pudimos guardar la fotografía. Usa JPEG o PNG de hasta 4 MiB; máximo cinco fotos."); } });
  }}><Field htmlFor={id} label="Fotografía privada (opcional)"><Input accept="image/jpeg,image/png" className="h-auto min-h-11 py-2 file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-secondary-foreground" id={id} name="photo" required type="file" /></Field><p className="text-xs leading-5 text-muted-foreground">Se recodifica sin metadatos. Solo tú, administración y el técnico adjudicado habilitado pueden verla.</p><Button disabled={pending} loading={pending} type="submit" variant="outline">Agregar fotografía</Button><div aria-live="polite" role="status">{message ? <Alert tone="info">{message}</Alert> : null}</div></form>;
}
