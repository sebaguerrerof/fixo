import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CredentialCard } from "@/components/technicians/credential-card";
import { brand } from "@/design-system/brand";
import { formatClp } from "@/lib/utils";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

type TechnicianPageParams = Promise<{ readonly slug: string }>;

export async function generateMetadata({ params }: { readonly params: TechnicianPageParams }): Promise<Metadata> {
  const technician = await new TechnicianDirectoryService().getPublicProfile((await params).slug);
  return { title: technician && ["active", "verified"].includes(technician.status) ? technician.displayName : "Técnico no encontrado" };
}

export default async function TechnicianProfilePage({ params }: { readonly params: TechnicianPageParams }) {
  const technician = await new TechnicianDirectoryService().getPublicProfile((await params).slug);
  if (!technician || !["active", "verified"].includes(technician.status)) notFound();
  return (
    <>
      <SiteHeader />
      <main className="container space-y-8 pb-14 pt-8 lg:pt-12">
        <Link className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline" href="/tecnicos">Volver al directorio</Link>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div><CredentialCard animateStamp technician={technician} variant="page" /></div>
          <div className="space-y-8">
            <section>
              <h2 className="text-2xl">Sobre su trabajo</h2>
              <p className="mt-3 max-w-prose leading-7 text-muted-foreground">{technician.bio}</p>
            </section>
            <section>
              <h2 className="text-2xl">Especialidades declaradas</h2>
              <ul className="mt-3 flex flex-wrap gap-2">{technician.specialties.map((specialty) => <li className="rounded-sm border border-foreground/40 px-2.5 py-1 text-sm font-medium" key={specialty}>{specialty}</li>)}</ul>
            </section>
            <section>
              <h2 className="text-2xl">Cobertura declarada</h2>
              <p className="mt-3">{technician.coverageAreas.join(" · ") || technician.city}</p>
            </section>
            <section className="border-t border-border pt-6">
              <h2 className="text-2xl">Información del servicio</h2>
              <p className="mt-3">Valor referencial: <strong className="tabular">{technician.startingPriceClp > 0 ? formatClp(technician.startingPriceClp) : "A convenir"}</strong></p>
              <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">El valor fue declarado por el técnico. La contratación y los pagos en {brand.name} aún no están habilitados.</p>
            </section>
          </div>
        </div>
        <EmptyState description={`${brand.name} todavía no publica reseñas de clientes en los perfiles.`} title="Evaluaciones aún no disponibles" />
      </main>
      <SiteFooter />
    </>
  );
}
