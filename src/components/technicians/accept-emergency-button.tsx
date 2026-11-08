"use client";

import { LoaderCircle, Siren } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { acceptEmergencyOpportunityAction } from "@/app/tecnico/oportunidades/actions";
import { Button } from "@/components/ui/button";

export function AcceptEmergencyButton({ emergencyId }: { readonly emergencyId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(): Promise<void> {
    setPending(true);
    setError(null);
    const result = await acceptEmergencyOpportunityAction(emergencyId);
    setPending(false);
    if (!result.ok) {
      setError(result.message ?? "No pudimos adjudicar esta urgencia.");
      return;
    }
    router.refresh();
  }

  return <div className="space-y-2">
    <Button disabled={pending} onClick={handleClick} size="sm" type="button" variant="emergency">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Siren className="size-4" />}Aceptar urgencia</Button>
    {error ? <p className="text-sm text-destructive">{error}</p> : null}
  </div>;
}
