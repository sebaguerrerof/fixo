"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import type { Category } from "@/domain/entities/category";
import { customerRegistrationInputSchema, dashboardForRole, technicianRegistrationInputSchema, type CustomerRegistrationInput, type TechnicianRegistrationInput } from "@/integrations/auth/auth-provider";
import { AuthenticationService } from "@/services/auth/authentication-service";

function FieldError({ message }: { readonly message?: string }) {
  return message ? <span className="text-sm text-destructive">{message}</span> : null;
}

function ConfirmationNotice({ technician }: { readonly technician: boolean }) {
  return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"><CheckCircle2 className="size-5" /><h2 className="mt-3 font-bold">Revisa tu correo para confirmar tu cuenta</h2><p className="mt-2 text-sm leading-6">{technician ? "Tu postulación quedó registrada. Una vez que confirmes tu correo, el equipo de administración podrá revisar tus antecedentes." : "Te enviamos un enlace de confirmación. Cuando lo abras, podrás ingresar a tu espacio de cliente."}</p><Link className="mt-4 inline-flex text-sm font-semibold underline" href="/login">Ir a ingresar</Link></div>;
}

export function CustomerSignUpForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<CustomerRegistrationInput>({ resolver: zodResolver(customerRegistrationInputSchema), defaultValues: { fullName: "", email: "", password: "" } });

  async function onSubmit(input: CustomerRegistrationInput): Promise<void> {
    setMessage(null);
    try {
      const result = await new AuthenticationService().registerCustomer(input);
      if (result.session) {
        router.replace(dashboardForRole(result.session.user.role));
        return;
      }
      setMessage("confirmation");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos crear tu cuenta.");
    }
  }

  if (message === "confirmation") return <ConfirmationNotice technician={false} />;

  return <form className="space-y-5" noValidate onSubmit={form.handleSubmit(onSubmit)}><label className="block space-y-2"><span className="text-sm font-semibold">Nombre completo</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Tu nombre" {...form.register("fullName")} /><FieldError message={form.formState.errors.fullName?.message} /></label><label className="block space-y-2"><span className="text-sm font-semibold">Correo electrónico</span><input autoComplete="email" className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="tu@correo.cl" type="email" {...form.register("email")} /><FieldError message={form.formState.errors.email?.message} /></label><label className="block space-y-2"><span className="text-sm font-semibold">Contraseña</span><input autoComplete="new-password" className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Mínimo 8 caracteres" type="password" {...form.register("password")} /><FieldError message={form.formState.errors.password?.message} /></label>{message ? <p aria-live="polite" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{message}</p> : null}<Button className="h-12 w-full rounded-xl" disabled={form.formState.isSubmitting} size="lg" type="submit">{form.formState.isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <>Crear mi cuenta <ArrowRight className="size-4" /></>}</Button></form>;
}

export function TechnicianSignUpForm({ categories }: { readonly categories: readonly Category[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<TechnicianRegistrationInput>({
    resolver: zodResolver(technicianRegistrationInputSchema),
    defaultValues: { fullName: "", email: "", password: "", city: "", coverageAreas: "", headline: "", bio: "", categoryIds: [], specialties: "", yearsOfExperience: 0, emergencyEnabled: false, startingPriceClp: 0 },
  });

  async function onSubmit(input: TechnicianRegistrationInput): Promise<void> {
    setMessage(null);
    try {
      const result = await new AuthenticationService().registerTechnician(input);
      if (result.session) {
        router.replace(dashboardForRole(result.session.user.role));
        return;
      }
      setMessage("confirmation");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos enviar tu postulación.");
    }
  }

  if (message === "confirmation") return <ConfirmationNotice technician />;

  return <form className="space-y-6" noValidate onSubmit={form.handleSubmit(onSubmit)}><div className="grid gap-5 sm:grid-cols-2"><label className="block space-y-2"><span className="text-sm font-semibold">Nombre completo</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" {...form.register("fullName")} /><FieldError message={form.formState.errors.fullName?.message} /></label><label className="block space-y-2"><span className="text-sm font-semibold">Correo electrónico</span><input autoComplete="email" className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="email" {...form.register("email")} /><FieldError message={form.formState.errors.email?.message} /></label><label className="block space-y-2"><span className="text-sm font-semibold">Contraseña</span><input autoComplete="new-password" className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" type="password" {...form.register("password")} /><FieldError message={form.formState.errors.password?.message} /></label><label className="block space-y-2"><span className="text-sm font-semibold">Comuna o ciudad base</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Ej. Ñuñoa" {...form.register("city")} /><FieldError message={form.formState.errors.city?.message} /></label></div><div className="rounded-2xl border bg-muted/35 p-4"><p className="font-semibold">Tu especialidad</p><p className="mt-1 text-sm text-muted-foreground">Selecciona los rubros en los que quieres recibir solicitudes.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{categories.map((category) => <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-background px-3 py-3 text-sm font-medium" key={category.id}><input className="size-4 accent-primary" type="checkbox" value={category.id} {...form.register("categoryIds")} />{category.name}</label>)}</div><FieldError message={form.formState.errors.categoryIds?.message} /></div><label className="block space-y-2"><span className="text-sm font-semibold">Titular profesional</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Ej. Gasfíter certificado, respuesta el mismo día" {...form.register("headline")} /><FieldError message={form.formState.errors.headline?.message} /></label><label className="block space-y-2"><span className="text-sm font-semibold">Experiencia y servicios</span><textarea className="min-h-28 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Describe tu experiencia, certificaciones y cómo trabajas." {...form.register("bio")} /><FieldError message={form.formState.errors.bio?.message} /></label><div className="grid gap-5 sm:grid-cols-2"><label className="block space-y-2"><span className="text-sm font-semibold">Zonas de cobertura</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Ñuñoa, Providencia, La Reina" {...form.register("coverageAreas")} /><FieldError message={form.formState.errors.coverageAreas?.message} /></label><label className="block space-y-2"><span className="text-sm font-semibold">Especialidades</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Tableros, iluminación, urgencias" {...form.register("specialties")} /><FieldError message={form.formState.errors.specialties?.message} /></label><label className="block space-y-2"><span className="text-sm font-semibold">Años de experiencia</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" min="0" type="number" {...form.register("yearsOfExperience")} /><FieldError message={form.formState.errors.yearsOfExperience?.message} /></label><label className="block space-y-2"><span className="text-sm font-semibold">Desde (CLP)</span><input className="h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" min="0" type="number" {...form.register("startingPriceClp")} /><FieldError message={form.formState.errors.startingPriceClp?.message} /></label></div><label className="flex items-start gap-3 rounded-xl border bg-background p-4 text-sm"><input className="mt-0.5 size-4 accent-primary" type="checkbox" {...form.register("emergencyEnabled")} /><span><strong>Disponible para urgencias</strong><br /><span className="text-muted-foreground">Podrás recibir solicitudes marcadas como urgentes cuando tu perfil sea activado.</span></span></label>{message ? <p aria-live="polite" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{message}</p> : null}<Button className="h-12 w-full rounded-xl" disabled={form.formState.isSubmitting} size="lg" type="submit">{form.formState.isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <><Wrench className="size-4" />Enviar para validación <ArrowRight className="size-4" /></>}</Button><p className="flex items-center justify-center gap-2 text-center text-xs leading-5 text-muted-foreground"><ShieldCheck className="size-4 text-primary" />El perfil no será visible públicamente hasta que sea aprobado.</p></form>;
}
