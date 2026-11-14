import { LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

import { SignInForm } from "@/components/auth/sign-in-form";
import { Logo } from "@/components/shared/logo";
import { Badge } from "@/components/ui/badge";
import { TextLink } from "@/components/ui/text-link";
import { brand } from "@/design-system/brand";

export const metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-inverse p-3 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-3xl bg-background shadow-lift sm:min-h-[calc(100vh-3rem)] lg:grid-cols-[0.9fr_1.1fr]">
        <section className="login-showcase relative hidden overflow-hidden p-10 text-inverse-foreground lg:block">
          <div className="surface-grid absolute inset-0 opacity-20" />
          <div className="relative flex h-full flex-col">
            <Logo inverse />
            <div className="my-auto">
              <Badge className="border-primary/30 bg-primary/10 text-inverse-accent" variant="outline"><Sparkles aria-hidden="true" className="mr-1 size-3.5" />Una experiencia más clara</Badge>
              <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight">Tu trabajo y tu hogar, siempre bajo control.</h1>
              <p className="mt-5 max-w-sm leading-7 text-inverse-muted">Accede a tus solicitudes, oportunidades y herramientas según tu rol.</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-inverse-muted"><span className="flex size-9 items-center justify-center rounded-xl bg-inverse-foreground/10"><ShieldCheck aria-hidden="true" className="size-4 text-inverse-accent" /></span><span>Información y accesos protegidos por rol.</span></div>
          </div>
        </section>
        <section className="relative flex p-5 sm:p-10 lg:p-14">
          <div className="mx-auto flex w-full max-w-md flex-col">
            <div className="flex items-center justify-between lg:hidden"><Logo /><TextLink href="/">Volver al inicio</TextLink></div>
            <div className="mt-8 lg:mt-6">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-secondary-foreground"><LockKeyhole aria-hidden="true" className="size-6" /></span>
              <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-primary">Acceso seguro</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight lg:hidden">Bienvenido de vuelta</h1>
              <h2 className="mt-2 hidden text-3xl font-semibold tracking-tight lg:block">Bienvenido de vuelta</h2>
              <p className="mt-3 leading-7 text-muted-foreground">Ingresa para continuar con tu espacio de trabajo.</p>
            </div>
            <div className="mt-8"><SignInForm /></div>
            <div className="mt-8 rounded-2xl border border-border/70 bg-muted/50 p-4 text-sm">
              <p className="font-semibold">¿Primera vez en {brand.name}?</p>
              <div className="mt-1 flex flex-wrap gap-x-5"><TextLink href="/registro">Crear cuenta cliente</TextLink><TextLink href="/registro/tecnico">Postular como técnico</TextLink></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
