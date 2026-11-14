import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { PendingSubmit } from "@/components/auth/pending-submit";
import { Alert } from "@/components/ui/alert";
import { Checkbox, CheckboxRow, Field, Input } from "@/components/ui/field";
import { TextLink } from "@/components/ui/text-link";
import { checkPasswordFlow } from "@/services/auth/auth-flow-service";
import { updatePassword } from "./actions";

export const dynamic = "force-dynamic";

const identityFields = [["firstName", "Nombre"], ["lastName", "Apellido"], ["phone", "Teléfono"]] as const;
const passwordFields = [["password", "Nueva contraseña"], ["confirmPassword", "Repite la contraseña"]] as const;

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  let kind: "invite" | "recovery" | null = null;
  try { kind = await checkPasswordFlow(); } catch { /* fail closed */ }
  const { error } = await searchParams;
  return (
    <AuthCard title={kind === "invite" ? "Completa tu cuenta" : "Define tu nueva contraseña"} description="Usa al menos 12 caracteres, una mayúscula, una minúscula y un número.">
      {kind ? (
        <form action={updatePassword} className="space-y-5">
          {kind === "invite" ? (
            <>
              <p className="text-sm text-muted-foreground">La aprobación profesional de técnicos se revisa por separado.</p>
              {identityFields.map(([name, label]) => (
                <Field htmlFor={name} key={name} label={label}><Input autoComplete={name === "firstName" ? "given-name" : name === "lastName" ? "family-name" : "tel"} id={name} maxLength={name === "phone" ? 24 : 60} name={name} required /></Field>
              ))}
              <CheckboxRow><Checkbox name="acceptTerms" required /><span>Acepto los <Link className="underline" href="/terminos">términos</Link> y la <Link className="underline" href="/privacidad">privacidad</Link>.</span></CheckboxRow>
            </>
          ) : null}
          {passwordFields.map(([name, label]) => (
            <Field htmlFor={name} key={name} label={label}>
              <Input autoComplete="new-password" id={name} maxLength={128} minLength={12} name={name} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,128}" required title="Al menos 12 caracteres, mayúscula, minúscula y número" type="password" />
            </Field>
          ))}
          {error ? <Alert tone="danger">No pudimos completar el cambio. Revisa los datos o solicita un nuevo enlace.</Alert> : null}
          <PendingSubmit label="Guardar contraseña y cerrar sesiones" />
        </form>
      ) : (
        <Alert tone="warning">El enlace no está disponible o ya expiró. <TextLink className="underline" href="/recuperar-contrasena">Solicita uno nuevo</TextLink>. Si recibiste una invitación, pide a administración que la reenvíe.</Alert>
      )}
    </AuthCard>
  );
}
