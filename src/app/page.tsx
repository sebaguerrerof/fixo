import { ArrowRight, CheckCircle2, Search, ShieldCheck, Sparkles, UsersRound, Zap } from "lucide-react";
import Link from "next/link";

import { CategoryCard } from "@/components/categories/category-card";
import { SiteHeader } from "@/components/layout/site-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/section-heading";
import { TechnicianCard } from "@/components/technicians/technician-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

const trustPoints = ["Registro de clientes", "Postulación de técnicos", "Directorio por rubro"];

const steps = [
  { icon: Search, title: "Cuéntanos lo que necesitas", description: "Explora las categorías y los datos declarados por cada especialista." },
  { icon: UsersRound, title: "Conoce los perfiles", description: "Consulta experiencia y zonas de cobertura declaradas." },
  { icon: ShieldCheck, title: "Postula como técnico", description: "Registra tus antecedentes para revisión de administración." },
];

export default async function HomePage() {
  const directory = new TechnicianDirectoryService();
  const [categories, featuredTechnicians] = await Promise.all([directory.listCategories(), directory.getFeaturedTechnicians()]);

  return (
    <>
      <SiteHeader />
      <main className="overflow-hidden pb-24 md:pb-0">
        <section className="hero-shell relative isolate overflow-hidden border-b border-border/70">
          <div className="hero-orb hero-orb-one" />
          <div className="hero-orb hero-orb-two" />
          <div className="surface-grid absolute inset-0 opacity-[0.035]" />
          <div className="container relative grid gap-12 py-14 sm:py-18 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
            <div className="max-w-2xl animate-enter">
              <p className="eyebrow"><Sparkles className="size-4" />Servicios para tu hogar, sin incertidumbre</p>
              <h1 className="mt-6 text-balance text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">El técnico que necesitas, <span className="text-gradient">para tu hogar.</span></h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">Estamos incorporando profesionales. Explora los rubros disponibles o postula como técnico.</p>
              <form action="/tecnicos" className="search-command mt-8 flex max-w-xl flex-col gap-3 p-3 sm:flex-row">
                <label className="flex min-w-0 flex-1 items-center gap-3 px-3"><Search className="size-5 shrink-0 text-primary" /><span className="sr-only">¿Qué necesitas resolver?</span><input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" name="q" placeholder="Ej. reparar una fuga de agua" /></label>
                <button className={buttonVariants({ size: "lg" })} type="submit">Buscar técnicos <ArrowRight className="size-4" /></button>
              </form>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">{trustPoints.map((point) => <span key={point} className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-success" />{point}</span>)}</div>
            </div>
            <div className="relative animate-enter animate-enter-delay">
              <div className="absolute -inset-8 -z-10 rounded-full bg-primary/10 blur-3xl" />
              <div className="work-card mx-auto max-w-md p-5 sm:p-6">
                <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-muted-foreground">Fixo está creciendo</p><p className="mt-1 text-lg font-bold">Conoce nuestra etapa actual</p></div><span className="live-indicator">Incorporando técnicos</span></div>
                <div className="mt-7 space-y-1">{["Explora los rubros", "Consulta perfiles publicados", "Postula como técnico", "Completa la revisión de antecedentes"].map((step, index) => <div key={step} className="timeline-step"><span className="timeline-number">{index + 1}</span><p>{step}</p>{index === 0 ? <Zap className="ml-auto size-4 text-primary" /> : null}</div>)}</div>
                <div className="mt-6 rounded-2xl bg-slate-950 p-4 text-white"><div className="flex items-center gap-2 text-xs font-semibold text-cyan-100"><ShieldCheck className="size-4" />Información profesional</div><p className="mt-2 text-sm leading-6 text-slate-300">Consulta especialidades y cobertura declaradas. La contratación y los pagos aún no están disponibles.</p></div>
                <Link className={cn(buttonVariants({ size: "lg" }), "mt-5 w-full")} href="/registro/tecnico"><UsersRound className="size-5" />Postular como técnico</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="container section-space section-reveal">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><SectionHeading eyebrow="Encuentra por rubro" title="Explora por especialidad" description="Elige una categoría y consulta los perfiles que se vayan incorporando." /><Link className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" href="/tecnicos">Ver todos <ArrowRight className="size-4" /></Link></div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{categories.map((category, index) => <div key={category.id} className="animate-enter" style={{ animationDelay: `${index * 60}ms` }}><CategoryCard category={category} /></div>)}</div>
        </section>

        <section className="border-y border-border/70 bg-card/70"><div className="container section-space section-reveal"><SectionHeading eyebrow="Así de simple" title="Conoce la etapa actual de Fixo" /><div className="mt-10 grid gap-5 md:grid-cols-3">{steps.map((step, index) => <Card key={step.title} className="motion-card relative overflow-hidden"><CardContent className="p-6"><span className="text-sm font-bold text-primary">0{index + 1}</span><span className="mt-5 flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><step.icon className="size-6" /></span><h3 className="mt-5 text-lg font-bold">{step.title}</h3><p className="mt-2 leading-6 text-muted-foreground">{step.description}</p></CardContent></Card>)}</div></div></section>

        <section className="container section-space section-reveal"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><SectionHeading eyebrow="Directorio" title="Perfiles publicados" description="Los perfiles aprobados aparecerán aquí a medida que se incorporen profesionales." /><Link className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" href="/tecnicos">Explorar marketplace <ArrowRight className="size-4" /></Link></div><div className="mt-9 grid gap-5 lg:grid-cols-3">{featuredTechnicians.length === 0 ? <EmptyState title="Estamos incorporando profesionales" description="Aún no hay técnicos publicados. Puedes postular para formar parte del directorio." /> : featuredTechnicians.map((technician, index) => <div key={technician.id} className="animate-enter" style={{ animationDelay: `${index * 90}ms` }}><TechnicianCard technician={technician} /></div>)}</div></section>

        <section className="container pb-16 lg:pb-24"><div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-10 text-background sm:px-10 lg:px-14"><div className="absolute inset-0 surface-grid opacity-15" /><div className="absolute -right-20 -top-24 size-72 rounded-full bg-cyan-500/20 blur-3xl" /><div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm font-semibold text-cyan-200">¿Eres técnico o especialista?</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Presenta tu experiencia profesional.</h2><p className="mt-4 max-w-2xl leading-7 text-slate-300">Registra tus especialidades y cobertura para evaluación de administración.</p></div><Link className={buttonVariants({ variant: "secondary", size: "lg" })} href="/registro/tecnico">Postular como técnico <ArrowRight className="size-4" /></Link></div></div></section>
      </main>
      <footer className="border-t bg-background pb-24 md:pb-7"><div className="container flex flex-col justify-between gap-3 py-7 text-sm text-muted-foreground sm:flex-row"><p>© 2026 fixo. Servicios con más confianza.</p><div className="flex gap-5"><Link href="/como-funciona">Cómo funciona</Link><Link href="/login">Mi cuenta</Link></div></div></footer>
    </>
  );
}
