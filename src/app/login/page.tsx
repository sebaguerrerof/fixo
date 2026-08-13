import { BadgeCheck, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { SignInForm } from "@/components/auth/sign-in-form";
import { Logo } from "@/components/shared/logo";
import { Badge } from "@/components/ui/badge";

const sampleAccounts = [
  { role: "Cliente", email: "cliente@fixo.cl" },
  { role: "Técnico", email: "tecnico@fixo.cl" },
  { role: "Administración", email: "admin@fixo.cl" },
];

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-4 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-3xl bg-background shadow-[0_32px_100px_-32px_rgba(15,23,42,0.7)] lg:grid-cols-[0.9fr_1.1fr]">
        <section className="login-showcase relative hidden overflow-hidden p-10 text-white lg:block">
          <div className="absolute inset-0 surface-grid opacity-20" />
          <div className="relative flex h-full flex-col">
            <Logo inverse />
            <div className="my-auto">
              <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100" variant="outline"><Sparkles className="mr-1 size-3.5" />Una experiencia más clara</Badge>
              <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight">Tu trabajo y tu hogar, siempre bajo control.</h1>
              <p className="mt-5 max-w-sm leading-7 text-slate-300">Accede a tus solicitudes, oportunidades y herramientas según tu rol.</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300"><span className="flex size-9 items-center justify-center rounded-xl bg-white/10"><ShieldCheck className="size-4 text-cyan-200" /></span><span>Información y accesos protegidos por rol.</span></div>
          </div>
        </section>
        <section className="relative flex p-6 sm:p-10 lg:p-14">
          <div className="mx-auto flex w-full max-w-md flex-col">
            <div className="flex items-center justify-between lg:hidden"><Logo /><Link className="text-sm font-semibold text-primary hover:underline" href="/">Volver al inicio</Link></div>
            <div className="mt-14 lg:mt-6"><span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole className="size-6" /></span><p className="mt-6 text-sm font-semibold text-primary">Acceso seguro</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Bienvenido de vuelta</h2><p className="mt-3 leading-7 text-muted-foreground">Ingresa para continuar con tu espacio de trabajo.</p></div>
            <div className="mt-8"><SignInForm /></div>
            <div className="mt-8 rounded-2xl border border-border/70 bg-muted/45 p-4"><div className="flex items-center gap-2"><BadgeCheck className="size-4 text-primary" /><p className="text-sm font-bold">Cuentas de ejemplo</p></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Usa la clave <code className="rounded bg-background px-1.5 py-0.5 font-semibold text-foreground">fixo2026</code> con cualquiera de estos accesos:</p><div className="mt-3 space-y-2">{sampleAccounts.map((account) => <div key={account.email} className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-xs"><span className="font-semibold">{account.role}</span><code className="truncate text-muted-foreground">{account.email}</code></div>)}</div></div>
            <p className="mt-auto pt-8 text-center text-xs leading-5 text-muted-foreground">Al continuar, aceptas que este entorno utiliza información de ejemplo para explorar la plataforma.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
