"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";

import { submitServiceRequest } from "@/app/solicitar/actions";
import { CommuneSelect } from "@/components/shared/commune-select";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { clearDraft, loadDraft, saveDraft } from "@/components/service-requests/request-draft";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Category } from "@/domain/entities/category";
import { serviceRequestInputSchema, type ServiceRequestInput } from "@/domain/validation/service-request-input";

const LOGIN_URL = "/login?continuar=%2Fsolicitar";

interface CreateServiceRequestFormProps {
  readonly categories: readonly Category[];
  /** False for a visitor without a session: they can fill the form, and are asked to sign in only when they send it. */
  readonly signedIn?: boolean;
  /** Starting values, e.g. from the service page the visitor came from. */
  readonly initial?: { readonly categoryId?: string; readonly locationLabel?: string };
}

export function CreateServiceRequestForm({ categories, signedIn = true, initial }: CreateServiceRequestFormProps) {
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [draftNotSaved, setDraftNotSaved] = useState(false);
  const form = useForm<ServiceRequestInput>({
    resolver: zodResolver(serviceRequestInputSchema),
    defaultValues: { title: "", categoryId: "", description: "", locationLabel: "", priority: "standard", scheduledFor: "", address: "", reference: "", preferredSlot: "", complementaryInfo: "" },
  });
  const errors = form.formState.errors;
  useEffect(() => {
    // Starting point: what the visitor was writing before signing in, then whatever the page they came from picked.
    const draft = loadDraft();
    if (draft) { form.reset({ ...form.getValues(), ...draft }); setRestored(true); }
    if (initial?.categoryId && categories.some((category) => category.id === initial.categoryId)) form.setValue("categoryId", initial.categoryId);
    if (initial?.locationLabel) form.setValue("locationLabel", initial.locationLabel);
    form.setValue("operationId", crypto.randomUUID());
  }, []);

  function continueToSignIn(input: ServiceRequestInput) {
    // Do not navigate away if the draft could not be kept: the form stays on screen and the visitor decides.
    if (!saveDraft(input)) { setDraftNotSaved(true); return; }
    router.push(LOGIN_URL);
  }

  async function onSubmit(input: ServiceRequestInput) {
    setFeedback(null);
    setDraftNotSaved(false);
    if (!signedIn) { continueToSignIn(input); return; }
    const result = await submitServiceRequest(input);
    if (!result.ok) {
      if (result.message === "unauthenticated") { continueToSignIn(input); return; }
      setFeedback(result.message ?? "No pudimos registrar tu solicitud."); return;
    }
    clearDraft(); setRestored(false);
    setFeedback("success"); form.reset(); form.setValue("operationId", crypto.randomUUID()); router.refresh();
  }

  if (feedback === "success") {
    return (
      <Alert tone="success" title="Solicitud registrada">
        Puedes seguirla desde tu panel y comparar las propuestas de técnicos habilitados.
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => router.push("/cliente")}>Ver mis solicitudes</Button>
          <Button onClick={() => setFeedback(null)} type="button" variant="outline">Crear otra solicitud</Button>
        </div>
      </Alert>
    );
  }

  const invalid = (name: keyof ServiceRequestInput) => (errors[name] ? true : undefined);
  return (
    <form className="space-y-5" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      {!signedIn ? <Alert tone="info" title="Cuéntanos qué necesitas">Llena el formulario ahora. Para enviarlo te pediremos ingresar o crear una cuenta, y lo que escribiste (sin dirección ni referencias) quedará guardado en este dispositivo para que no lo repitas.</Alert> : null}
      {restored ? <Alert tone="info" title="Recuperamos tu borrador">Lo guardamos en este dispositivo. Revísalo y completa lo que falte; la dirección y las referencias no se guardan, ingrésalas de nuevo si las necesitas.</Alert> : null}
      <Field error={errors.title?.message} htmlFor={f("title")} label="¿Qué necesitas resolver?">
        <Input aria-describedby={`${f("title")}-msg`} aria-invalid={invalid("title")} id={f("title")} {...form.register("title")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field error={errors.categoryId?.message} htmlFor={f("categoryId")} label="Rubro">
          <Select aria-describedby={`${f("categoryId")}-msg`} aria-invalid={invalid("categoryId")} id={f("categoryId")} {...form.register("categoryId")}>
            <option value="">Selecciona un rubro</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </Select>
        </Field>
      </div>
      <CommuneSelect
        error={errors.locationLabel?.message}
        idPrefix={f("location")}
        onBlur={() => void form.trigger("locationLabel")}
        onChange={(commune) => form.setValue("locationLabel", commune, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
        value={form.watch("locationLabel")}
      />
      <Field error={errors.description?.message} htmlFor={f("description")} label="Detalles del problema">
        <Textarea aria-describedby={`${f("description")}-msg`} aria-invalid={invalid("description")} className="min-h-32" id={f("description")} placeholder="Describe el problema sin publicar dirección exacta, teléfono ni datos personales." {...form.register("description")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field error={errors.scheduledFor?.message} htmlFor={f("scheduledFor")} label="Fecha preferida (opcional)">
          <Input aria-describedby={`${f("scheduledFor")}-msg`} aria-invalid={invalid("scheduledFor")} id={f("scheduledFor")} type="datetime-local" {...form.register("scheduledFor")} />
        </Field>
        <Field error={errors.preferredSlot?.message} htmlFor={f("preferredSlot")} label="Horario preferido (opcional)">
          <Input aria-describedby={`${f("preferredSlot")}-msg`} aria-invalid={invalid("preferredSlot")} id={f("preferredSlot")} placeholder="Ej. 10 a 13 horas" {...form.register("preferredSlot")} />
        </Field>
        <Field error={errors.address?.message} htmlFor={f("address")} label="Dirección privada (opcional)">
          <Input aria-describedby={`${f("address")}-msg`} aria-invalid={invalid("address")} autoComplete="street-address" id={f("address")} {...form.register("address")} />
        </Field>
        <Field error={errors.reference?.message} htmlFor={f("reference")} label="Referencia privada (opcional)">
          <Input aria-describedby={`${f("reference")}-msg`} aria-invalid={invalid("reference")} id={f("reference")} {...form.register("reference")} />
        </Field>
      </div>
      <Field error={errors.complementaryInfo?.message} htmlFor={f("complementaryInfo")} label="Información privada adicional (opcional)">
        <Textarea aria-describedby={`${f("complementaryInfo")}-msg`} aria-invalid={invalid("complementaryInfo")} id={f("complementaryInfo")} {...form.register("complementaryInfo")} />
      </Field>
      <p className="text-xs leading-5 text-muted-foreground">Prioridad normal. La dirección y referencias solo están disponibles para ti, administración y el técnico adjudicado mientras conserve su habilitación.</p>
      {draftNotSaved ? (
        <Alert title="No pudimos guardar tu borrador" tone="warning">
          Este navegador no permite guardar datos, así que si ingresas ahora tendrás que escribir la solicitud de nuevo. Puedes copiar tu texto antes de continuar.
          <div className="mt-4"><Button onClick={() => router.push(LOGIN_URL)} size="sm" type="button" variant="outline">Ingresar de todos modos</Button></div>
        </Alert>
      ) : null}
      {feedback ? <Alert tone="danger">{feedback}</Alert> : null}
      <Button className="w-full" loading={form.formState.isSubmitting} size="lg" type="submit"><Send aria-hidden="true" className="size-4" />{signedIn ? "Registrar solicitud" : "Continuar y enviar"}</Button>
    </form>
  );
}
