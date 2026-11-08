"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { submitServiceRequest } from "@/app/solicitar/actions";
import { Button } from "@/components/ui/button";
import type { Category } from "@/domain/entities/category";
import { serviceRequestInputSchema, type ServiceRequestInput } from "@/domain/validation/service-request-input";

export function CreateServiceRequestForm({ categories }: { readonly categories: readonly Category[] }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const form = useForm<ServiceRequestInput>({
    resolver: zodResolver(serviceRequestInputSchema),
    defaultValues: { title: "", categoryId: "", description: "", locationLabel: "", priority: "standard", scheduledFor: "" },
  });

  async function onSubmit(input: ServiceRequestInput): Promise<void> {
    setFeedback(null);
    const result = await submitServiceRequest(input);

    if (!result.ok) {
      if (result.message === "unauthenticated") {
        router.push("/login?continuar=%2Fsolicitar");
        return;
      }
      setFeedback(result.message ?? "No pudimos registrar tu solicitud.");
      return;
    }

    setFeedback("success");
    form.reset();
  }

  if (feedback === "success") {
    return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950"><CheckCircle2 className="size-6" /><h2 className="mt-3 text-lg font-bold">Solicitud enviada</h2><p className="mt-2 text-sm leading-6">Tu requerimiento quedó registrado y comenzará el proceso de búsqueda de técnicos disponibles.</p><Button className="mt-5" onClick={() => setFeedback(null)} type="button" variant="outline">Crear otra solicitud</Button></div>;
  }

  return <form className="space-y-5" noValidate onSubmit={form.handleSubmit(onSubmit)}><div className="grid gap-5 sm:grid-cols-2"><label className="block space-y-2 sm:col-span-2"><span className="text-sm font-semibold">¿Qué necesitas resolver?</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Ej. Fuga bajo el lavaplatos" {...form.register("title")} /><FieldError message={form.formState.errors.title?.message} /></label><label className="block space-y-2"><span className="text-sm font-semibold">Rubro</span><select className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register("categoryId")}><option value="">Selecciona un rubro</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><FieldError message={form.formState.errors.categoryId?.message} /></label><label className="block space-y-2"><span className="text-sm font-semibold">Ubicación</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Ej. Providencia" {...form.register("locationLabel")} /><FieldError message={form.formState.errors.locationLabel?.message} /></label></div><label className="block space-y-2"><span className="text-sm font-semibold">Detalles</span><textarea className="min-h-32 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Explica el problema, desde cuándo ocurre y cualquier detalle útil." {...form.register("description")} /><FieldError message={form.formState.errors.description?.message} /></label><div className="grid gap-5 sm:grid-cols-2"><label className="block space-y-2"><span className="text-sm font-semibold">Prioridad</span><select className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register("priority")}><option value="standard">Normal</option><option value="urgent">Urgente</option></select></label><label className="block space-y-2"><span className="text-sm font-semibold">Fecha preferida (opcional)</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="datetime-local" {...form.register("scheduledFor")} /></label></div>{feedback ? <p aria-live="polite" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{feedback}</p> : null}<Button className="h-12 w-full rounded-xl" disabled={form.formState.isSubmitting} size="lg" type="submit">{form.formState.isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <><Send className="size-4" />Enviar solicitud</>}</Button></form>;
}

function FieldError({ message }: { readonly message?: string }) {
  return message ? <span className="text-sm text-destructive">{message}</span> : null;
}
