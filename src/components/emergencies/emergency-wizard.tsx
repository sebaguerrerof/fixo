"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2, LoaderCircle, MapPin, ShieldAlert, Siren, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import {
  cancelEmergencyAction,
  confirmAssignmentAction,
  createEmergencyAction,
  getAssignedTechnicianAction,
  refreshEmergencyAction,
  simulateTechnicianAcceptanceAction,
  startMatchingAction,
} from "@/app/urgencia/actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { EmergencyRequest } from "@/domain/entities/emergency-request";
import type { Technician } from "@/domain/entities/technician";
import { emergencyInputSchema, type EmergencyInput } from "@/domain/validation/emergency-input";

const LIVE_STATUSES = new Set(["created", "matching", "broadcasting", "accepted", "technician_en_route", "arrived", "in_progress"]);
const CANCELLABLE_STATUSES = new Set(["created", "matching", "broadcasting", "accepted"]);

function FieldError({ message }: { readonly message?: string }) {
  return message ? <span className="text-sm text-destructive">{message}</span> : null;
}

export function EmergencyWizard({ isDemoMode }: { readonly isDemoMode: boolean }) {
  const router = useRouter();
  const [emergency, setEmergency] = useState<EmergencyRequest | null>(null);
  const [assignedTechnician, setAssignedTechnician] = useState<Technician | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const form = useForm<EmergencyInput>({
    resolver: zodResolver(emergencyInputSchema),
    defaultValues: { description: "", locationLabel: "" },
  });

  useEffect(() => {
    if (!emergency || !LIVE_STATUSES.has(emergency.status)) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      const result = await refreshEmergencyAction(emergency.id);
      if (result.ok && result.emergency) setEmergency(result.emergency);
    }, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [emergency?.id, emergency?.status]);

  useEffect(() => {
    if (emergency?.assignedTechnicianId) {
      getAssignedTechnicianAction(emergency.assignedTechnicianId).then(setAssignedTechnician);
    } else {
      setAssignedTechnician(null);
    }
  }, [emergency?.assignedTechnicianId]);

  async function onDescribe(input: EmergencyInput): Promise<void> {
    setPending(true);
    setError(null);
    const result = await createEmergencyAction(input);
    setPending(false);
    if (!result.ok || !result.emergency) {
      if (result.message === "unauthenticated") {
        router.push("/login?continuar=%2Furgencia");
        return;
      }
      setError(result.message ?? "No pudimos registrar tu urgencia.");
      return;
    }
    setEmergency(result.emergency);
  }

  async function runAction(action: () => Promise<{ ok: boolean; message?: string; emergency?: EmergencyRequest }>): Promise<void> {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (!result.ok) {
      setError(result.message ?? "Ocurrió un error inesperado.");
      return;
    }
    if (result.emergency) setEmergency(result.emergency);
  }

  if (!emergency) {
    return (
      <form className="space-y-5" noValidate onSubmit={form.handleSubmit(onDescribe)}>
        <label className="block space-y-2">
          <span className="text-sm font-semibold">¿Qué está pasando?</span>
          <textarea className="min-h-32 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Ej. Siento olor a gas en la cocina desde hace unos minutos." {...form.register("description")} />
          <FieldError message={form.formState.errors.description?.message} />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold">¿Dónde te encuentras?</span>
          <input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Ej. Ñuñoa" {...form.register("locationLabel")} />
          <FieldError message={form.formState.errors.locationLabel?.message} />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" disabled={pending} type="submit" variant="emergency">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Siren className="size-4" />}Pedir ayuda ahora
        </Button>
      </form>
    );
  }

  const assessment = emergency.aiAssessment;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3"><StatusBadge status={emergency.status} />{error ? <span className="text-sm text-destructive">{error}</span> : null}</div>

      {assessment ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="space-y-3 p-5 text-amber-950">
            <p className="inline-flex items-center gap-2 font-semibold"><ShieldAlert className="size-5" />Orientación inicial</p>
            <p className="text-sm leading-6">{assessment.summary}</p>
            {assessment.safetyFlags.length > 0 ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-100 p-3 text-sm leading-6"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{assessment.safetyFlags.join(" ")}</span></div>
            ) : null}
            {assessment.questions.length > 0 ? (
              <ul className="list-inside list-disc text-sm leading-6">{assessment.questions.map((question) => <li key={question}>{question}</li>)}</ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-4" />{emergency.locationLabel}</p>

      {emergency.status === "created" ? (
        <Button disabled={pending} onClick={() => runAction(() => startMatchingAction(emergency.id))} type="button" variant="emergency">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Siren className="size-4" />}Buscar técnicos disponibles
        </Button>
      ) : null}

      {emergency.status === "matching" ? <p className="text-sm text-muted-foreground">Buscando técnicos disponibles cerca de ti…</p> : null}

      {emergency.status === "broadcasting" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Convocamos a {emergency.candidateTechnicianIds.length} técnico(s) cercano(s). Esperando que alguno acepte…</p>
          {isDemoMode ? (
            <Button disabled={pending} onClick={() => runAction(() => simulateTechnicianAcceptanceAction(emergency.id))} type="button" variant="outline">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}Simular aceptación de un técnico (demo)
            </Button>
          ) : null}
        </div>
      ) : null}

      {emergency.status === "accepted" ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="font-semibold">{assignedTechnician ? `${assignedTechnician.displayName} aceptó tu urgencia` : "Un técnico aceptó tu urgencia"}</p>
            <Button disabled={pending} onClick={() => runAction(() => confirmAssignmentAction(emergency.id))} type="button">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}Confirmar técnico
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {["technician_en_route", "arrived", "in_progress"].includes(emergency.status) ? (
        <Card>
          <CardContent className="space-y-2 p-5">
            <p className="font-semibold">{assignedTechnician?.displayName ?? "Tu técnico"} está en camino a tu domicilio</p>
            <p className="text-sm text-muted-foreground">Actualizamos este estado automáticamente a medida que avanza el servicio.</p>
          </CardContent>
        </Card>
      ) : null}

      {emergency.status === "completed" ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="space-y-2 p-5 text-emerald-950"><CheckCircle2 className="size-6" /><p className="font-semibold">Servicio completado</p></CardContent>
        </Card>
      ) : null}

      {["cancelled", "expired", "disputed"].includes(emergency.status) ? (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="space-y-2 p-5 text-rose-950"><XCircle className="size-6" /><p className="font-semibold">Esta urgencia ya no está activa.</p></CardContent>
        </Card>
      ) : null}

      {CANCELLABLE_STATUSES.has(emergency.status) ? (
        <Button disabled={pending} onClick={() => runAction(() => cancelEmergencyAction(emergency.id))} type="button" variant="outline">Cancelar urgencia</Button>
      ) : null}
    </div>
  );
}
