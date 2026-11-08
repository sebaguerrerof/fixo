import { ClipboardPenLine } from "lucide-react";
import Link from "next/link";

import { CreateServiceRequestForm } from "@/components/service-requests/create-service-request-form";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

export default async function RequestServicePage() {
  const categories = await new TechnicianDirectoryService().listCategories();
  return <><SiteHeader /><main className="container pb-24 pt-12 md:pb-12"><Card className="mx-auto w-full max-w-2xl animate-enter"><CardContent className="p-7 sm:p-10"><span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><ClipboardPenLine className="size-6" /></span><h1 className="mt-5 text-3xl font-bold tracking-tight">Solicitud de servicio</h1><p className="mt-3 max-w-xl leading-7 text-muted-foreground">Cuéntanos qué necesitas y dónde. Podrás revisar el avance desde tu espacio de cliente.</p><div className="mt-8"><CreateServiceRequestForm categories={categories} /></div><div className="mt-7 flex flex-wrap gap-3"><Link className={buttonVariants({ variant: "outline", size: "lg" })} href="/cliente">Volver a mi panel</Link></div></CardContent></Card></main></>;
}
