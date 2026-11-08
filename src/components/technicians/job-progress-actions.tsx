"use client";

import { LoaderCircle, Navigation } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { advanceJobStatus } from "@/app/tecnico/trabajos/actions";
import { buttonVariants } from "@/components/ui/button";
import type { JobStatus } from "@/domain/enums/job-status";
import { cn } from "@/lib/utils";

const NEXT_STEP: Partial<Record<JobStatus, { readonly next: JobStatus; readonly label: string }>> = {
  scheduled: { next: "technician_en_route", label: "Confirmar salida" },
  technician_en_route: { next: "arrived", label: "Marcar llegada" },
  arrived: { next: "in_progress", label: "Iniciar trabajo" },
  in_progress: { next: "completed", label: "Marcar completado" },
};

export function JobProgressActions({ jobId, status, isEmergencyAwaitingCustomer }: { readonly jobId: string; readonly status: JobStatus; readonly isEmergencyAwaitingCustomer: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const step = NEXT_STEP[status];

  if (isEmergencyAwaitingCustomer) {
    return <p className="text-sm text-muted-foreground">Esperando que el cliente confirme el técnico asignado.</p>;
  }
  if (!step) return null;

  async function handleClick(): Promise<void> {
    setPending(true);
    setError(null);
    const result = await advanceJobStatus(jobId, step!.next);
    setPending(false);
    if (!result.ok) {
      setError(result.message ?? "No pudimos actualizar el trabajo.");
      return;
    }
    router.refresh();
  }

  return <div className="space-y-2">
    <button className={cn(buttonVariants({ size: "sm" }))} disabled={pending} onClick={handleClick} type="button">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Navigation className="size-4" />}{step.label}</button>
    {error ? <p className="text-sm text-destructive">{error}</p> : null}
  </div>;
}
