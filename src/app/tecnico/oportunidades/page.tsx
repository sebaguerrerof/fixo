import { Clock3, MapPin, Send, Zap } from "lucide-react";
import Link from "next/link";

import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const opportunities = [
  { title: "Corte eléctrico parcial", district: "Ñuñoa", distance: "2,4 km", when: "Hace 4 min", urgency: true, description: "El segundo piso quedó sin energía después de encender una estufa." },
  { title: "Instalación de luminarias", district: "Providencia", distance: "3,1 km", when: "Hace 18 min", urgency: false, description: "Instalar cuatro luminarias y revisar un interruptor existente." },
  { title: "Revisión de enchufes", district: "La Reina", distance: "4,8 km", when: "Hace 33 min", urgency: false, description: "Dos enchufes hacen falso contacto en departamento residencial." },
];

export default function TechnicianOpportunitiesPage() {
  return <TechnicianDashboardShell activeHref="/tecnico/oportunidades"><div><p className="text-sm font-semibold text-primary">Oportunidades compatibles</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Nuevas solicitudes</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Revisa solo solicitudes relacionadas con tus especialidades, cobertura y disponibilidad declarada.</p></div><div className="mt-7 grid gap-4">{opportunities.map((opportunity) => <Card key={opportunity.title} className="motion-card"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><CardTitle>{opportunity.title}</CardTitle>{opportunity.urgency ? <Badge variant="danger"><Zap className="mr-1 size-3.5 fill-current" />Urgente</Badge> : <Badge variant="secondary">Servicio regular</Badge>}</div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1"><MapPin className="size-4" />{opportunity.district} · {opportunity.distance}</span><span className="inline-flex items-center gap-1"><Clock3 className="size-4" />{opportunity.when}</span></div></div></div></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{opportunity.description}</p><div className="mt-5 flex flex-wrap gap-2"><Link className={buttonVariants({ size: "sm" })} href="/tecnico/trabajos"><Send className="size-4" />Enviar cotización</Link><button className={buttonVariants({ variant: "outline", size: "sm" })} type="button">No disponible</button></div></CardContent></Card>)}</div></TechnicianDashboardShell>;
}
