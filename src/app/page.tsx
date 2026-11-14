import { ArrowRight, CheckCircle2, ClipboardList, Search, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import Link from "next/link";

import { CategoryCard } from "@/components/categories/category-card";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/section-heading";
import { TechnicianCard } from "@/components/technicians/technician-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { brand } from "@/design-system/brand";
import { cn } from "@/lib/utils";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

const trustPoints = ["Perfiles revisados por nuestro equipo", "Cobertura y especialidades a la vista", "Sin compromiso al explorar"];

const steps = [
  { icon: Search, title: "Explora por rubro", description: "Elige la especialidad que necesitas y revisa los perfiles publicados: experiencia, zona y especialidades." },
  { icon: ClipboardList, title: "Cuéntanos tu necesidad", description: "Describe el trabajo con tus palabras. Es el primer paso para recibir propuestas." },
  { icon: ShieldCheck, title: "Decide con información", description: "Compara perfiles y acuerda el trabajo con claridad antes de empezar." },
];

const progress = ["Explora los rubros", "Revisa perfiles publicados", "Postula si eres técnico", "Pasa por la revisión de antecedentes"];

export default async function HomePage() {
  const directory = new TechnicianDirectoryService();
  const [categories, featuredTechnicians] = await Promise.all([directory.listCategories(), directory.getFeaturedTechnicians()]);

  return (
    <>
      <SiteHeader />
      <main className="overflow-hidden">
        <section className="hero-shell relative isolate overflow-hidden border-b border-border/70">
          <div className="hero-orb hero-orb-one" />
          <div className="hero-orb hero-orb-two" />
          <div className="surface-grid absolute inset-0 -z-10 opacity-60" />
          <div className="container relative grid gap-12 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
            <div className="max-w-2xl animate-enter">
              <p className="eyebrow"><Sparkles aria-hidden="true" className="size-4" />Estamos incorporando técnicos</p>
              <h1 className="mt-6 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">Un técnico de confianza para <span className="text-gradient">cada arreglo del hogar.</span></h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">{brand.name} reúne especialistas con perfil y cobertura a la vista. Explora por rubro o cuéntanos qué necesitas resolver.</p>
              <form action="/tecnicos" className="search-command mt-8 flex max-w-xl flex-col gap-2 p-2 sm:flex-row sm:items-center">
                <label className="flex min-w-0 flex-1 items-center gap-3 px-3 py-1"><Search aria-hidden="true" className="size-5 shrink-0 text-primary" /><span className="sr-only">¿Qué necesitas resolver?</span><input autoComplete="off" className="h-11 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" name="q" placeholder="Ej. una fuga de agua en la cocina" type="search" /></label>
                <button className={buttonVariants({ size: "lg" })} type="submit">Buscar <ArrowRight aria-hidden="true" className="size-4" /></button>
              </form>
              <ul className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">{trustPoints.map((point) => <li key={point} className="inline-flex items-center gap-1.5"><CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success" />{point}</li>)}</ul>
            </div>
            <div className="animate-enter animate-enter-delay">
              <div className="work-card mx-auto max-w-md p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-muted-foreground">Etapa actual</p><p className="mt-1 text-lg font-semibold">Así avanzamos contigo</p></div><span className="live-indicator">En marcha</span></div>
                <ol className="mt-6 space-y-1">{progress.map((step, index) => <li key={step} className="timeline-step"><span className="timeline-number">{index + 1}</span><span>{step}</span></li>)}</ol>
                <div className="mt-6 rounded-2xl bg-inverse p-4 text-inverse-foreground"><div className="flex items-center gap-2 text-xs font-semibold text-inverse-accent"><ShieldCheck aria-hidden="true" className="size-4" />Información profesional</div><p className="mt-2 text-sm leading-6 text-inverse-muted">Consulta especialidades y cobertura declaradas. La contratación y los pagos todavía no están habilitados.</p></div>
                <Link className={cn(buttonVariants({ size: "lg" }), "mt-5 w-full")} href="/registro/tecnico"><UsersRound aria-hidden="true" className="size-5" />Quiero postular como técnico</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="container section-space">
          <Reveal className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><SectionHeading eyebrow="Rubros" title="Encuentra la especialidad que necesitas" description="Entra a una categoría y mira los perfiles disponibles." /><Link className="touch-area inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" href="/tecnicos">Ver todos <ArrowRight aria-hidden="true" className="size-4" /></Link></Reveal>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{categories.map((category, index) => <Reveal key={category.id} delay={index * 60}><CategoryCard category={category} /></Reveal>)}</div>
        </section>

        <section className="border-y border-border/70 bg-card/50"><div className="container section-space"><Reveal><SectionHeading eyebrow="Cómo funciona" title="Simple de principio a fin" /></Reveal><div className="mt-10 grid gap-5 md:grid-cols-3">{steps.map((step, index) => <Reveal key={step.title} delay={index * 90}><Card className="motion-card h-full"><CardContent className="p-6"><span className="tabular text-sm font-semibold text-primary">0{index + 1}</span><span className="mt-5 flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><step.icon aria-hidden="true" className="size-6" /></span><h3 className="mt-5 text-lg font-semibold">{step.title}</h3><p className="mt-2 leading-6 text-muted-foreground">{step.description}</p></CardContent></Card></Reveal>)}</div></div></section>

        <section className="container section-space">
          <Reveal className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><SectionHeading eyebrow="Perfiles" title="Técnicos publicados" description="Aquí aparecerán los perfiles aprobados a medida que se sumen profesionales." /><Link className="touch-area inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" href="/tecnicos">Explorar el directorio <ArrowRight aria-hidden="true" className="size-4" /></Link></Reveal>
          <div className="mt-9 grid gap-5 lg:grid-cols-3">{featuredTechnicians.length === 0 ? <div className="lg:col-span-3"><EmptyState action={<Link className={buttonVariants({ variant: "outline" })} href="/registro/tecnico">Postular como técnico</Link>} description="Todavía no hay perfiles publicados. Si trabajas en el rubro, puedes postular para formar parte del directorio." icon={UsersRound} title="Estamos sumando a los primeros técnicos" /></div> : featuredTechnicians.map((technician, index) => <Reveal key={technician.id} delay={index * 90}><TechnicianCard technician={technician} /></Reveal>)}</div>
        </section>

        <section className="container pb-16 lg:pb-24"><Reveal><div className="relative overflow-hidden rounded-3xl bg-inverse px-6 py-10 text-inverse-foreground sm:px-10 lg:px-14"><div className="surface-grid absolute inset-0 opacity-30" /><div className="absolute -right-20 -top-24 size-72 rounded-full bg-primary/25 blur-3xl" /><div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm font-semibold uppercase tracking-wider text-inverse-accent">¿Eres técnico?</p><h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Muestra tu experiencia a quienes la necesitan.</h2><p className="mt-4 max-w-2xl leading-7 text-inverse-muted">Cuéntanos tus especialidades y tu zona de cobertura. Nuestro equipo revisa cada postulación antes de publicar tu perfil.</p></div><Link className={buttonVariants({ variant: "secondary", size: "lg" })} href="/registro/tecnico">Postular como técnico <ArrowRight aria-hidden="true" className="size-4" /></Link></div></div></Reveal></section>
      </main>
      <SiteFooter />
    </>
  );
}
