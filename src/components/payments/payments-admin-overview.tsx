import Link from "next/link";
import type { PaymentAdminOverview, PendingAttemptView } from "@/domain/entities/payment-admin";
import { formatBasisPoints } from "@/domain/payments/presentation";
import { getPaymentRepository } from "@/repositories/repository-factory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { jobDate } from "@/components/jobs/job-labels";
import { FeePolicyForm } from "./fee-policy-form";
import { ReconcileButton } from "./reconcile-button";

const attemptLabels: Record<string, string> = { creating: "Creando en el proveedor", pending: "Pendiente de pago", reconciliation_required: "Requiere conciliación", quarantined: "En cuarentena", paid: "Pagado (coste Flow pendiente)" };
const reviewLabels: Record<string, string> = { provider_mismatch: "Discrepancia con el proveedor", duplicate_payment: "Pago duplicado", late_payment: "Pago tardío", job_cancelled: "Trabajo cancelado con pago", participant_suspended: "Participante suspendido", cancellation_pending: "Cancelación pendiente", manual_review: "Revisión manual" };
const reschedulable = (a: PendingAttemptView) => ["creating", "pending", "reconciliation_required"].includes(a.state) || (a.state === "paid" && a.costPending);

/** Moderators read; only a superadmin sees the forms/buttons. A re-check only schedules a provider query and can never impose "paid". */
export async function PaymentsAdminOverview({ superadmin }: { readonly superadmin: boolean }) {
  let data: PaymentAdminOverview | null = null;
  try { data = await getPaymentRepository().getAdminOverview(); } catch { data = null; }
  if (!data) return <Card><CardHeader><CardTitle>Pagos (Sandbox)</CardTitle></CardHeader><CardContent className="space-y-2"><p className="font-semibold">Resumen de pagos no disponible</p><p className="text-sm text-muted-foreground">No pudimos cargarlo. Esto no significa que no existan pendientes ni discrepancias.</p></CardContent></Card>;
  const { policy, history, pending, reviews, quarantinedInbox } = data;
  return <div className="grid min-w-0 gap-5 xl:grid-cols-2">
    <Card><CardHeader><CardTitle>Comisión de Fixo</CardTitle></CardHeader><CardContent className="space-y-4 break-words">
      {policy ? <><p className="text-2xl font-bold">{formatBasisPoints(policy.feeBasisPoints)} <span className="text-base font-normal text-muted-foreground">· versión {policy.version}</span></p>
        <p className="text-sm">El cliente paga el importe del profesional (Q) más esta comisión (F). El coste de Flow lo absorbe Fixo dentro de F y no se descuenta al profesional.</p>
        {superadmin ? <FeePolicyForm version={policy.version} basisPoints={policy.feeBasisPoints} /> : <p className="text-sm text-muted-foreground">Sólo un superadministrador puede modificarla.</p>}</> : <p>Política no disponible.</p>}
      <h3 className="font-semibold">Historial</h3>
      <ol className="space-y-2 text-sm">{history.map((h) => <li key={h.version} className="rounded-lg border p-2"><p className="font-semibold">Versión {h.version} · {formatBasisPoints(h.feeBasisPoints)}</p><p>{jobDate(h.createdAt)} · {h.authorName ?? "Política inicial"}</p><p className="break-words">{h.reason}</p></li>)}</ol>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Conciliación pendiente</CardTitle></CardHeader><CardContent className="space-y-3 break-words">
      <p className="text-sm text-muted-foreground">Sólo una consulta autenticada al proveedor acredita un pago. Reconsultar programa una verificación; no permite marcar un pago como pagado.</p>
      {quarantinedInbox > 0 ? <p className="font-semibold">Notificaciones en cuarentena: {quarantinedInbox}</p> : null}
      {pending.length ? <ul className="space-y-3">{pending.map((a) => <li key={a.attemptId} className="space-y-1 rounded-lg border p-3 text-sm">
        <p className="font-semibold">{attemptLabels[a.state] ?? a.state}{a.exhausted ? " · consultas agotadas" : ""}</p>
        <p><Link href={`/admin/trabajos/${a.jobId}`} className="text-primary underline">Ver trabajo</Link></p>
        <p>Último control: {a.lastCheckedAt ? jobDate(a.lastCheckedAt) : "sin controles"} · Próximo: {a.nextCheckAt ? jobDate(a.nextCheckAt) : "sin programar"} · Consultas: {a.checkCount}</p>
        {a.errorCode ? <p>Código técnico: {a.errorCode}</p> : null}
        {superadmin && reschedulable(a) ? <ReconcileButton attemptId={a.attemptId} label={a.state === "paid" ? "Reconsultar coste Flow" : "Solicitar nueva verificación"} /> : null}</li>)}</ul> : <p>No hay intentos pendientes de conciliación.</p>}
    </CardContent></Card>
    <Card className="xl:col-span-2"><CardHeader><CardTitle>Discrepancias y revisiones</CardTitle></CardHeader><CardContent className="space-y-3 break-words">
      {reviews.length ? <ul className="space-y-3">{reviews.map((r) => <li key={r.orderId} className="rounded-lg border p-3 text-sm"><p className="font-semibold">{reviewLabels[r.reason] ?? r.reason}</p><p>Orden {r.status === "paid" ? "pagada" : "pendiente"} · actualizada {jobDate(r.updatedAt)}</p><p><Link href={`/admin/trabajos/${r.jobId}`} className="text-primary underline">Ver trabajo</Link></p></li>)}</ul> : <p>No hay órdenes en revisión.</p>}
      <p className="text-sm text-muted-foreground">No hay resolución automática: ninguna revisión solicita devoluciones ni libera el trabajo. Las acciones de resolución financiera quedan fuera de este sprint.</p>
    </CardContent></Card>
  </div>;
}
