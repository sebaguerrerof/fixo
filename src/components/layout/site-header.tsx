import { Search, Siren } from "lucide-react";
import Link from "next/link";

import { AccountAccess } from "@/components/layout/account-access";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/tecnicos", label: "Buscar técnicos" },
  { href: "/como-funciona", label: "Cómo funciona" },
  { href: "/tecnico", label: "Soy técnico" },
];

export function SiteHeader() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Logo />
          <nav aria-label="Navegación principal" className="hidden items-center gap-1 rounded-full border border-border/70 bg-card/70 p-1 md:flex">
            {navigation.map((item) => <Link key={item.href} className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" href={item.href}>{item.label}</Link>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link aria-label="Buscar técnicos" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")} href="/tecnicos"><Search className="size-5" /></Link>
            <Link className={cn(buttonVariants({ variant: "emergency", size: "sm" }), "hidden sm:inline-flex")} href="/urgencia"><Siren className="size-4" />Urgencia</Link>
            <AccountAccess />
          </div>
        </div>
      </header>
      <MobileBottomNav />
    </>
  );
}
