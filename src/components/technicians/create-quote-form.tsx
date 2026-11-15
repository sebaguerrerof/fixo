"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { Quote } from "@/domain/entities/quote";
import { useForm } from "react-hook-form";

import { createAndSubmitQuote, saveQuoteDraft } from "@/app/tecnico/oportunidades/[id]/cotizar/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxRow, Field, Input, Textarea } from "@/components/ui/field";
import { quoteInputSchema, type QuoteInput, type QuoteFormInput } from "@/domain/validation/quote-input";

export function CreateQuoteForm({ serviceRequestId, draft }: { readonly serviceRequestId: string; readonly draft?: Quote }) {
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;
  const router = useRouter();
  const [feedback, setFeedback] = useState<"success" | "draft" | string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<QuoteFormInput, unknown, QuoteInput>({
    resolver: zodResolver(quoteInputSchema),
    defaultValues: {
      serviceRequestId,
      priceClp: draft?.priceClp ?? 0,
      laborClp: draft?.laborClp ?? draft?.priceClp ?? 0,
      materialsClp: draft?.materialsClp ?? 0,
      diagnosticClp: draft?.diagnosticClp ?? 0,
      expectedRevision: draft?.revision ?? 0,
      description: draft?.description ?? "",
      materialsIncluded: draft?.materialsIncluded ?? "",
      materialsNotIncluded: draft?.materialsNotIncluded ?? "",
      diagnosticVisit: draft?.diagnosticVisit ?? false,
      estimatedDuration: draft?.estimatedDuration ?? "",
      availableDate: localDate(draft?.availableDate),
      conditions: draft?.conditions ?? "",
      expiresAt: localDate(draft?.expiresAt),
    },
  });
  useEffect(() => { form.setValue("operationId", crypto.randomUUID()); }, [form]);
  const labor = form.watch("laborClp"), materials = form.watch("materialsClp"), diagnostic = form.watch("diagnosticClp");
  useEffect(() => { form.setValue("priceClp", Number(labor || 0) + Number(materials || 0) + Number(diagnostic || 0)); }, [labor, materials, diagnostic, form]);

  async function onSubmit(input: QuoteInput): Promise<void> {
    setFeedback(null);
    setPending(true);
    const result = await createAndSubmitQuote({ ...input, availableDate: new Date(input.availableDate).toISOString(), expiresAt: new Date(input.expiresAt).toISOString() });
    setPending(false);

    if (!result.ok) {
      if (result.message === "unauthenticated") {
        router.push("/login");
        return;
      }
      setFeedback(result.message ?? "No pudimos enviar tu cotización.");
      return;
    }
    setFeedback("success");
  }

  async function onSaveDraft(): Promise<void> {
    setFeedback(null);
    setPending(true);
    const parsed = quoteInputSchema.safeParse(form.getValues());
    if (!parsed.success) {
      setPending(false);
      setFeedback("Revisa los datos de tu cotización antes de guardar.");
      return;
    }
    const result = await saveQuoteDraft({ ...parsed.data, availableDate: new Date(parsed.data.availableDate).toISOString(), expiresAt: new Date(parsed.data.expiresAt).toISOString() });
    setPending(false);

    if (!result.ok) {
      if (result.message === "unauthenticated") {
        router.push("/login");
        return;
      }
      setFeedback(result.message ?? "No pudimos guardar el borrador.");
      return;
    }
    form.setValue("expectedRevision", result.revision ?? 1);
    form.setValue("operationId", crypto.randomUUID());
    setFeedback("draft");
  }

  if (feedback === "success") {
    return (
      <Alert tone="success" title="Cotización enviada">
        El cliente ya puede revisar tu propuesta y compararla con otras.
        <div className="mt-4"><Button onClick={() => router.push("/tecnico/oportunidades")} type="button" variant="outline">Volver a oportunidades</Button></div>
      </Alert>
    );
  }

  if (feedback === "draft") {
    return (
      <Alert tone="info" title="Borrador guardado">
        Todavía no es visible para el cliente.
        <div className="mt-4"><Button onClick={() => setFeedback(null)} type="button" variant="outline">Continuar editando</Button></div>
      </Alert>
    );
  }

  const errors = form.formState.errors;
  const invalid = (name: keyof QuoteFormInput) => (errors[name] ? true : undefined);
  return (
    <form className="space-y-5" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <input type="hidden" {...form.register("serviceRequestId")} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field error={errors.laborClp?.message} htmlFor={f("laborClp")} label="Mano de obra (CLP)"><Input aria-describedby={`${f("laborClp")}-msg`} aria-invalid={invalid("laborClp")} id={f("laborClp")} inputMode="numeric" min="0" step="1" type="number" {...form.register("laborClp")} /></Field>
        <Field error={errors.materialsClp?.message} htmlFor={f("materialsClp")} label="Materiales (CLP)"><Input aria-describedby={`${f("materialsClp")}-msg`} aria-invalid={invalid("materialsClp")} id={f("materialsClp")} inputMode="numeric" min="0" step="1" type="number" {...form.register("materialsClp")} /></Field>
        <Field error={errors.diagnosticClp?.message} htmlFor={f("diagnosticClp")} label="Diagnóstico (CLP)"><Input aria-describedby={`${f("diagnosticClp")}-msg`} aria-invalid={invalid("diagnosticClp")} id={f("diagnosticClp")} inputMode="numeric" min="0" step="1" type="number" {...form.register("diagnosticClp")} /></Field>
        <div aria-live="polite" className="flex flex-col justify-end pb-2"><p className="text-sm font-medium text-muted-foreground">Total</p><p className="tabular font-display text-3xl font-bold">{Number(form.watch("priceClp") || 0).toLocaleString("es-CL")} CLP</p>{errors.priceClp?.message ? <p className="text-sm text-destructive-soft-foreground" role="alert">{errors.priceClp.message}</p> : null}</div>
        <Field error={errors.estimatedDuration?.message} htmlFor={f("estimatedDuration")} label="Tiempo estimado"><Input aria-describedby={`${f("estimatedDuration")}-msg`} aria-invalid={invalid("estimatedDuration")} id={f("estimatedDuration")} placeholder="Ej. 2 horas" {...form.register("estimatedDuration")} /></Field>
        <Field error={errors.availableDate?.message} htmlFor={f("availableDate")} label="Disponible desde"><Input aria-describedby={`${f("availableDate")}-msg`} aria-invalid={invalid("availableDate")} id={f("availableDate")} type="datetime-local" {...form.register("availableDate")} /></Field>
        <Field error={errors.expiresAt?.message} htmlFor={f("expiresAt")} label="Cotización válida hasta"><Input aria-describedby={`${f("expiresAt")}-msg`} aria-invalid={invalid("expiresAt")} id={f("expiresAt")} type="datetime-local" {...form.register("expiresAt")} /></Field>
      </div>
      <Field error={errors.description?.message} htmlFor={f("description")} label="Descripción del trabajo"><Textarea aria-describedby={`${f("description")}-msg`} aria-invalid={invalid("description")} className="min-h-32" id={f("description")} placeholder="Explica el alcance del trabajo, pasos y cualquier detalle relevante." {...form.register("description")} /></Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field htmlFor={f("materialsIncluded")} label="Materiales incluidos"><Textarea className="min-h-20" id={f("materialsIncluded")} {...form.register("materialsIncluded")} /></Field>
        <Field htmlFor={f("materialsNotIncluded")} label="Materiales no incluidos"><Textarea className="min-h-20" id={f("materialsNotIncluded")} {...form.register("materialsNotIncluded")} /></Field>
      </div>
      <Field htmlFor={f("conditions")} label="Condiciones"><Textarea className="min-h-20" id={f("conditions")} placeholder="Ej. Forma de pago, garantía, etc." {...form.register("conditions")} /></Field>
      <CheckboxRow className="font-medium"><Checkbox {...form.register("diagnosticVisit")} />Requiere visita de diagnóstico previa</CheckboxRow>
      {feedback ? <Alert tone="danger">{feedback}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} loading={pending} type="submit"><Send aria-hidden="true" className="size-4" />Enviar cotización</Button>
        <Button disabled={pending} onClick={onSaveDraft} type="button" variant="outline"><Save aria-hidden="true" className="size-4" />Guardar borrador</Button>
      </div>
    </form>
  );
}

function localDate(value?: string): string { if (!value) return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
