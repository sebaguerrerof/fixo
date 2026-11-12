import Link from "next/link";
import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { requireServerRole } from "@/services/auth/server-authentication-service";
import { JobOperationsService } from "@/services/jobs/job-operations-service";
import { loadJobPayments } from "@/services/payments/payment-read-service";
import { describeOrder } from "@/domain/payments/presentation";
import { loadTechnicianPayments } from "@/services/payments/technician-payments-service";
import { formatClp } from "@/lib/utils";

export default async function TechnicianPaymentsPage({ searchParams }: { readonly searchParams: Promise<{ page?: string }> }) {
  await requireServerRole(["technician"]);
  const q = await searchParams;
  const data = await loadTechnicianPayments(q.page, { listJobs: (page) => new JobOperationsService().list(page), loadPayments: loadJobPayments });
  return <TechnicianDashboardShell activeHref="/tecnico/pagos"><h1 className="mb-3 text-3xl font-bold">Pagos e importes asignados</h1>
    <p className="mb-7 text-muted-foreground">Entorno de prueba (Sandbox). Los importes son lo asignado a ti por cada trabajo; no son transferencias efectuadas ni saldo disponible para retiro. La liquidación sólo se calcula como simulación al cierre sin reclamos.</p>
    {data.status === "unavailable" ? <Card><CardContent className="space-y-3 p-6"><p className="font-semibold">Pagos no disponibles por ahora</p><p className="text-sm text-muted-foreground">No pudimos cargar tus trabajos. Esto no significa que no tengas pagos: no se asume ningún estado.</p><Link href={`/tecnico/pagos?page=${data.page}`} className="text-sm font-semibold text-primary underline">Reintentar</Link></CardContent></Card> : data.rows.length === 0 ? <EmptyState title="Aún no hay trabajos con pagos" description="Cuando adjudiquen una cotización, aquí verás el estado del pago y los importes asignados." /> :
      <><p className="mb-4 text-sm text-muted-foreground">{data.total} trabajos · página {data.page}.</p><div className="grid gap-4 lg:grid-cols-2">{data.rows.map(({ item, payments }) => <Card key={item.job.id}><CardContent className="space-y-3 p-5 break-words">
        <h2 className="text-xl font-bold"><Link href={`/tecnico/trabajos/${item.job.id}`} className="underline decoration-primary/40 underline-offset-4">{item.title}</Link></h2>
        {payments.status === "unavailable" ? <p className="text-sm text-muted-foreground">Estado de pagos no disponible. No se asume deuda ni pago.</p> : <>
          {payments.view.orders.length === 0 ? <p className="text-sm">Pago inicial pendiente: el cliente aún no lo ha iniciado.</p> : null}
          {payments.view.orders.map((o) => { const d = describeOrder(o); return <div key={o.id} className="rounded-lg border p-3 text-sm"><p className="font-semibold">{o.origin === "initial" ? "Pago inicial" : "Adicional"} · {d.label}</p><p>Importe asignado (Q): {formatClp(o.professionalAmountClp)}</p>{o.simulatedSettlementClp !== null ? <p>Cálculo de prueba (liquidación simulada): {formatClp(o.simulatedSettlementClp)}. No es una transferencia.</p> : null}</div>; })}
          {payments.view.unpaidExtras ? <p className="text-sm font-semibold">Hay adicionales aceptados pendientes de pago por el cliente.</p> : null}</>}
      </CardContent></Card>)}</div><nav aria-label="Páginas de pagos" className="mt-6 flex flex-wrap gap-5">{data.hasPrevious ? <Link href={`/tecnico/pagos?page=${data.page - 1}`}>Anterior</Link> : null}{data.hasNext ? <Link href={`/tecnico/pagos?page=${data.page + 1}`}>Siguiente</Link> : null}</nav></>}
  </TechnicianDashboardShell>;
}
