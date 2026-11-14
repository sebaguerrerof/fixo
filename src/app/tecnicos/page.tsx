import { Filter, Search, SearchX, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/section-heading";
import { TechnicianCard } from "@/components/technicians/technician-card";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";
import type { TechnicianSort } from "@/repositories/contracts/technician-repository";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

export const metadata = { title: "Directorio de técnicos" };

type MarketplaceSearchParams = Promise<{ readonly q?: string | string[]; readonly categoria?: string | string[]; readonly orden?: string | string[] }>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.at(0) : value;
}

const sortOptions: readonly { readonly value: TechnicianSort; readonly label: string }[] = [
  { value: "recommended", label: "Recomendado" },
  { value: "rating", label: "Mejor valorado" },
  { value: "experience", label: "Mayor experiencia" },
  { value: "response_time", label: "Respuesta rápida" },
];

function isTechnicianSort(value: string | undefined): value is TechnicianSort {
  return sortOptions.some((option) => option.value === value);
}

export default async function TechniciansPage({ searchParams }: { readonly searchParams: MarketplaceSearchParams }) {
  const params = await searchParams;
  const query = firstValue(params.q)?.trim();
  const categoryId = firstValue(params.categoria);
  const rawSort = firstValue(params.orden);
  const sort: TechnicianSort = isTechnicianSort(rawSort) ? rawSort : "recommended";
  const directory = new TechnicianDirectoryService();
  const [categories, technicians] = await Promise.all([directory.listCategories(), directory.search({ query, categoryId, verifiedOnly: true, sort })]);
  const selectedCategory = categories.find((category) => category.id === categoryId);

  return (
    <>
      <SiteHeader />
      <main className="container pb-14 pt-10 lg:pt-16">
        <div className="animate-enter">
          <SectionHeading eyebrow="Directorio" title={selectedCategory ? `Técnicos de ${selectedCategory.name}` : "Encuentra al técnico indicado"} description="Explora perfiles publicados, especialidades y zonas de cobertura antes de elegir." />
        </div>

        <form action="/tecnicos" className="search-command mt-8 flex flex-col gap-2 p-2 md:flex-row md:items-center" role="search">
          <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
            <Search aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <span className="sr-only">Buscar por problema, especialista o comuna</span>
            <input autoComplete="off" className="h-11 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" defaultValue={query} name="q" placeholder="¿Qué necesitas resolver?" type="search" />
          </label>
          {categoryId ? <input name="categoria" type="hidden" value={categoryId} /> : null}
          <button className={buttonVariants({ size: "lg" })} type="submit">Buscar</button>
        </form>

        <nav aria-label="Filtrar por rubro" className="mt-6 flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
          <span className="mr-1 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground"><Filter aria-hidden="true" className="size-4" />Rubros</span>
          <Link aria-current={!categoryId ? "page" : undefined} className={cn(buttonVariants({ variant: !categoryId ? "default" : "outline", size: "sm" }), "shrink-0")} href="/tecnicos">Todos</Link>
          {categories.map((category) => <Link aria-current={categoryId === category.id ? "page" : undefined} className={cn(buttonVariants({ variant: categoryId === category.id ? "default" : "outline", size: "sm" }), "shrink-0")} href={`/tecnicos?categoria=${category.id}`} key={category.id}>{category.name}</Link>)}
        </nav>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <p aria-live="polite" className="text-sm text-muted-foreground"><span className="tabular font-semibold text-foreground">{technicians.length}</span> {technicians.length === 1 ? "técnico disponible" : "técnicos disponibles"}</p>
          <nav aria-label="Ordenar resultados" className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal aria-hidden="true" className="size-4 text-muted-foreground" />
            {sortOptions.map((option) => <Link aria-current={sort === option.value ? "true" : undefined} className={buttonVariants({ variant: sort === option.value ? "default" : "outline", size: "sm" })} href={{ pathname: "/tecnicos", query: { ...(query ? { q: query } : {}), ...(categoryId ? { categoria: categoryId } : {}), orden: option.value } }} key={option.value}>{option.label}</Link>)}
          </nav>
        </div>

        {technicians.length ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {technicians.map((technician, index) => <Reveal delay={Math.min(index, 5) * 70} key={technician.id}><TechnicianCard technician={technician} /></Reveal>)}
          </div>
        ) : (
          <div className="mt-6"><EmptyState action={<Link className={buttonVariants({ variant: "outline" })} href="/tecnicos">Limpiar filtros</Link>} description="Prueba con otro rubro o mira todos los técnicos publicados." icon={SearchX} title="No hay resultados para esta búsqueda" /></div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
