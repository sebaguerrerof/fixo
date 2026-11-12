import type { JobPaymentOrderView, JobPaymentsView } from "@/domain/entities/job-payment";
import { describeOrder, initialOrder, jobAcceptsNewPayments, orderCanBePaid, orderForExtra, previewTerms } from "@/domain/payments/presentation";
import { loadJobPayments } from "@/services/payments/payment-read-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatClp } from "@/lib/utils";
import { jobDate, jobLabels } from "@/components/jobs/job-labels";
import { PaymentCheckoutButton } from "./payment-checkout-button";
import { ExtraChargeResponse } from "./extra-charge-response";
import { ExtraChargeProposalForm } from "./extra-charge-proposal-form";

type Role = "customer" | "technician" | "admin";
interface Props { readonly jobId: string; readonly jobStatus: string; readonly role: Role; readonly snapshotPriceClp: number | null }

const toneClass = { ok: "text-green-700 dark:text-green-400", pending: "text-amber-700 dark:text-amber-400", warn: "text-red-700 dark:text-red-400" } as const;

function Status({ order }: { readonly order: JobPaymentOrderView }) {
  const d = describeOrder(order);
  return <><p className={`font-semibold ${toneClass[d.tone]}`}>{d.label}{order.paidAt ? ` · ${jobDate(order.paidAt)}` : ""}</p>{d.hint ? <p className="text-sm text-muted-foreground">{d.hint}</p> : null}</>;
}

/** Amounts shown to the technician are Q only (the DB nulls F/T for them); Q is "asignado", never a transfer made. */
function Amounts({ order, role }: { readonly order: JobPaymentOrderView; readonly role: Role }) {
  return <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
    <dt>{role === "technician" ? "Importe asignado al profesional (Q)" : "Importe del profesional (Q)"}</dt><dd className="text-right">{formatClp(order.professionalAmountClp)}</dd>
    {order.platformFeeClp !== null ? <><dt>Comisión Fixo (F)</dt><dd className="text-right">{formatClp(order.platformFeeClp)}</dd></> : null}
    {order.totalClp !== null ? <><dt className="font-semibold">Total cliente (T)</dt><dd className="text-right font-semibold">{formatClp(order.totalClp)}</dd></> : null}
  </dl>;
}

function Admin({ order }: { readonly order: JobPaymentOrderView }) {
  return <ul className="space-y-1 text-sm">
    {order.reviewReason ? <li>Motivo de revisión: {order.reviewReason}</li> : null}
    <li>Coste Flow: {order.flowCostClp === null ? "pendiente de conciliación" : formatClp(order.flowCostClp)}</li>
    <li>Margen de plataforma (F − G): {order.marginStatus === "confirmed" && order.platformMarginClp !== null ? formatClp(order.platformMarginClp) : "pendiente de conciliación"}</li>
  </ul>;
}

function Order({ order, label, role, jobId, canPay }: { readonly order: JobPaymentOrderView; readonly label: string; readonly role: Role; readonly jobId: string; readonly canPay: boolean }) {
  const payable = role === "customer" && canPay && orderCanBePaid(order) && order.totalClp !== null && order.platformFeeClp !== null;
  return <section className="space-y-3 rounded-lg border p-3"><h3 className="font-semibold">{label}</h3><Status order={order} /><Amounts order={order} role={role} />
    {role === "admin" ? <Admin order={order} /> : null}
    {order.simulatedSettlementClp !== null && role !== "customer" ? <p className="text-sm"><strong>Cálculo de prueba (liquidación simulada):</strong> {formatClp(order.simulatedSettlementClp)}. No es una transferencia ni un saldo disponible para retiro.</p> : null}
    {payable ? <PaymentCheckoutButton jobId={jobId} extraChargeId={order.extraChargeId} policyVersion={order.policyVersion} professionalAmountClp={order.professionalAmountClp} platformFeeClp={order.platformFeeClp!} totalClp={order.totalClp!} /> : null}
  </section>;
}

