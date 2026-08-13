import { ArrowUpRight, FileWarning, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const reports = [
  { id: "report-104", title: "Cobro distinto al acordado", technician: "Rodrigo Díaz", createdAt: "Hoy, 10:24", severity: "Alta", summary: "Cliente indica una diferencia entre la cotización y el cobro final." },
  { id: "report-101", title: "Solicitud de revisión de garantía", technician: "Diego Muñoz", createdAt: "Ayer, 16:08", severity: "Media", summary: "Cliente solicita antecedentes del servicio para gestionar una garantía." },
];

export default function AdminReportsPage() {
  return <AdminDashboardShell activeHref="/admin/reportes"><div><p className="text-sm font-semibold text-primary">Moderación y soporte</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Reportes abiertos</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Centraliza los antecedentes de cada incidente antes de aplicar una medida al perfil o trabajo involucrado.</p></div><div className="mt-7 grid gap-4">{reports.map((report) => <Card key={report.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="rounded-xl bg-rose-50 p-2 text-rose-600"><FileWarning className="size-5" /></span><div><CardTitle>{report.title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{report.technician} · {report.createdAt}</p></div></div><Badge variant={report.severity === "Alta" ? "danger" : "warning"}>{report.severity} prioridad</Badge></div></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{report.summary}</p><div className="mt-5 flex flex-wrap gap-2"><Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/admin/tecnicos">Revisar técnico <ArrowUpRight className="size-4" /></Link><button className={buttonVariants({ variant: "ghost", size: "sm" })} type="button"><ShieldAlert className="size-4" />Solicitar antecedentes</button></div></CardContent></Card>)}</div></AdminDashboardShell>;
}
