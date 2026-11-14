"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconInput } from "@/components/ui/icon-input";
import { TextLink } from "@/components/ui/text-link";
import { isDemoModeEnabled } from "@/config/demo-mode";
import { safeContinuation } from "@/domain/auth/account";
import { signInInputSchema, dashboardForRole, type SignInInput } from "@/integrations/auth/auth-provider";
import { DEMO_ACCOUNTS } from "@/repositories/mock/fixtures/demo-accounts";
import { AuthenticationService } from "@/services/auth/authentication-service";

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
  const errors = form.formState.errors;

  async function enterWithSession(session: Awaited<ReturnType<AuthenticationService["signIn"]>>): Promise<void> {
    const continuation = searchParams.get("continuar");
    router.replace(safeContinuation(continuation, dashboardForRole(session.user.role)));
    router.refresh();
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
      <Field error={errors.email?.message} htmlFor="email" label="Correo electrónico">
        <IconInput aria-describedby="email-msg" aria-invalid={errors.email ? true : undefined} autoComplete="email" icon={Mail} id="email" inputMode="email" placeholder="tu@correo.cl" type="email" {...form.register("email")} />
      </Field>
      <Field error={errors.password?.message} htmlFor="password" label="Contraseña">
        <IconInput
          aria-describedby="password-msg"
          aria-invalid={errors.password ? true : undefined}
          autoComplete="current-password"
          icon={LockKeyhole}
          id="password"
          placeholder="Tu contraseña"
          trailing={<Button aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)} size="icon" type="button" variant="ghost">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>}
          type={showPassword ? "text" : "password"}
          {...form.register("password")}
        />
      </Field>
      {submitError ? <Alert tone="danger">{submitError}</Alert> : null}
      {searchParams.get("password") === "updated" ? <Alert tone="success">Contraseña actualizada. Ingresa con tu nueva contraseña.</Alert> : null}
      <TextLink href="/recuperar-contrasena">Olvidé mi contraseña</TextLink>
      <Button className="w-full" loading={form.formState.isSubmitting} size="lg" type="submit">Ingresar <ArrowRight aria-hidden="true" className="size-4" /></Button>
      {isDemoModeEnabled() ? (
        <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-secondary-foreground"><Sparkles aria-hidden="true" className="size-4" />Modo demo activo</p>
          <p className="mt-1 text-sm text-muted-foreground">Entra directo con una cuenta de ejemplo, sin contraseña real.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button key={account.email} onClick={() => void signInWithDemoAccount(account.email)} size="sm" type="button" variant="outline">
                {demoAccountLabels[account.role]} · {account.name.split(" ").at(0)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  );
}
