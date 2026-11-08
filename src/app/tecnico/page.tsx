import { ArrowRight, ChartNoAxesCombined, CircleDollarSign, Clock3, MapPinned, Star, Zap } from "lucide-react";
import Link from "next/link";

import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { Rating } from "@/components/shared/rating";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatClp } from "@/lib/utils";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { TechnicianDashboardService } from "@/services/technicians/technician-dashboard-service";

export default async function TechnicianDashboardPage() {
  const user = await getServerAuthenticatedUser();
  if (!user) return null;
  const overview = await new TechnicianDashboardService().getOverview(user.id);
  if (!overview) return null;
  const { technician, metrics } = overview;

  return (
    <TechnicianDashboardShell activeHref="/tecnico">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-primary">Perfil activo y verificado</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Buenos días, {technician.displayName.split(" ").at(0)}</h1><p className="mt-2 text-muted-foreground">Tus oportunidades y servicios, organizados en un solo lugar.</p></div><Link className={buttonVariants({ variant: "outline" })} href={`/tecnicos/${technician.slug}`}>Ver perfil público <ArrowRight className="size-4" /></Link></div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card><CardContent className="p-5"><Zap className="size-5 text-rose-600" /><p className="mt-4 text-2xl font-bold">{metrics.newOpportunities}</p><p className="mt-1 text-sm text-muted-foreground">nuevas oportunidades</p></CardContent></Card><Card><CardContent className="p-5"><Clock3 className="size-5 text-primary" /><p className="mt-4 text-2xl font-bold">{metrics.activeJobs}</p><p className="mt-1 text-sm text-muted-foreground">trabajos activos</p></CardContent></Card><Card><CardContent className="p-5"><CircleDollarSign className="size-5 text-primary" /><p className="mt-4 text-2xl font-bold">{formatClp(metrics.monthlyRevenueClp)}</p><p className="mt-1 text-sm text-muted-foreground">ingresos del mes</p></CardContent></Card><Card><CardContent className="p-5"><Star className="size-5 text-amber-500" /><p className="mt-4 text-2xl font-bold">{technician.metrics.rating.toFixed(1)}</p><p className="mt-1 text-sm text-muted-foreground">{technician.metrics.reviewCount} evaluaciones</p></CardContent></Card></div>
      <section className="mt-8 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]" id="oportunidades"><Card><CardHeader><CardTitle>Oportunidades para ti</CardTitle></CardHeader><CardContent><p className="rounded-xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Aún no tienes oportunidades asignadas. Las nuevas solicitudes compatibles aparecerán aquí.</p></CardContent></Card><Card id="perfil"><CardHeader><CardTitle>Tu reputación</CardTitle></CardHeader><CardContent><Rating rating={technician.metrics.rating} reviewCount={technician.metrics.reviewCount} /><p className="mt-4 text-sm leading-6 text-muted-foreground">{technician.metrics.completionRate}% de finalización y respuesta media en {technician.metrics.responseTimeMinutes} minutos.</p><Link className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" href={`/tecnicos/${technician.slug}`}>Abrir perfil <ArrowRight className="size-4" /></Link></CardContent></Card></section>
      <section className="mt-5 grid gap-5 lg:grid-cols-2" id="trabajos"><Card><CardHeader><CardTitle>Trabajo activo</CardTitle></CardHeader><CardContent><p className="rounded-xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">No tienes trabajos activos por el momento.</p></CardContent></Card><Card id="agenda"><CardHeader><CardTitle>Cobertura y disponibilidad</CardTitle></CardHeader><CardContent><div className="flex items-start gap-3"><span className="rounded-lg bg-secondary p-2 text-primary"><MapPinned className="size-5" /></span><p className="text-sm leading-6 text-muted-foreground">Recibes trabajos en {technician.coverageAreas.join(", ")}. Las reglas de radio y urgencias quedarán centralizadas para configurarlas desde la plataforma.</p></div></CardContent></Card></section>
      <section className="mt-5" id="pagos"><Card><CardContent className="flex items-start gap-3 p-5"><ChartNoAxesCombined className="mt-0.5 size-5 text-primary" /><div><h2 className="font-bold">Base preparada para pagos desacoplados</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Tu total, la comisión de plataforma y el payout técnico se modelarán por separado mediante un proveedor de pagos intercambiable.</p></div></CardContent></Card></section>
    </TechnicianDashboardShell>
  );
}
