"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { withdrawQuote } from "@/app/tecnico/oportunidades/[id]/cotizar/actions";
export function WithdrawQuoteButton({ id }: { readonly id: string }) {
  const [pending, start] = useTransition(), [message, setMessage] = useState(""); const router = useRouter();
  return <div><Button variant="outline" size="sm" disabled={pending} onClick={() => { if (!window.confirm("¿Retirar esta propuesta? Podrás editarla antes de volver a enviarla.")) return; start(async () => { const r = await withdrawQuote(id); if (r.ok) router.refresh(); else setMessage(r.message ?? "No pudimos retirar."); }); }}>{pending ? "Retirando…" : "Retirar propuesta"}</Button>{message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}</div>;
}
