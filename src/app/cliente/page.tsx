import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { ServiceRequestCard } from "@/components/service-requests/service-request-card";
import { buttonVariants } from "@/components/ui/button";
import { getServiceRequestRepository } from "@/repositories/repository-factory";
import { requireServerRole } from "@/services/auth/server-authentication-service";

const navigation = [{ href: "/perfil", label: "Mi perfil" }, { href: "/cliente", label: "Mis solicitudes" }, { href: "/cliente/trabajos", label: "Mis trabajos" }];
const PAGE_SIZE = 20;

export default async function CustomerDashboardPage({ searchParams }: { readonly searchParams: Promise<{ page?: string }> }) {
  const user = await requireServerRole(["customer"]);
  const query = await searchParams;
  const page = Math.min(10000, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const repository = getServiceRequestRepository();
  const result = repository.listPageForCustomer ? await repository.listPageForCustomer(page) : { items: await repository.listForCustomer(user.id), total: 0 };
  return (
    <DashboardShell activeHref="/cliente" navigation={navigation} requiredRole="customer" roleLabel="Espacio cliente" userName={user.name}>
      <PageHeader
        actions={<Link className={buttonVariants()} href="/solicitar">Solicitar servicio</Link>}
        description="Compara propuestas y consulta tus adjudicaciones. Pagos y ejecución pendientes de habilitación."
        eyebrow={`Hola, ${user.name.split(" ")[0]}`}
        title="Mis solicitudes"
      />
      <section className="mt-8" id="solicitudes">
        <h2 className="text-lg font-semibold">Solicitudes e historial</h2>
        {result.items.length ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">{result.items.map((request) => <ServiceRequestCard key={request.id} request={request} />)}</div>
        ) : (
          <div className="mt-4"><EmptyState action={<Link className={buttonVariants({ variant: "outline" })} href="/solicitar">Crear una solicitud</Link>} description="Cuando crees una solicitud, aquí verás las propuestas y su avance." icon={ClipboardList} title="No hay solicitudes en esta página" /></div>
        )}
        <Pagination hrefFor={(target) => `/cliente?page=${target}`} label="Páginas de solicitudes" noun="solicitudes" page={page} pageSize={PAGE_SIZE} total={result.total} />
      </section>
    </DashboardShell>
  );
}