export async function JobPaymentsPanel({ jobId, jobStatus, role, snapshotPriceClp }: Props) {
  const loaded = await loadJobPayments(jobId);
  if (loaded.status === "unavailable") return <Card><CardHeader><CardTitle>Pagos</CardTitle></CardHeader><CardContent className="space-y-2"><p className="font-semibold">Pagos no disponibles</p><p className="text-sm text-muted-foreground">No pudimos cargar el estado de los pagos. No se asume que haya o no deudas. La adjudicación y el cierre operacional no acreditan un cobro.</p></CardContent></Card>;
  // Sandbox payments exist only for authorized synthetic accounts: everyone else sees nothing (no breakdown, no button) unless an order already exists (history).
  if (!loaded.view.sandboxEnabled && loaded.view.orders.length === 0 && loaded.view.extras.length === 0) return null;
  const view: JobPaymentsView = loaded.view, initial = initialOrder(view), acceptsPayments = jobAcceptsNewPayments(jobStatus), canPay = view.sandboxEnabled && acceptsPayments, preview = previewTerms(snapshotPriceClp, view.policy);
  // UI hint only: the DB requires the assigned enabled professional, paid initial payment, a live job and fewer than 3 pending proposals.
  const canPropose = acceptsPayments && view.paymentState === "paid" && ["scheduled", "ready", "in_progress", "completion_reported"].includes(jobStatus) && view.extras.filter((x) => x.state === "proposed").length < 3;
  return <Card><CardHeader><CardTitle>Pagos (Sandbox)</CardTitle></CardHeader><CardContent className="space-y-4 break-words">
    <p className="rounded-lg bg-muted p-3 text-sm">Entorno de prueba: no se realizan cobros reales. Sólo una verificación autenticada con el proveedor acredita un pago; volver desde el checkout no lo confirma.</p>
    {initial ? <Order order={initial} label="Pago inicial" role={role} jobId={jobId} canPay={canPay} />
      : <section className="space-y-3 rounded-lg border p-3"><h3 className="font-semibold">Pago inicial</h3><p className="font-semibold text-amber-700 dark:text-amber-400">Pendiente de pago</p>
        {snapshotPriceClp !== null ? <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm"><dt>{role === "technician" ? "Importe asignado al profesional (Q)" : "Importe del profesional (Q)"}</dt><dd className="text-right">{formatClp(snapshotPriceClp)}</dd>{preview && role !== "technician" ? <><dt>Comisión Fixo (F)</dt><dd className="text-right">{formatClp(preview.platformFeeClp)}</dd><dt className="font-semibold">Total cliente (T)</dt><dd className="text-right font-semibold">{formatClp(preview.customerTotalClp)}</dd></> : null}</dl> : null}
        {role === "customer" && canPay && preview && view.policy ? <PaymentCheckoutButton jobId={jobId} extraChargeId={null} policyVersion={view.policy.version} professionalAmountClp={preview.professionalAmountClp} platformFeeClp={preview.platformFeeClp} totalClp={preview.customerTotalClp} /> : null}
        {role === "customer" && !preview ? <p className="text-sm text-muted-foreground">No pudimos calcular el desglose. Actualiza la página.</p> : null}</section>}
    {view.extras.length ? <div className="space-y-3"><h3 className="font-semibold">Adicionales</h3>{view.extras.map((x) => {
      const order = orderForExtra(view, x.id), terms = previewTerms(x.amountClp, view.policy);
      return <section key={x.id} className="space-y-3 rounded-lg border p-3"><p className="break-words font-semibold">{x.concept}</p><p className="text-sm">{jobLabels[x.state] ?? x.state} · {formatClp(x.amountClp)} (Q)</p>
        {x.state === "proposed" ? (role === "customer" && canPay && terms && view.policy
          ? <ExtraChargeResponse jobId={jobId} extraChargeId={x.id} policyVersion={view.policy.version} professionalAmountClp={terms.professionalAmountClp} platformFeeClp={terms.platformFeeClp} totalClp={terms.customerTotalClp} />
          : <p className="text-sm text-muted-foreground">Esperando la respuesta del cliente. Una propuesta no es una deuda.</p>) : null}
        {order ? <Order order={order} label="Pago del adicional" role={role} jobId={jobId} canPay={canPay} /> : null}</section>;
    })}</div> : null}
    {role === "technician" && canPropose ? <ExtraChargeProposalForm jobId={jobId} /> : null}
    {view.unpaidExtras ? <p className="text-sm font-semibold">Hay importes aceptados pendientes de pago: el cierre del trabajo permanece bloqueado hasta verificarlos.</p> : null}
  </CardContent></Card>;
}
