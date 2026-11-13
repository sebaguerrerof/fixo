import { CalendarDays, MapPin, Siren } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ServiceRequest } from "@/domain/entities/service-request";

export function ServiceRequestCard({ request }: { readonly request: ServiceRequest }) {
  const dateLabel = request.scheduledFor
    ? new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.scheduledFor))
    : "Aún sin agendar";

  return (
    <Link className="block" href={`/cliente/solicitudes/${request.id}`}><Card className="motion-card"><CardContent className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2">{request.priority === "urgent" ? <Badge variant="danger"><Siren className="mr-1 size-3.5" />Urgencia</Badge> : <Badge variant="secondary">Servicio</Badge>}<StatusBadge status={request.status} /></div><h3 className="mt-3 font-bold">{request.title}</h3></div></div><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1.5"><MapPin className="size-4" />{request.locationLabel}</span><span>{request.categoryId} · {request.quoteCount ?? 0} cotizaciones</span><span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{dateLabel}</span></div></CardContent></Card></Link>
  );
}
