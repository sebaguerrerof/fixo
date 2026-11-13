import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ServiceRequestCard } from "@/components/service-requests/service-request-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireServerRole } from "@/services/auth/server-authentication-service";
import { getServiceRequestRepository } from "@/repositories/repository-factory";

const navigation = [{ href: "/perfil", label: "Mi perfil" }, { href: "/cliente", label: "Mis solicitudes" }, { href: "/cliente/trabajos", label: "Mis trabajos" }];
export default async function CustomerDashboardPage({ searchParams }: { readonly searchParams: Promise<{ page?: string }> }) {
  const user = await requireServerRole(["customer"]);
  const query = await searchParams;
  const page = Math.min(10000, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const repository = getServiceRequestRepository();
  const result = repository.listPageForCustomer ? await repository.listPageForCustomer(page) : { items: await repository.listForCustomer(user.id), total: 0 };
  return <DashboardShell activeHref="/cliente" requiredRole="customer" roleLabel="Espacio cliente" userName={user.name} navigation={navigation}>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-primary">Hola, {user.name.split(" ")[0]}</p><h1 className="mt-1 text-3xl font-bold">Mis solicitudes</h1><p className="mt-2 text-muted-foreground">Compara propuestas y consulta tus adjudicaciones. Pagos y ejecución pendientes de habilitación.</p></div><Link className={buttonVariants()} href="/solicitar">Solicitar servicio</Link></div>
    <section className="mt-7" id="solicitudes"><h2 className="text-xl font-bold">Solicitudes e historial</h2>
    {result.items.length ? <div className="mt-4 grid gap-4 lg:grid-cols-2">{result.items.map(request => <ServiceRequestCard key={request.id} request={request} />)}</div> : <Card className="mt-4"><CardContent className="p-6">No hay solicitudes en esta página. Crea una para recibir propuestas.</CardContent></Card>}
    <nav aria-label="Páginas de solicitudes" className="mt-6 flex flex-wrap items-center gap-4">{page > 1 ? <Link href={"/cliente?page=" + (page - 1)} className="font-semibold text-primary">Anterior</Link> : null}<span>Página {page} · {result.total} solicitudes</span>{page * 20 < result.total ? <Link href={"/cliente?page=" + (page + 1)} className="font-semibold text-primary">Siguiente</Link> : null}</nav>
    </section>
  </DashboardShell>;
}
