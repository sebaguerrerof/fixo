import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { brand } from "@/design-system/brand";

export const metadata = { title: "Cómo funciona" };

const steps = [
  { title: "Busca o describe", text: "Elige un rubro para explorar los perfiles que estén publicados." },
  { title: "Consulta perfiles", text: "Revisa la información de experiencia y cobertura declarada por cada profesional." },
  { title: "Postula como técnico", text: "Registra tus datos y espera la revisión del equipo antes de aparecer en el directorio." },
];

export default function HowItWorksPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="container py-12 sm:py-16 lg:py-24">
          <h1 className="animate-enter max-w-3xl text-balance text-5xl leading-[0.98] sm:text-6xl">Cómo funciona {brand.name}</h1>
          <p className="animate-enter animate-enter-delay mt-6 max-w-xl text-lg leading-8 text-muted-foreground">Pensado para que tomes buenas decisiones antes, durante y después del trabajo.</p>
          <ol className="mt-12 grid max-w-5xl gap-8 md:grid-cols-3 md:gap-10">
            {steps.map((step, index) => (
              <li className="border-t border-foreground pt-4" key={step.title}>
                <p aria-hidden="true" className="tabular font-display text-5xl font-bold leading-none text-primary">{index + 1}</p>
                <h2 className="mt-4 text-2xl">{step.title}</h2>
                <p className="mt-2 leading-7 text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="border-y border-border bg-card/60">
          <div className="container grid gap-6 py-12 sm:py-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
            <h2 className="text-balance text-4xl leading-tight">Qué significa “perfil aprobado”</h2>
            <div className="max-w-prose space-y-4 text-lg leading-8 text-muted-foreground">
              <p>Antes de publicar a un técnico, el equipo de {brand.name} revisa su postulación, sus antecedentes y los requisitos de su rubro. Solo entonces su perfil aparece en el directorio, con el sello <strong className="font-semibold text-foreground">Perfil aprobado</strong>.</p>
              <p>El sello habla de esa revisión. No son reseñas de clientes ni una garantía del trabajo: todavía no publicamos evaluaciones.</p>
            </div>
          </div>
        </section>
        <section className="bg-inverse text-inverse-foreground">
          <div className="container grid gap-6 py-14 sm:py-16 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="max-w-2xl text-balance text-4xl">Tú eliges cómo avanzar</h2>
              <p className="mt-4 max-w-xl leading-7 text-inverse-muted">La contratación, los pagos y la atención de urgencias aún no están habilitados. Estamos incorporando profesionales para comenzar a operar.</p>
            </div>
            <Link className={buttonVariants({ variant: "secondary", size: "lg" })} href="/tecnicos">Buscar un técnico</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
