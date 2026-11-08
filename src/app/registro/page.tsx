import { UserRound } from "lucide-react";
import Link from "next/link";

import { CustomerSignUpForm } from "@/components/auth/sign-up-forms";
import { Logo } from "@/components/shared/logo";

export default function CustomerRegistrationPage() {
  return <main className="min-h-screen bg-muted/45 p-4 sm:p-8"><div className="mx-auto w-full max-w-xl"><div className="flex items-center justify-between"><Logo /><Link className="text-sm font-semibold text-primary hover:underline" href="/login">Ya tengo cuenta</Link></div><section className="mt-10 rounded-3xl border bg-background p-6 shadow-lift sm:p-10"><span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UserRound className="size-6" /></span><p className="mt-6 text-sm font-semibold text-primary">Cuenta cliente</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Resuelve lo que necesitas</h1><p className="mt-3 leading-7 text-muted-foreground">Crea tu cuenta para solicitar servicios, comparar alternativas y seguir cada trabajo.</p><div className="mt-8"><CustomerSignUpForm /></div><p className="mt-7 text-center text-sm text-muted-foreground">¿Eres técnico? <Link className="font-semibold text-primary hover:underline" href="/registro/tecnico">Postula como técnico</Link></p></section></div></main>;
}
