import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { buttonVariants } from "@/components/ui/button";
import { TechnicianDetailManagement } from "@/features/admin/technician-detail-management";
import { AdminDashboardService } from "@/services/admin/admin-dashboard-service";

type AdminTechnicianParams = Promise<{ readonly slug: string }>;

export default async function AdminTechnicianDetailPage({ params }: { readonly params: AdminTechnicianParams }) {
  const { slug } = await params;
  const { technicians } = await new AdminDashboardService().getOverview();
  const technician = technicians.find((item) => item.slug === slug);
  if (!technician) notFound();

  return <AdminDashboardShell activeHref="/admin/tecnicos"><Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/admin/tecnicos"><ArrowLeft className="size-4" />Volver a técnicos</Link><div className="mt-5"><TechnicianDetailManagement initialTechnician={technician} /></div></AdminDashboardShell>;
}
