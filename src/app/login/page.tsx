import { SignInForm } from "@/components/auth/sign-in-form";
import { Logo } from "@/components/shared/logo";
import { TextLink } from "@/components/ui/text-link";
import { brand } from "@/design-system/brand";

export const metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <section className="hidden bg-inverse p-10 text-inverse-foreground lg:flex lg:flex-col lg:justify-between">
        <Logo inverse />
        <div>
          <h1 className="max-w-md text-balance text-5xl leading-[0.98]">Tus solicitudes y tus trabajos, en un solo lugar.</h1>
          <p className="mt-5 max-w-sm leading-7 text-inverse-muted">Ingresa para ver tus solicitudes, las propuestas que recibes y el estado de cada trabajo.</p>
        </div>
        <p className="text-sm text-inverse-muted">Cada cuenta ve solo lo que le corresponde según su rol.</p>
      </section>
      <section className="flex px-5 py-8 sm:px-10 lg:px-14 lg:py-14">
        <div className="mx-auto flex w-full max-w-md flex-col">
          <div className="flex items-center justify-between lg:hidden"><Logo /><TextLink href="/">Volver al inicio</TextLink></div>
          <h1 className="mt-10 text-balance text-4xl leading-tight lg:hidden">Bienvenido de vuelta</h1>
          <h2 className="hidden text-4xl leading-tight lg:mt-6 lg:block">Bienvenido de vuelta</h2>
          <p className="mt-3 leading-7 text-muted-foreground">Ingresa para continuar.</p>
          <div className="mt-8"><SignInForm /></div>
          <div className="mt-10 border-t border-border pt-5 text-sm">
            <p className="font-semibold">¿Primera vez en {brand.name}?</p>
            <div className="mt-1 flex flex-wrap gap-x-5"><TextLink href="/registro">Crear cuenta cliente</TextLink><TextLink href="/registro/tecnico">Postular como técnico</TextLink></div>
          </div>
        </div>
      </section>
    </main>
  );
}
