import Link from "next/link";

import { CategoryCard } from "@/components/categories/category-card";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

export const metadata = {
  title: "Servicios a domicilio",
  description: "Electricidad, gasfitería, cerrajería y más. Mira los técnicos verificados de cada servicio, sin crear una cuenta.",
  alternates: { canonical: "/servicios" },
};

export default async function ServicesPage() {
  const categories = await new TechnicianDirectoryService().listCategories();
  return (
    <>
      <SiteHeader />
      <main className="container pb-14 pt-10 lg:pt-16">
        <div className="animate-enter">
          <SectionHeading as="h1" description="Elige un servicio y mira los técnicos verificados que lo ofrecen. No necesitas una cuenta para explorar." title="Servicios a domicilio" />
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{categories.map((category) => <CategoryCard category={category} headingLevel="h2" key={category.id} />)}</div>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link className={buttonVariants({ size: "lg" })} href="/solicitar">Pedir un servicio</Link>
          <Link className={buttonVariants({ variant: "outline", size: "lg" })} href="/tecnicos">Ver todos los técnicos</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
