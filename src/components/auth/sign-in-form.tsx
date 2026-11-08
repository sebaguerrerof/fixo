"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";

import { isDemoModeEnabled } from "@/config/demo-mode";
import { signInInputSchema, dashboardForRole, type SignInInput } from "@/integrations/auth/auth-provider";
import { DEMO_ACCOUNTS } from "@/repositories/mock/fixtures/demo-accounts";
import { AuthenticationService } from "@/services/auth/authentication-service";
import { Button } from "@/components/ui/button";

const demoAccountLabels: Record<string, string> = { customer: "Cliente", technician: "Técnico", moderator: "Admin", superadmin: "Admin" };

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInInputSchema),
    defaultValues: { email: "", password: "" },
  });

  async function enterWithSession(session: Awaited<ReturnType<AuthenticationService["signIn"]>>): Promise<void> {
    const continuation = searchParams.get("continuar");
    router.replace(continuation?.startsWith("/") ? continuation : dashboardForRole(session.user.role));
  }

  async function signInWithDemoAccount(email: string): Promise<void> {
    setSubmitError(null);
    try {
      const session = await new AuthenticationService().signIn({ email, password: "demo-mode" });
      await enterWithSession(session);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No pudimos iniciar sesión. Intenta nuevamente.");
    }
  }

  async function onSubmit(input: SignInInput): Promise<void> {
    setSubmitError(null);
    try {
      const session = await new AuthenticationService().signIn(input);
      await enterWithSession(session);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No pudimos iniciar sesión. Intenta nuevamente.");
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <label className="block space-y-2"><span className="text-sm font-semibold">Correo electrónico</span><span className="flex h-12 items-center gap-3 rounded-xl border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring"><Mail className="size-4 text-muted-foreground" /><input autoComplete="email" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="tu@correo.cl" type="email" {...form.register("email")} /></span>{form.formState.errors.email ? <span className="text-sm text-destructive">{form.formState.errors.email.message}</span> : null}</label>
      <label className="block space-y-2"><span className="text-sm font-semibold">Contraseña</span><span className="flex h-12 items-center gap-3 rounded-xl border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring"><LockKeyhole className="size-4 text-muted-foreground" /><input autoComplete="current-password" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Tu contraseña" type={showPassword ? "text" : "password"} {...form.register("password")} /><button aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" onClick={() => setShowPassword((current) => !current)} type="button">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span>{form.formState.errors.password ? <span className="text-sm text-destructive">{form.formState.errors.password.message}</span> : null}</label>
      {submitError ? <p aria-live="polite" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{submitError}</p> : null}
      <Button className="h-12 w-full rounded-xl" disabled={form.formState.isSubmitting} size="lg" type="submit">{form.formState.isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <>Ingresar <ArrowRight className="size-4" /></>}</Button>
      {isDemoModeEnabled() ? (
        <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-primary"><Sparkles className="size-4" />Modo demo activo</p>
          <p className="mt-1 text-sm text-muted-foreground">Entra directo con una cuenta de ejemplo, sin contraseña real.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                className="rounded-lg border border-primary/30 bg-background px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
                key={account.email}
                onClick={() => void signInWithDemoAccount(account.email)}
                type="button"
              >
                {demoAccountLabels[account.role]} · {account.name.split(" ").at(0)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  );
}
