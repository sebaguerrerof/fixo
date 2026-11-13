"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LoaderCircle, Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Quote } from "@/domain/entities/quote";
import { useForm } from "react-hook-form";

import { createAndSubmitQuote, saveQuoteDraft } from "@/app/tecnico/oportunidades/[id]/cotizar/actions";
import { Button } from "@/components/ui/button";
import { quoteInputSchema, type QuoteInput, type QuoteFormInput } from "@/domain/validation/quote-input";

export function CreateQuoteForm({ serviceRequestId, draft }: { readonly serviceRequestId: string; readonly draft?: Quote }) {
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
    return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950"><CheckCircle2 className="size-6" /><h2 className="mt-3 text-lg font-bold">Cotización enviada</h2><p className="mt-2 text-sm leading-6">El cliente ya puede revisar tu propuesta y compararla con otras.</p><Button className="mt-5" onClick={() => router.push("/tecnico/oportunidades")} type="button" variant="outline">Volver a oportunidades</Button></div>;
  }

  if (feedback === "draft") {
    return <div role="status" className="rounded-2xl border border-sky-200 bg-sky-50 p-6 text-sky-950"><CheckCircle2 className="size-6" /><h2 className="mt-3 text-lg font-bold">Borrador guardado</h2><p className="mt-2 text-sm">Todavía no es visible para el cliente.</p><Button className="mt-5" onClick={() => setFeedback(null)} type="button" variant="outline">Continuar editando</Button></div>;
  }

  return <form className="space-y-5" noValidate onSubmit={form.handleSubmit(onSubmit)}>
    <input type="hidden" {...form.register("serviceRequestId")} />
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block space-y-2"><span className="text-sm font-semibold">Mano de obra (CLP)</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="number" step="1" min="0" {...form.register("laborClp")} /><FieldError message={form.formState.errors.laborClp?.message} /></label>
      <label className="block space-y-2"><span className="text-sm font-semibold">Materiales (CLP)</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm" type="number" step="1" min="0" {...form.register("materialsClp")} /><FieldError message={form.formState.errors.materialsClp?.message} /></label>
      <label className="block space-y-2"><span className="text-sm font-semibold">Diagnóstico (CLP)</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm" type="number" step="1" min="0" {...form.register("diagnosticClp")} /><FieldError message={form.formState.errors.diagnosticClp?.message} /></label>
      <p className="py-3 font-bold">Total: {Number(form.watch("priceClp") || 0).toLocaleString("es-CL")} CLP<FieldError message={form.formState.errors.priceClp?.message} /></p>
      <label className="block space-y-2"><span className="text-sm font-semibold">Tiempo estimado</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Ej. 2 horas" {...form.register("estimatedDuration")} /><FieldError message={form.formState.errors.estimatedDuration?.message} /></label>
      <label className="block space-y-2"><span className="text-sm font-semibold">Disponible desde</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="datetime-local" {...form.register("availableDate")} /><FieldError message={form.formState.errors.availableDate?.message} /></label>
      <label className="block space-y-2"><span className="text-sm font-semibold">Cotización válida hasta</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="datetime-local" {...form.register("expiresAt")} /><FieldError message={form.formState.errors.expiresAt?.message} /></label>
    </div>
    <label className="block space-y-2"><span className="text-sm font-semibold">Descripción del trabajo</span><textarea className="min-h-32 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Explica el alcance del trabajo, pasos y cualquier detalle relevante." {...form.register("description")} /><FieldError message={form.formState.errors.description?.message} /></label>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block space-y-2"><span className="text-sm font-semibold">Materiales incluidos</span><textarea className="min-h-20 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register("materialsIncluded")} /></label>
      <label className="block space-y-2"><span className="text-sm font-semibold">Materiales no incluidos</span><textarea className="min-h-20 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register("materialsNotIncluded")} /></label>
    </div>
    <label className="block space-y-2"><span className="text-sm font-semibold">Condiciones</span><textarea className="min-h-20 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Ej. Forma de pago, garantía, etc." {...form.register("conditions")} /></label>
    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" {...form.register("diagnosticVisit")} />Requiere visita de diagnóstico previa</label>
    {feedback ? <p role="alert" className="text-sm text-destructive">{feedback}</p> : null}
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending} type="submit">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}Enviar cotización</Button>
      <Button disabled={pending} onClick={onSaveDraft} type="button" variant="outline"><Save className="size-4" />Guardar borrador</Button>
    </div>
  </form>;
}

function localDate(value?: string): string { if (!value) return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }

function FieldError({ message }: { readonly message?: string }) {
  return message ? <span className="text-sm text-destructive">{message}</span> : null;
}
