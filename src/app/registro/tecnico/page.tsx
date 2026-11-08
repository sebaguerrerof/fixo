import Link from "next/link";

import { TechnicianSignUpForm } from "@/components/auth/sign-up-forms";
import { Logo } from "@/components/shared/logo";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

export default async function TechnicianRegistrationPage() {
  const categories = await new TechnicianDirectoryService().listCategories();
  return <main className="min-h-screen bg-muted/45 p-4 sm:p-8"><div className="mx-auto w-full max-w-3xl"><div className="flex items-center justify-between"><Logo /><Link className="text-sm font-semibold text-primary hover:underline" href="/login">Ya tengo cuenta</Link></div><section className="mt-10 rounded-3xl border bg-background p-6 shadow-lift sm:p-10"><p className="text-sm font-semibold text-primary">Postulación técnica</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Haz crecer tu trabajo con Fixo</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Completa tu perfil para que el equipo lo revise. Solo los perfiles verificados aparecerán en el marketplace.</p><div className="mt-8"><TechnicianSignUpForm categories={categories} /></div><p className="mt-7 text-center text-sm text-muted-foreground">¿Buscas un servicio? <Link className="font-semibold text-primary hover:underline" href="/registro">Crea una cuenta cliente</Link></p></section></div></main>;
}
