import { Search } from "lucide-react";
import Link from "next/link";

import { AccountAccess } from "@/components/layout/account-access";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { isDemoModeEnabled } from "@/config/demo-mode";

const navigation = [
  { href: "/tecnicos", label: "Buscar técnicos" },
  { href: "/como-funciona", label: "Cómo funciona" },
  { href: "/registro/tecnico", label: "Soy técnico" },
];

export function SiteHeader() {
  return (
    <>
      <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
        {isDemoModeEnabled() ? <p className="border-b border-warning-border bg-warning-soft px-4 py-2 text-center text-sm font-medium text-warning-soft-foreground">Modo demostración: datos de ejemplo, nada se guarda de verdad.</p> : null}
        <div className="container flex h-header items-center justify-between gap-4">
          <Logo />
          <nav aria-label="Navegación principal" className="hidden items-center gap-1 md:flex">
            {navigation.map((item) => <Link key={item.href} className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-fast hover:bg-muted hover:text-foreground" href={item.href}>{item.label}</Link>)}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link aria-label="Buscar técnicos" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")} href="/tecnicos"><Search className="size-5" /></Link>
            <ThemeToggle />
            <AccountAccess />
          </div>
        </div>
      </header>
      <MobileBottomNav />
    </>
  );
}
