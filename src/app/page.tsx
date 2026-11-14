import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { CategoryCard } from "@/components/categories/category-card";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/section-heading";
import { HeroCredential } from "@/components/technicians/hero-credential";
import { TechnicianCard } from "@/components/technicians/technician-card";
import { buttonVariants } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { brand } from "@/design-system/brand";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

const steps = [
  { title: "Elige el rubro", text: "Revisa los perfiles publicados: experiencia, zona de cobertura y especialidades." },
  { title: "Cuéntanos qué necesitas", text: "Descríbelo con tus palabras. Es el primer paso para recibir propuestas." },
  { title: "Decide con información", text: "Compara perfiles y acuerda el trabajo antes de que empiece." },
];

export default async function HomePage() {
  const directory = new TechnicianDirectoryService();
  const [categories, featuredTechnicians] = await Promise.all([directory.listCategories(), directory.getFeaturedTechnicians()]);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="border-b border-border">
          <div className="container grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-16 lg:py-24">
            <div className="animate-enter">
              <h1 className="max-w-3xl text-balance text-5xl leading-[0.98] sm:text-6xl lg:text-7xl">Un técnico de confianza para cada arreglo del hogar.</h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">{brand.name} publica solo perfiles revisados por su equipo. Mira la experiencia y la cobertura de cada uno, y acuerda el trabajo antes de empezar.</p>
              <form action="/tecnicos" className="search-command mt-8 flex max-w-xl flex-col gap-2 p-2 sm:flex-row" role="search">
                <label className="flex min-w-0 flex-1 items-center px-3"><span className="sr-only">¿Qué necesitas resolver?</span><input autoComplete="off" className="h-11 min-w-0 flex-1 bg-transparent outline-none" name="q" placeholder="Ej. una fuga de agua en la cocina" type="search" /></label>
                <button className={buttonVariants({ size: "lg" })} type="submit">Buscar técnicos</button>
              </form>
            </div>
            <aside aria-label="Un perfil aprobado" className="animate-enter animate-enter-delay lg:pt-2">
              <HeroCredential technician={featuredTechnicians[0] ?? null} />
              {featuredTechnicians[0] ? <p className="mt-3 text-sm text-muted-foreground">La contratación y los pagos todavía no están habilitados.</p> : null}
            </aside>
          </div>
        </section>

        <section className="container section-space">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><SectionHeading description="Entra a un rubro y mira los perfiles disponibles." title="Qué necesitas arreglar" /><Link className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline" href="/tecnicos">Ver el directorio completo <ArrowRight aria-hidden="true" className="size-4" /></Link></div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{categories.map((category) => <CategoryCard category={category} key={category.id} />)}</div>
        </section>

        <section className="border-y border-border bg-card/60">
          <div className="container section-space">
            <SectionHeading title="Cómo funciona" />
            <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
              {steps.map((step, index) => (
                <li className="border-t border-foreground pt-4" key={step.title}>
                  <p aria-hidden="true" className="tabular font-display text-5xl font-bold leading-none text-primary">{index + 1}</p>
                  <h3 className="mt-4 text-2xl">{step.title}</h3>
                  <p className="mt-2 leading-7 text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="container section-space">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><SectionHeading description="Los perfiles aprobados aparecen aquí a medida que se suman profesionales." title="Técnicos publicados" /><Link className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline" href="/tecnicos">Explorar el directorio <ArrowRight aria-hidden="true" className="size-4" /></Link></div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {featuredTechnicians.length === 0
              ? <div className="lg:col-span-3"><EmptyState action={<Link className={buttonVariants({ variant: "outline" })} href="/registro/tecnico">Postular como técnico</Link>} description="Todavía no hay perfiles publicados. Si trabajas en el rubro, puedes postular para formar parte del directorio." title="Estamos sumando a los primeros técnicos" /></div>
              : featuredTechnicians.map((technician) => <TechnicianCard key={technician.id} technician={technician} />)}
          </div>
        </section>

        <section className="bg-inverse text-inverse-foreground">
          <div className="container grid gap-6 py-14 sm:py-16 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="max-w-2xl text-balance text-4xl sm:text-5xl">Muestra tu experiencia a quienes la necesitan.</h2>
              <p className="mt-4 max-w-xl leading-7 text-inverse-muted">Cuéntanos tus especialidades y tu zona de cobertura. Nuestro equipo revisa cada postulación antes de publicar tu perfil.</p>
            </div>
            <Link className={buttonVariants({ variant: "secondary", size: "lg" })} href="/registro/tecnico">Postular como técnico</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
