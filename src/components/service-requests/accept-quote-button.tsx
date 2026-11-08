"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { acceptQuoteAction } from "@/app/cliente/solicitudes/[id]/actions";
import { Button } from "@/components/ui/button";

export function AcceptQuoteButton({ serviceRequestId, quoteId }: { readonly serviceRequestId: string; readonly quoteId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(): Promise<void> {
    const confirmed = window.confirm("¿Confirmas que quieres elegir a este técnico? Las demás cotizaciones enviadas quedarán rechazadas.");
    if (!confirmed) return;

    setPending(true);
    setError(null);
    const result = await acceptQuoteAction(serviceRequestId, quoteId);
    setPending(false);

    if (!result.ok) {
      if (result.message === "unauthenticated") {
        router.push("/login");
        return;
      }
      setError(result.message ?? "No pudimos aceptar esta cotización.");
      return;
    }
    router.refresh();
  }

  return <div className="space-y-2">
    <Button disabled={pending} onClick={handleClick} size="sm" type="button">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}Elegir este técnico</Button>
    {error ? <p className="text-sm text-destructive">{error}</p> : null}
  </div>;
}
