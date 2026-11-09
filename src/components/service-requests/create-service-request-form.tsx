"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { submitServiceRequest } from "@/app/solicitar/actions";
import { Button } from "@/components/ui/button";
import type { Category } from "@/domain/entities/category";
import { serviceRequestInputSchema, type ServiceRequestInput } from "@/domain/validation/service-request-input";

const control = "w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring";
export function CreateServiceRequestForm({ categories }: { readonly categories: readonly Category[] }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const form = useForm<ServiceRequestInput>({ resolver: zodResolver(serviceRequestInputSchema),
    defaultValues: { title: "", categoryId: "", description: "", locationLabel: "", priority: "standard", scheduledFor: "", address: "", reference: "", preferredSlot: "", complementaryInfo: "" } });
  useEffect(() => { form.setValue("operationId", crypto.randomUUID()); }, [form]);
  async function onSubmit(input: ServiceRequestInput) {
    setFeedback(null);
    const result = await submitServiceRequest(input);
    if (!result.ok) {
      if (result.message === "unauthenticated") { router.push("/login?continuar=%2Fsolicitar"); return; }
      setFeedback(result.message ?? "No pudimos registrar tu solicitud."); return;
    }
    setFeedback("success"); form.reset(); form.setValue("operationId", crypto.randomUUID()); router.refresh();
  }
  if (feedback === "success") return <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950"><CheckCircle2 className="size-6" /><h2 className="mt-3 text-lg font-bold">Solicitud registrada</h2><p className="mt-2 text-sm">Puedes seguirla desde tu panel y comparar las propuestas de técnicos habilitados.</p><div className="mt-5 flex flex-wrap gap-3"><Button onClick={() => router.push("/cliente")}>Ver mis solicitudes</Button><Button onClick={() => setFeedback(null)} type="button" variant="outline">Crear otra solicitud</Button></div></div>;
  return <form className="space-y-5" noValidate onSubmit={form.handleSubmit(onSubmit)}>
    <label className="block space-y-2"><span>¿Qué necesitas resolver?</span><input className={control} {...form.register("title")} /><FieldError message={form.formState.errors.title?.message} /></label>
    <div className="grid gap-5 sm:grid-cols-2"><label className="block space-y-2"><span>Rubro</span><select aria-label="Rubro" className={control} {...form.register("categoryId")}><option value="">Selecciona un rubro</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><FieldError message={form.formState.errors.categoryId?.message} /></label>
    <label className="block space-y-2"><span>Comuna</span><input className={control} placeholder="Ej. Ñuñoa" {...form.register("locationLabel")} /><FieldError message={form.formState.errors.locationLabel?.message} /></label></div>
    <label className="block space-y-2"><span>Detalles del problema</span><textarea className={control + " min-h-32"} placeholder="Describe el problema sin publicar dirección exacta, teléfono ni datos personales." {...form.register("description")} /><FieldError message={form.formState.errors.description?.message} /></label>
    <div className="grid gap-5 sm:grid-cols-2"><label className="block space-y-2"><span>Fecha preferida (opcional)</span><input type="datetime-local" className={control} {...form.register("scheduledFor")} /><FieldError message={form.formState.errors.scheduledFor?.message} /></label>
    <label className="block space-y-2"><span>Horario preferido (opcional)</span><input className={control} placeholder="Ej. 10 a 13 horas" {...form.register("preferredSlot")} /><FieldError message={form.formState.errors.preferredSlot?.message} /></label>
    <label className="block space-y-2"><span>Dirección privada (opcional)</span><input className={control} autoComplete="street-address" {...form.register("address")} /><FieldError message={form.formState.errors.address?.message} /></label>
    <label className="block space-y-2"><span>Referencia privada (opcional)</span><input className={control} {...form.register("reference")} /><FieldError message={form.formState.errors.reference?.message} /></label></div>
    <label className="block space-y-2"><span>Información privada adicional (opcional)</span><textarea className={control} {...form.register("complementaryInfo")} /><FieldError message={form.formState.errors.complementaryInfo?.message} /></label>
    <p className="text-xs text-muted-foreground">Prioridad normal. La dirección y referencias solo están disponibles para ti, administración y el técnico adjudicado mientras conserve su habilitación.</p>
    {feedback ? <p role="alert" className="text-sm text-destructive">{feedback}</p> : null}
    <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">{form.formState.isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}Registrar solicitud</Button>
  </form>;
}
function FieldError({ message }: { readonly message?: string }) { return message ? <span role="alert" className="text-sm text-destructive">{message}</span> : null; }
