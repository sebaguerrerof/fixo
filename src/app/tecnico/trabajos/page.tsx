import { CheckCircle2, ClipboardList, MapPin, MessageCircle, Navigation } from "lucide-react";
import Link from "next/link";

import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const jobs = [
  { title: "Revisión de tablero eléctrico", customer: "Antonia Pérez", location: "Providencia", status: "Técnico en camino", action: "Marcar llegada" },
  { title: "Cambio de protecciones", customer: "Felipe Herrera", location: "Ñuñoa", status: "Agendado hoy, 18:30", action: "Ver preparación" },
];

export default function TechnicianJobsPage() {
  return <TechnicianDashboardShell activeHref="/tecnico/trabajos"><div><p className="text-sm font-semibold text-primary">Seguimiento del servicio</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Trabajos activos</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Actualiza cada hito con claridad para mantener informado al cliente y conservar el historial del trabajo.</p></div><div className="mt-7 grid gap-5 lg:grid-cols-2">{jobs.map((job, index) => <Card key={job.title} className="overflow-hidden"><div className="h-1.5 bg-gradient-to-r from-primary via-cyan-500 to-sky-500" /><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{job.title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Cliente: {job.customer}</p></div><Badge variant={index === 0 ? "info" : "secondary"}>{job.status}</Badge></div></CardHeader><CardContent><p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-4" />{job.location}</p><div className="mt-5 rounded-xl bg-muted/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Siguiente hito</p><p className="mt-1 font-semibold">{index === 0 ? "Confirmar llegada al domicilio" : "Revisar antecedentes antes de salir"}</p></div><div className="mt-5 flex flex-wrap gap-2"><button className={buttonVariants({ size: "sm" })} type="button"><Navigation className="size-4" />{job.action}</button><Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/tecnico/trabajos"><MessageCircle className="size-4" />Abrir chat</Link></div></CardContent></Card>)}</div><Card className="mt-5"><CardContent className="flex items-start gap-3 p-5"><CheckCircle2 className="mt-0.5 size-5 text-success" /><div><h2 className="font-bold">Estados consistentes</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">La transición de un trabajo sigue una máquina de estados independiente de pagos y solicitudes, evitando cambios incoherentes.</p></div></CardContent></Card></TechnicianDashboardShell>;
}
