import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ServiceListing } from "@/components/services/service-listing";
import { SectionHeading } from "@/components/shared/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { communeFromSlug, communeSlug } from "@/domain/geo/commune-slug";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

type Params = Promise<{ readonly rubro: string; readonly comuna: string }>;

async function load({ rubro, comuna }: { readonly rubro: string; readonly comuna: string }) {
  const directory = new TechnicianDirectoryService();
  const category = (await directory.listCategories()).find((item) => item.slug === rubro);
  return { directory, category, commune: communeFromSlug(comuna) };
}

export async function generateMetadata({ params }: { readonly params: Params }) {
  const resolved = await params;
  const { category, commune } = await load(resolved);
  if (!category || !commune) return { title: "Servicio no encontrado" };
  return {
    title: `${category.name} en ${commune}`,
    description: `Técnicos verificados de ${category.name.toLowerCase()} que atienden en ${commune}. Mira los perfiles sin crear una cuenta.`,
    alternates: { canonical: `/servicios/${category.slug}/${resolved.comuna}` },
  };
}

export default async function ServiceInCommunePage({ params }: { readonly params: Params }) {
  const { directory, category, commune } = await load(await params);
  if (!category || !commune) notFound();
  const technicians = await directory.search({ categoryId: category.id, city: commune, verifiedOnly: true, sort: "recommended" });
  return (
    <>
      <SiteHeader />
      <main className="container pb-14 pt-10 lg:pt-16">
        <nav aria-label="Ruta" className="mb-2 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <Link className="inline-flex min-h-11 items-center hover:underline" href="/servicios">Servicios</Link> / <Link className="inline-flex min-h-11 items-center hover:underline" href={`/servicios/${category.slug}`}>{category.name}</Link> / <span aria-current="page">{commune}</span>
        </nav>
        <div className="animate-enter">
          <SectionHeading as="h1" description={`Técnicos verificados de ${category.name.toLowerCase()} que atienden en ${commune}. No necesitas una cuenta para ver sus perfiles.`} title={`${category.name} en ${commune}`} />
        </div>
        <div className="mt-6"><Link className={buttonVariants({ size: "lg" })} href={`/solicitar?rubro=${category.slug}&comuna=${communeSlug(commune)}`}>Solicitar este servicio</Link></div>
        <section aria-label="Técnicos" className="mt-12">
          <p className="mb-5 text-sm text-muted-foreground"><span className="tabular font-semibold text-foreground">{technicians.length}</span> {technicians.length === 1 ? "perfil verificado" : "perfiles verificados"} en {commune}. La contratación y los pagos todavía no están habilitados.</p>
          <ServiceListing headingLevel={2} requestHref={`/solicitar?rubro=${category.slug}&comuna=${communeSlug(commune)}`} emptyDescription={`Todavía no hay perfiles de ${category.name.toLowerCase()} que atiendan en ${commune}. Puedes dejar tu solicitud o mirar el servicio en otras comunas.`} emptyTitle={`Sin técnicos en ${commune} por ahora`} technicians={technicians} />
          <div className="mt-6"><Link className={buttonVariants({ variant: "outline" })} href={`/servicios/${category.slug}`}>Ver {category.name.toLowerCase()} en otras comunas</Link></div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
