import { redirect } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CreateServiceRequestForm } from "@/components/service-requests/create-service-request-form";
import { communeFromSlug } from "@/domain/geo/commune-slug";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";
import Link from "next/link";

export const metadata = { title: "Solicitud de servicio" };

type RequestSearchParams = Promise<{ readonly rubro?: string | string[]; readonly comuna?: string | string[] }>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function RequestServicePage({ searchParams }: { readonly searchParams: RequestSearchParams }) {
  // Anyone can look at and fill the form; an account is asked for only when the request is sent.
  const user = await getServerAuthenticatedUser();
  if (user && user.role !== "customer") redirect("/perfil");
  const categories = await new TechnicianDirectoryService().listCategories();
  const params = await searchParams;
  const initial = { categoryId: categories.find((category) => category.slug === first(params.rubro))?.id, locationLabel: communeFromSlug(first(params.comuna) ?? "") ?? undefined };
  return (
    <>
      <SiteHeader />
      <main className="container pb-12 pt-8 sm:pt-12">
        <Card className="mx-auto w-full max-w-2xl animate-enter">
          <CardContent className="p-5 sm:p-10">
            <h1 className="text-balance text-4xl leading-tight">Solicitud de servicio</h1>
            <p className="mt-3 max-w-xl leading-7 text-muted-foreground">Describe lo que necesitas y recibe propuestas de técnicos habilitados en tu comuna. Los pagos y la ejecución del servicio se habilitarán en una etapa posterior.</p>
            <div className="mt-8"><CreateServiceRequestForm categories={categories} initial={initial} signedIn={Boolean(user)} /></div>
            <div className="mt-6"><Link className={buttonVariants({ variant: "outline", size: "lg" })} href={user ? "/cliente" : "/servicios"}>{user ? "Volver a mi panel" : "Ver los servicios"}</Link></div>
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}
