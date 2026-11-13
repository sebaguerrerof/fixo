"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelServiceRequest } from "@/app/cliente/solicitudes/[id]/actions";
import { Button } from "@/components/ui/button";
export function CancelRequestButton({ id, revision }: { readonly id: string; readonly revision: number }) {
  const router = useRouter(); const [pending, start] = useTransition(); const [message, setMessage] = useState("");
  return <div className="space-y-2"><Button variant="outline" disabled={pending} onClick={() => {
    if (!window.confirm("¿Cancelar esta solicitud y rechazar sus cotizaciones?")) return;
    start(async () => { const r = await cancelServiceRequest(id, revision); if (r.ok) router.refresh(); else setMessage(r.message ?? "No pudimos cancelar."); });
  }}>{pending ? "Cancelando…" : "Cancelar solicitud"}</Button>{message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}</div>;
}
export function RequestPhotoForm({ id }: { readonly id: string }) {
  const router = useRouter(); const [pending, start] = useTransition(); const [message, setMessage] = useState("");
  return <form className="space-y-3" onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    start(async () => { try { const response = await fetch(`/api/service-requests/${id}/photos`, { method: "POST", body: data }); if (!response.ok) throw new Error(); setMessage("Fotografía guardada."); form.reset(); router.refresh(); } catch { setMessage("No pudimos guardar la fotografía. Usa JPEG o PNG de hasta 4 MiB; máximo cinco fotos."); } });
  }}><label className="block space-y-2"><span>Fotografía privada (opcional)</span><input aria-label="Fotografía privada" className="block w-full text-sm" name="photo" type="file" accept="image/jpeg,image/png" required /></label><p className="text-xs text-muted-foreground">Se recodifica sin metadatos. Solo tú, administración y el técnico adjudicado habilitado pueden verla.</p><Button type="submit" variant="outline" disabled={pending}>{pending ? "Guardando…" : "Agregar fotografía"}</Button>{message ? <p role="status" className="text-sm">{message}</p> : null}</form>;
}
