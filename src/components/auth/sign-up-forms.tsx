"use client";
import Link from "next/link";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxRow, Field, Input } from "@/components/ui/field";
import { TextLink } from "@/components/ui/text-link";
import type { Category } from "@/domain/entities/category";
import { customerRegistrationInputSchema, technicianRegistrationInputSchema } from "@/integrations/auth/auth-provider";
import { AuthenticationService } from "@/services/auth/authentication-service";

const fields = [
  { name: "firstName", label: "Nombre", type: "text", auto: "given-name" },
  { name: "lastName", label: "Apellido", type: "text", auto: "family-name" },
  { name: "email", label: "Correo electrónico", type: "email", auto: "email" },
  { name: "phone", label: "Teléfono", type: "tel", auto: "tel" },
  { name: "password", label: "Contraseña", type: "password", auto: "new-password" },
  { name: "confirmPassword", label: "Repite la contraseña", type: "password", auto: "new-password" },
] as const;

const maxLengthFor = (name: string, type: string): number => (type === "password" ? 128 : name === "phone" ? 24 : name === "email" ? 254 : 60);

function RegistrationForm({ technician = false, categories = [] }: { technician?: boolean; categories?: readonly Category[] }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <Alert tone="success" title="Revisa tu correo">
        Si podemos completar el registro, recibirás un enlace para confirmar tu cuenta. Si ya tienes una cuenta, puedes ingresar o recuperar tu contraseña.
        <div className="mt-2"><TextLink href="/login">Ir a ingresar</TextLink></div>
      </Alert>
    );
  }

  return (
    <form className="space-y-5" noValidate onSubmit={async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const raw = { ...Object.fromEntries(data), acceptTerms: data.get("acceptTerms") === "on", categoryIds: data.getAll("categoryIds"), coverageAreas: String(data.get("city") ?? "") };
      const parsed = technician ? technicianRegistrationInputSchema.safeParse(raw) : customerRegistrationInputSchema.safeParse(raw);
      if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return; }
      setErrors({}); setMessage(""); setPending(true);
      try {
        const service = new AuthenticationService();
        if (technician) await service.registerTechnician(technicianRegistrationInputSchema.parse(raw)); else await service.registerCustomer(customerRegistrationInputSchema.parse(raw));
        setSent(true);
      } catch { setMessage("No pudimos completar la solicitud. Inténtalo más tarde."); }
      finally { setPending(false); }
    }}>
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => (
          <Field error={errors[field.name]} htmlFor={field.name} key={field.name} label={field.label}>
            <Input aria-describedby={`${field.name}-msg`} aria-invalid={errors[field.name] ? true : undefined} autoComplete={field.auto} id={field.name} inputMode={field.type === "tel" ? "tel" : field.type === "email" ? "email" : undefined} maxLength={maxLengthFor(field.name, field.type)} name={field.name} required type={field.type} />
          </Field>
        ))}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">Contraseña: al menos 12 caracteres, mayúscula, minúscula y número.</p>
      {technician ? (
        <>
          <Field error={errors.city} htmlFor="city" label="Comuna de cobertura">
            <Input aria-describedby="city-msg" aria-invalid={errors.city ? true : undefined} id="city" maxLength={80} name="city" required />
          </Field>
          <fieldset className="rounded-2xl border border-border p-4">
            <legend className="px-2 text-sm font-semibold">Especialidades</legend>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {categories.map((category) => <CheckboxRow key={category.id}><Checkbox name="categoryIds" value={category.id} />{category.name}</CheckboxRow>)}
            </div>
            {errors.categoryIds ? <p className="mt-2 text-sm text-destructive-soft-foreground" role="alert">{errors.categoryIds}</p> : null}
          </fieldset>
          <p className="text-sm leading-6 text-muted-foreground">Tu postulación quedará pendiente. Después de confirmar tu correo podrás completar tu perfil; se publicará solo tras una revisión administrativa.</p>
        </>
      ) : null}
      <CheckboxRow>
        <Checkbox aria-invalid={errors.acceptTerms ? true : undefined} name="acceptTerms" required />
        <span>Acepto los <Link className="font-semibold underline" href="/terminos">términos de uso</Link> y la <Link className="font-semibold underline" href="/privacidad">política de privacidad</Link>.</span>
      </CheckboxRow>
      {errors.acceptTerms ? <p className="text-sm text-destructive-soft-foreground" role="alert">{errors.acceptTerms}</p> : null}
      {message ? <Alert tone="danger">{message}</Alert> : null}
      <Button className="w-full" loading={pending} size="lg" type="submit">{technician ? "Enviar postulación" : "Crear cuenta"}</Button>
    </form>
  );
}

export function CustomerSignUpForm() { return <RegistrationForm />; }
export function TechnicianSignUpForm({ categories }: { categories: readonly Category[] }) { return <RegistrationForm technician categories={categories} />; }
