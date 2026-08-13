import { BadgeCheck, FileSearch } from "lucide-react";
import Link from "next/link";

import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminDashboardService } from "@/services/admin/admin-dashboard-service";

export default async function AdminVerificationsPage() {
  const { technicians } = await new AdminDashboardService().getOverview();
  const pending = technicians.filter((technician) => ["pending_verification", "needs_information"].includes(technician.status));
  return <AdminDashboardShell activeHref="/admin/verificaciones"><div><p className="text-sm font-semibold text-primary">Control de confianza</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Verificaciones pendientes</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Revisa cada perfil antes de habilitarlo para recibir oportunidades dentro de la plataforma.</p></div><div className="mt-7 grid gap-4">{pending.map((technician) => <Card key={technician.id}><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><Avatar name={technician.displayName} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{technician.displayName}</h2><StatusBadge status={technician.status} /></div><p className="mt-1 text-sm text-muted-foreground">{technician.headline}</p><div className="mt-3 flex flex-wrap gap-2"><Badge variant="secondary">Documento de identidad</Badge><Badge variant="secondary">Especialidad declarada</Badge><Badge variant="secondary">Cobertura</Badge></div></div><Link className={buttonVariants({ variant: "outline" })} href={`/admin/tecnicos/${technician.slug}`}><FileSearch className="size-4" />Abrir revisión</Link></CardContent></Card>)}{pending.length === 0 ? <Card><CardContent className="py-14 text-center"><BadgeCheck className="mx-auto size-8 text-success" /><h2 className="mt-4 font-bold">No hay verificaciones pendientes</h2><p className="mt-2 text-sm text-muted-foreground">Todos los perfiles disponibles ya fueron revisados.</p></CardContent></Card> : null}</div></AdminDashboardShell>;
}
