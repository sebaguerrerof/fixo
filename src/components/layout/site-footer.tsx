import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import { brand } from "@/design-system/brand";

const columns = [
  { title: "Explorar", links: [{ href: "/tecnicos", label: "Buscar técnicos" }, { href: "/como-funciona", label: "Cómo funciona" }, { href: "/solicitar", label: "Pedir un servicio" }] },
  { title: "Para técnicos", links: [{ href: "/registro/tecnico", label: "Postular como técnico" }, { href: "/login", label: "Ingresar" }] },
  { title: "Legal", links: [{ href: "/terminos", label: "Términos de uso" }, { href: "/privacidad", label: "Privacidad" }] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-card/40 pb-28 md:pb-0">
      <div className="container grid gap-10 py-12 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div className="space-y-3"><Logo /><p className="max-w-xs text-sm leading-6 text-muted-foreground">{brand.tagline}. Servicios a domicilio en Chile con perfiles claros y precios acordados antes de empezar.</p></div>
        {columns.map((column) => (
          <nav aria-label={column.title} key={column.title}>
            <p className="text-sm font-semibold">{column.title}</p>
            <ul className="mt-2">{column.links.map((link) => <li key={link.href}><Link className="flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground" href={link.href}>{link.label}</Link></li>)}</ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border/70"><div className="container flex flex-col gap-1 py-5 text-xs text-muted-foreground sm:flex-row sm:justify-between"><p>© {new Date().getFullYear()} {brand.name}. Todos los derechos reservados.</p><p>{brand.domain}</p></div></div>
    </footer>
  );
}
