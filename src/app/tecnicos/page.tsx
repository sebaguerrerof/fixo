import { Filter, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { TechnicianCard } from "@/components/technicians/technician-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

type MarketplaceSearchParams = Promise<{ readonly q?: string | string[]; readonly categoria?: string | string[] }>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.at(0) : value;
}

export default async function TechniciansPage({ searchParams }: { readonly searchParams: MarketplaceSearchParams }) {
  const params = await searchParams;
  const query = firstValue(params.q)?.trim();
  const categoryId = firstValue(params.categoria);
  const directory = new TechnicianDirectoryService();
  const [categories, technicians] = await Promise.all([directory.listCategories(), directory.search({ query, categoryId, verifiedOnly: true })]);
  const selectedCategory = categories.find((category) => category.id === categoryId);

  return <><SiteHeader /><main className="container pb-24 pt-10 md:pb-14 lg:pt-16"><div className="animate-enter"><SectionHeading eyebrow="Marketplace" title={selectedCategory ? `Técnicos de ${selectedCategory.name}` : "Encuentra al técnico indicado"} description="Explora perfiles activos, especialidades y disponibilidad antes de elegir." /></div><form action="/tecnicos" className="search-command mt-8 flex flex-col gap-3 p-3 md:flex-row"><label className="flex min-w-0 flex-1 items-center gap-3 px-3"><Search className="size-5 text-primary" /><span className="sr-only">Buscar por problema, especialista o comuna</span><input className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" defaultValue={query} name="q" placeholder="¿Qué necesitas resolver?" /></label>{categoryId ? <input name="categoria" type="hidden" value={categoryId} /> : null}<button className={buttonVariants({ size: "lg" })} type="submit">Buscar</button></form><div className="mt-6 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]"><span className="sticky left-0 mr-1 inline-flex items-center gap-1 bg-background pr-1 text-sm font-medium text-muted-foreground"><Filter className="size-4" />Rubros:</span><Link className={cn(buttonVariants({ variant: !categoryId ? "default" : "outline", size: "sm" }), "shrink-0")} href="/tecnicos">Todos</Link>{categories.map((category) => <Link key={category.id} className={cn(buttonVariants({ variant: categoryId === category.id ? "default" : "outline", size: "sm" }), "shrink-0")} href={`/tecnicos?categoria=${category.id}`}>{category.name}</Link>)}</div><div className="mt-7 flex items-center justify-between"><p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{technicians.length}</span> técnicos disponibles</p><Badge variant="secondary"><SlidersHorizontal className="mr-1 size-3.5" />Recomendados</Badge></div>{technicians.length ? <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{technicians.map((technician, index) => <div key={technician.id} className="animate-enter" style={{ animationDelay: `${index * 70}ms` }}><TechnicianCard technician={technician} /></div>)}</div> : <Card className="mt-5"><CardContent className="py-12 text-center"><h2 className="font-bold">No hay resultados para esta búsqueda</h2><p className="mt-2 text-sm text-muted-foreground">Prueba con otro rubro o mira todos los técnicos activos.</p><Link className={`${buttonVariants({ variant: "outline" })} mt-5`} href="/tecnicos">Limpiar filtros</Link></CardContent></Card>}</main></>;
}
