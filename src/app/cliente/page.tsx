import { ArrowRight, ClipboardList, CreditCard, Plus, Siren } from "lucide-react";
import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ServiceRequestCard } from "@/components/service-requests/service-request-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { CustomerDashboardService } from "@/services/customer/customer-dashboard-service";

const customerNavigation = [
  { href: "/cliente", label: "Resumen" },
  { href: "/cliente#solicitudes", label: "Mis solicitudes" },
  { href: "/cliente#historial", label: "Historial" },
  { href: "/cliente#favoritos", label: "Favoritos" },
  { href: "/cliente#pagos", label: "Pagos" },
];

export default async function CustomerDashboardPage() {
  const user = await getServerAuthenticatedUser();
  if (!user) return null;
  const overview = await new CustomerDashboardService().getOverview(user.id);
  const userName = user.name;

  return (
    <DashboardShell activeHref="/cliente" requiredRole="customer" roleLabel="Espacio cliente" userName={userName} navigation={customerNavigation}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-primary">Hola, {userName.split(" ").at(0)}</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Todo para cuidar tu hogar</h1><p className="mt-2 text-muted-foreground">Revisa solicitudes, propuestas y servicios en curso.</p></div><div className="flex flex-wrap gap-2"><Link className={buttonVariants({ variant: "emergency" })} href="/urgencia"><Siren className="size-4" />Urgencia</Link><Link className={buttonVariants()} href="/solicitar"><Plus className="size-4" />Solicitar servicio</Link></div></div>
      <div className="mt-7 grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><ClipboardList className="size-5 text-primary" /><p className="mt-4 text-2xl font-bold">{overview.activeRequests.length}</p><p className="mt-1 text-sm text-muted-foreground">solicitudes activas</p></CardContent></Card></div>
      <section className="mt-8" id="solicitudes"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Tus servicios activos</h2><p className="mt-1 text-sm text-muted-foreground">Aquí verás el avance de cada trabajo.</p></div><Badge variant="info">Actualizado</Badge></div><div className="mt-4 grid gap-4 lg:grid-cols-2">{overview.activeRequests.map((request) => <ServiceRequestCard key={request.id} request={request} />)}</div></section>
      <section className="mt-8 grid gap-5 lg:grid-cols-2" id="historial"><Card><CardHeader><CardTitle>Próximo paso</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">Cuando recibas una cotización, podrás revisarla desde este espacio.</p><Link className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" href="/solicitar">Crear una solicitud <ArrowRight className="size-4" /></Link></CardContent></Card><Card id="pagos"><CardHeader><CardTitle>Pagos</CardTitle></CardHeader><CardContent><div className="flex items-start gap-3"><span className="rounded-lg bg-secondary p-2 text-primary"><CreditCard className="size-5" /></span><p className="text-sm leading-6 text-muted-foreground">Los pagos se mostrarán aquí cuando el servicio de cobro esté habilitado.</p></div></CardContent></Card></section>
    </DashboardShell>
  );
}
