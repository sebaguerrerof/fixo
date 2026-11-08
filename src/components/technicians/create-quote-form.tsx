"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LoaderCircle, Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { createAndSubmitQuote, saveQuoteDraft } from "@/app/tecnico/oportunidades/[id]/cotizar/actions";
import { Button } from "@/components/ui/button";
import { quoteInputSchema, type QuoteInput, type QuoteFormInput } from "@/domain/validation/quote-input";

export function CreateQuoteForm({ serviceRequestId }: { readonly serviceRequestId: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<"success" | "draft" | string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<QuoteFormInput, unknown, QuoteInput>({
    resolver: zodResolver(quoteInputSchema),
    defaultValues: {
      serviceRequestId,
      priceClp: 0,
      description: "",
      materialsIncluded: "",
      materialsNotIncluded: "",
      diagnosticVisit: false,
      estimatedDuration: "",
      availableDate: "",
      conditions: "",
      expiresAt: "",
    },
  });

  async function onSubmit(input: QuoteInput): Promise<void> {
    setFeedback(null);
    setPending(true);
    const result = await createAndSubmitQuote(input);
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
    const result = await saveQuoteDraft(parsed.data);
    setPending(false);

    if (!result.ok) {
      if (result.message === "unauthenticated") {
        router.push("/login");
        return;
      }
      setFeedback(result.message ?? "No pudimos guardar el borrador.");
      return;
    }
    setFeedback("draft");
  }

  if (feedback === "success") {
    return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950"><CheckCircle2 className="size-6" /><h2 className="mt-3 text-lg font-bold">Cotización enviada</h2><p className="mt-2 text-sm leading-6">El cliente ya puede revisar tu propuesta y compararla con otras.</p><Button className="mt-5" onClick={() => router.push("/tecnico/oportunidades")} type="button" variant="outline">Volver a oportunidades</Button></div>;
  }

  if (feedback === "draft") {
    return <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 text-sky-950"><CheckCircle2 className="size-6" /><h2 className="mt-3 text-lg font-bold">Borrador guardado</h2><p className="mt-2 text-sm leading-6">Puedes retomarlo más tarde antes de enviarlo al cliente.</p><Button className="mt-5" onClick={() => router.push("/tecnico/oportunidades")} type="button" variant="outline">Volver a oportunidades</Button></div>;
  }

  return <form className="space-y-5" noValidate onSubmit={form.handleSubmit(onSubmit)}>
    <input type="hidden" {...form.register("serviceRequestId")} />
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block space-y-2"><span className="text-sm font-semibold">Precio (CLP)</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="number" {...form.register("priceClp")} /><FieldError message={form.formState.errors.priceClp?.message} /></label>
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
    {feedback ? <p className="text-sm text-destructive">{feedback}</p> : null}
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending} type="submit">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}Enviar cotización</Button>
      <Button disabled={pending} onClick={onSaveDraft} type="button" variant="outline"><Save className="size-4" />Guardar borrador</Button>
    </div>
  </form>;
}

function FieldError({ message }: { readonly message?: string }) {
  return message ? <span className="text-sm text-destructive">{message}</span> : null;
}
