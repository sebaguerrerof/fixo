import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ServiceListing } from "@/components/services/service-listing";
import { SectionHeading } from "@/components/shared/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { CHILE_REGIONS } from "@/domain/geo/chile-communes";
import { cn } from "@/lib/utils";
import { communeSlug } from "@/domain/geo/commune-slug";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

type Params = Promise<{ readonly rubro: string }>;

async function loadCategory(slug: string) {
  const directory = new TechnicianDirectoryService();
  const category = (await directory.listCategories()).find((item) => item.slug === slug);
  return { directory, category };
}

export async function generateMetadata({ params }: { readonly params: Params }) {
  const { rubro } = await params;
  const { category } = await loadCategory(rubro);
  if (!category) return { title: "Servicio no encontrado" };
  return {
    title: `${category.name} a domicilio`,
    description: `${category.description} Mira los técnicos verificados de ${category.name.toLowerCase()} sin crear una cuenta.`,
    alternates: { canonical: `/servicios/${category.slug}` },
  };
}

export default async function ServicePage({ params, searchParams }: { readonly params: Params; readonly searchParams: Promise<{ readonly region?: string | string[] }> }) {
  const { rubro } = await params;
  const rawRegion = (await searchParams).region;
  // One region at a time (server-rendered links, crawlable); Metropolitana by default.
  const region = CHILE_REGIONS.find((item) => item.id === (Array.isArray(rawRegion) ? rawRegion[0] : rawRegion)) ?? CHILE_REGIONS.find((item) => item.id === "RM") ?? CHILE_REGIONS[0]!;
  const { directory, category } = await loadCategory(rubro);
  if (!category) notFound();
  const technicians = await directory.search({ categoryId: category.id, verifiedOnly: true, sort: "recommended" });
  return (
    <>
      <SiteHeader />
      <main className="container pb-14 pt-10 lg:pt-16">
        <nav aria-label="Ruta" className="mb-2 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground"><Link className="inline-flex min-h-11 items-center hover:underline" href="/servicios">Servicios</Link> / <span aria-current="page">{category.name}</span></nav>
        <div className="animate-enter">
          <SectionHeading as="h1" description={category.description} title={`${category.name} a domicilio`} />
        </div>
        <div className="mt-6"><Link className={buttonVariants({ size: "lg" })} href="/solicitar">Solicitar este servicio</Link></div>

        <section aria-labelledby="tecnicos" className="mt-12">
          <h2 className="text-2xl" id="tecnicos">Técnicos de {category.name.toLowerCase()}</h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground"><span className="tabular font-semibold text-foreground">{technicians.length}</span> {technicians.length === 1 ? "perfil verificado" : "perfiles verificados"}. La contratación y los pagos todavía no están habilitados.</p>
          <ServiceListing emptyDescription="Aún no hay perfiles publicados en este servicio. Puedes dejar tu solicitud y los técnicos de tu comuna podrán responderla." emptyTitle="Todavía no hay técnicos publicados" technicians={technicians} />
        </section>

        <section aria-labelledby="comunas" className="mt-14">
          <h2 className="text-2xl" id="comunas">{category.name} por comuna</h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">Elige tu comuna para ver quién atiende en tu zona.</p>
          <nav aria-label="Región" className="flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
            {CHILE_REGIONS.map((item) => <Link aria-current={item.id === region.id ? "page" : undefined} className={cn(buttonVariants({ variant: item.id === region.id ? "default" : "outline", size: "sm" }), "shrink-0")} href={`/servicios/${category.slug}?region=${item.id}#comunas`} key={item.id} scroll={false}>{item.name}</Link>)}
          </nav>
          <ul className="mt-4 grid gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
            {region.communes.map((commune) => <li key={commune}><Link className="flex min-h-11 items-center text-sm text-primary hover:underline" href={`/servicios/${category.slug}/${communeSlug(commune)}`}>{commune}</Link></li>)}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
