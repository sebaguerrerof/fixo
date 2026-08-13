import { CalendarDays, Clock3, MapPinned, Plus } from "lucide-react";

import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const schedule = [
  { time: "09:30", title: "Visita técnica", detail: "Providencia · Camila Rojas", status: "Finalizado" },
  { time: "16:30", title: "Revisión de tablero", detail: "Providencia · Antonia Pérez", status: "En curso" },
  { time: "18:30", title: "Cambio de protecciones", detail: "Ñuñoa · Felipe Herrera", status: "Agendado" },
];

export default function TechnicianSchedulePage() {
  return <TechnicianDashboardShell activeHref="/tecnico/agenda"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-primary">Organización personal</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Agenda y cobertura</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Visualiza tus compromisos y las zonas desde las que recibes oportunidades.</p></div><button className={buttonVariants({ variant: "outline" })} type="button"><Plus className="size-4" />Bloquear horario</button></div><div className="mt-7 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Hoy · Miércoles 13</CardTitle><CalendarDays className="size-5 text-primary" /></div></CardHeader><CardContent className="space-y-3">{schedule.map((item) => <div key={item.time} className="flex gap-4 rounded-xl border border-border/70 p-4"><p className="w-12 shrink-0 text-sm font-bold text-primary">{item.time}</p><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title}</p><Badge variant={item.status === "En curso" ? "info" : item.status === "Finalizado" ? "success" : "secondary"}>{item.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{item.detail}</p></div></div>)}</CardContent></Card><div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPinned className="size-5 text-primary" />Cobertura activa</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">Ñuñoa, Providencia y La Reina.</p><button className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-5`} type="button">Editar zonas</button></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="size-5 text-primary" />Disponibilidad</CardTitle></CardHeader><CardContent><div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-sm"><span className="font-semibold text-emerald-900">Recibiendo solicitudes</span><span className="size-2 rounded-full bg-emerald-500" /></div><p className="mt-3 text-sm leading-6 text-muted-foreground">Urgencias habilitadas de 08:00 a 22:00.</p></CardContent></Card></div></div></TechnicianDashboardShell>;
}
