import { CustomerSignUpForm } from "@/components/auth/sign-up-forms";
import { Logo } from "@/components/shared/logo";
import { TextLink } from "@/components/ui/text-link";

export const metadata = { title: "Crear cuenta" };

export default function CustomerRegistrationPage() {
  return (
    <main className="min-h-screen bg-muted/50 p-3 sm:p-8">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-center justify-between"><Logo /><TextLink href="/login">Ya tengo cuenta</TextLink></div>
        <section className="mt-6 rounded-3xl border border-border bg-background p-5 shadow-lift sm:mt-10 sm:p-10">
          <h1 className="text-balance text-4xl leading-tight">Crea tu cuenta de cliente</h1>
          <p className="mt-3 leading-7 text-muted-foreground">Solicita servicios, compara alternativas y sigue cada trabajo desde un solo lugar.</p>
          <div className="mt-8"><CustomerSignUpForm /></div>
          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-2 text-center text-sm text-muted-foreground">¿Eres técnico? <TextLink href="/registro/tecnico">Postula como técnico</TextLink></p>
        </section>
      </div>
    </main>
  );
}
