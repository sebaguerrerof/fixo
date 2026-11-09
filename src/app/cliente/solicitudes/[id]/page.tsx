import { notFound } from "next/navigation";
import { isDemoModeEnabled } from "@/config/demo-mode";
import { CancelRequestButton, RequestPhotoForm } from "@/components/service-requests/request-actions";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { asRecords, asString } from "@/repositories/supabase/supabase-helpers";

import { AcceptQuoteButton } from "@/components/service-requests/accept-quote-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Rating } from "@/components/shared/rating";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Quote } from "@/domain/entities/quote";
import type { Technician } from "@/domain/entities/technician";
import { formatClp } from "@/lib/utils";
import { getTechnicianRepository, getJobRepository, getServiceRequestRepository, getQuoteRepository } from "@/repositories/repository-factory";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";

const dateFormatter = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" });

const customerNavigation = [
  { href: "/cliente", label: "Resumen" },
  { href: "/cliente#solicitudes", label: "Mis solicitudes" },
  { href: "/cliente#pagos", label: "Pagos" },
];

function QuoteCard({ quote, technician, canAccept }: { readonly quote: Quote; readonly technician: Technician | null; readonly canAccept: boolean }) {
  return <Card key={quote.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{technician?.displayName ?? "Técnico"}</CardTitle>{technician ? <div className="mt-1"><Rating rating={technician.metrics.rating} reviewCount={technician.metrics.reviewCount} /></div> : null}</div><div className="text-right"><p className="text-2xl font-bold">{formatClp(quote.priceClp)}</p><StatusBadge status={quote.status} /></div></div></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{quote.description}</p><dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Desglose CLP</dt><dd className="text-muted-foreground">Mano de obra: {formatClp(quote.laborClp ?? quote.priceClp)} · materiales: {formatClp(quote.materialsClp ?? 0)} · diagnóstico: {formatClp(quote.diagnosticClp ?? 0)}</dd></div><div><dt className="font-semibold">Tiempo estimado</dt><dd className="text-muted-foreground">{quote.estimatedDuration}</dd></div><div><dt className="font-semibold">Disponible desde</dt><dd className="text-muted-foreground">{dateFormatter.format(new Date(quote.availableDate))}</dd></div><div><dt className="font-semibold">Válida hasta</dt><dd className="text-muted-foreground">{dateFormatter.format(new Date(quote.expiresAt))}</dd></div><div><dt className="font-semibold">Visita de diagnóstico</dt><dd className="text-muted-foreground">{quote.diagnosticVisit ? "Sí" : "No"}</dd></div>{quote.materialsIncluded ? <div className="sm:col-span-2"><dt className="font-semibold">Materiales incluidos</dt><dd className="text-muted-foreground">{quote.materialsIncluded}</dd></div> : null}{quote.materialsNotIncluded ? <div className="sm:col-span-2"><dt className="font-semibold">Materiales no incluidos</dt><dd className="text-muted-foreground">{quote.materialsNotIncluded}</dd></div> : null}{quote.conditions ? <div className="sm:col-span-2"><dt className="font-semibold">Condiciones</dt><dd className="text-muted-foreground">{quote.conditions}</dd></div> : null}</dl>{canAccept ? <div className="mt-5"><AcceptQuoteButton revision={quote.revision ?? 1} quoteId={quote.id} serviceRequestId={quote.serviceRequestId} /></div> : null}</CardContent></Card>;
}

export default async function CustomerServiceRequestDetailPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getServerAuthenticatedUser();
  if (!user) return null;

  const request = await getServiceRequestRepository().findById(id);
  if (!request || request.customerId !== user.id) notFound();
  const quotes = await getQuoteRepository().listByServiceRequest(id);

  const technicians = await Promise.all(quotes.map((quote) => getTechnicianRepository().findByUserId(quote.technicianId)));
  const technicianByQuote = new Map(quotes.map((quote, index) => [quote.id, technicians[index]]));
  const visibleQuotes = quotes.filter((quote) => quote.status !== "draft");
  const jobRepository = getJobRepository();
  const job = jobRepository.findByServiceRequest ? await jobRepository.findByServiceRequest(id) : (await jobRepository.listForCustomer(user.id)).find(j => j.serviceRequestId === id);
  const canCancel = ["submitted", "matching", "receiving_quotes"].includes(request.status);
  const photos = isDemoModeEnabled() ? [] : asRecords((await (await getSupabaseServerClient()).rpc("marketplace_photos", { request_id: id })).data);

  return <DashboardShell activeHref="/cliente" navigation={customerNavigation} requiredRole="customer" roleLabel="Espacio cliente" userName={user.name}>
    <div><p className="text-sm font-semibold text-primary">Solicitud</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{request.title}</h1><p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><StatusBadge status={request.status} />{request.locationLabel}</p><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">{request.description}</p></div>
    {request.details ? <Card className="mt-6"><CardHeader><CardTitle>Datos privados</CardTitle></CardHeader><CardContent className="space-y-2 break-words"><p>{request.details.address || "Sin dirección exacta registrada"}</p><p>{request.details.reference}</p><p>{request.details.preferred_slot}</p><p>{request.details.complementary_info}</p>{photos.map((photo, i) => <a className="mr-4 inline-block text-primary underline" key={asString(photo.id)} href={`/api/service-requests/${id}/photos?photo=${asString(photo.id)}`} target="_blank" rel="noreferrer">Fotografía {i + 1}</a>)}{canCancel && photos.length < 5 ? <RequestPhotoForm id={id} /> : null}</CardContent></Card> : null}
    {canCancel && !isDemoModeEnabled() ? <div className="mt-5"><CancelRequestButton id={id} revision={request.revision ?? 1} /></div> : null}
    {job ? <Card className="mt-6"><CardHeader><CardTitle>Trabajo adjudicado</CardTitle></CardHeader><CardContent><StatusBadge status={job.status} /><p className="mt-3">{formatClp(job.snapshot?.priceClp ?? 0)} · Condiciones guardadas al seleccionar la propuesta.</p><p className="mt-2 text-sm text-muted-foreground">Pago no habilitado. La ejecución del trabajo permanece pendiente.</p><p className="mt-2 text-sm">{job.snapshot?.conditions}</p></CardContent></Card> : null}
    <section className="mt-8"><h2 className="text-xl font-bold">Cotizaciones recibidas</h2>{visibleQuotes.length === 0 ? <Card className="mt-4"><CardContent className="p-6 text-sm text-muted-foreground">Todavía no recibes cotizaciones para esta solicitud.</CardContent></Card> : <div className="mt-4 grid gap-4">{visibleQuotes.map((quote) => <QuoteCard canAccept={request.status === "receiving_quotes" && quote.status === "submitted" && Date.parse(quote.expiresAt) > Date.now()} key={quote.id} quote={quote} technician={technicianByQuote.get(quote.id) ?? null} />)}</div>}</section>
    <section className="mt-8"><h2 className="text-xl font-bold">Historial</h2><ol className="mt-3 space-y-2 text-sm">{request.history?.map(event => <li className="rounded-xl border p-3" key={event.id}><span>{historyLabel(event.action)}</span><span className="ml-3 text-muted-foreground">{dateFormatter.format(new Date(event.created_at))}</span></li>)}</ol></section>
  </DashboardShell>;
}

function historyLabel(action: string): string { return ({ request_published: "Solicitud publicada", request_cancelled: "Solicitud cancelada", quote_saved: "Borrador guardado", quote_submitted: "Cotización enviada", quote_withdrawn: "Cotización retirada", quote_accepted: "Cotización seleccionada y trabajo adjudicado", photo_added: "Fotografía agregada" } as Record<string, string>)[action] ?? "Estado actualizado"; }
