import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";
import { formatClp } from "@/lib/utils";

type TechnicianPageParams = Promise<{ readonly slug: string }>;
export async function generateMetadata({ params }: { readonly params: TechnicianPageParams }): Promise<Metadata> {
  const technician = await new TechnicianDirectoryService().getPublicProfile((await params).slug);
  return { title: technician && ["active", "verified"].includes(technician.status) ? technician.displayName : "Técnico no encontrado" };
}
export default async function TechnicianProfilePage({ params }: { readonly params: TechnicianPageParams }) {
  const technician = await new TechnicianDirectoryService().getPublicProfile((await params).slug);
  if (!technician || !["active", "verified"].includes(technician.status)) notFound();
  return <><SiteHeader /><main className="container space-y-6 pb-24 pt-10"><Link className="font-semibold text-primary" href="/tecnicos">Volver al directorio</Link><div className="grid gap-6 lg:grid-cols-[1fr_320px]"><div className="space-y-6"><Card><CardContent className="space-y-6 p-6 sm:p-8"><div className="flex items-center gap-4"><Avatar name={technician.displayName} className="size-20" /><div><h1 className="text-3xl font-bold">{technician.displayName}</h1><Badge className="mt-3" variant="success">Perfil aprobado</Badge></div></div><p className="text-lg">{technician.headline}</p><p className="leading-7 text-muted-foreground">{technician.bio}</p><h2 className="font-bold">Especialidades declaradas</h2><div className="flex flex-wrap gap-2">{technician.specialties.map(specialty => <Badge key={specialty} variant="secondary">{specialty}</Badge>)}</div><p className="text-sm text-muted-foreground">Experiencia declarada por el técnico: {technician.yearsOfExperience} años.</p></CardContent></Card><EmptyState title="Evaluaciones aún no disponibles" description="Fixo todavía no publica reseñas de clientes en los perfiles." /></div><aside><Card><CardHeader><CardTitle>Información del servicio</CardTitle></CardHeader><CardContent className="space-y-5"><p>Valor referencial: <strong>{technician.startingPriceClp > 0 ? formatClp(technician.startingPriceClp) : "A convenir"}</strong></p><p className="text-sm text-muted-foreground">El valor fue declarado por el técnico. La contratación y los pagos en Fixo aún no están habilitados.</p><h2 className="font-semibold">Cobertura declarada</h2><p className="text-sm">{technician.coverageAreas.join(" · ") || technician.city}</p></CardContent></Card></aside></div></main></>;
}
