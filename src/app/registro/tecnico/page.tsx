import { TechnicianSignUpForm } from "@/components/auth/sign-up-forms";
import { Logo } from "@/components/shared/logo";
import { TextLink } from "@/components/ui/text-link";
import { brand } from "@/design-system/brand";
import { TechnicianDirectoryService } from "@/services/technicians/technician-directory-service";

export const metadata = { title: "Postular como técnico" };

export default async function TechnicianRegistrationPage() {
  const categories = await new TechnicianDirectoryService().listCategories();
  return (
    <main className="min-h-screen bg-muted/50 p-3 sm:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between"><Logo /><TextLink href="/login">Ya tengo cuenta</TextLink></div>
        <section className="mt-6 rounded-3xl border border-border bg-background p-5 shadow-lift sm:mt-10 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Postulación técnica</p>
          <h1 className="mt-1 text-balance text-3xl font-semibold tracking-tight">Haz crecer tu trabajo con {brand.name}</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Completa tu perfil para que el equipo lo revise. Solo los perfiles verificados aparecerán en el directorio.</p>
          <div className="mt-8"><TechnicianSignUpForm categories={categories} /></div>
          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-2 text-center text-sm text-muted-foreground">¿Buscas un servicio? <TextLink href="/registro">Crea tu cuenta de cliente</TextLink></p>
        </section>
      </div>
    </main>
  );
}
