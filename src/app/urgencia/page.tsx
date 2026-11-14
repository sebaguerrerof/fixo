import { AlertTriangle, Siren } from "lucide-react";

import { SiteHeader } from "@/components/layout/site-header";
import { EmergencyWizard } from "@/components/emergencies/emergency-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { isDemoModeEnabled } from "@/config/demo-mode";
import { EmptyState } from "@/components/shared/empty-state";
import { brand } from "@/design-system/brand";

export default function EmergencyPage() {
  if (!isDemoModeEnabled()) return <><SiteHeader /><main className="container py-16"><EmptyState title="Atención de urgencias no disponible" description={`${brand.name} todavía no coordina atenciones urgentes. No envíes una emergencia por este medio.`} /></main></>;
  return <><SiteHeader /><main className="container flex min-h-[70vh] items-center justify-center pb-24 pt-12 md:pb-12"><Card className="w-full max-w-2xl animate-enter overflow-hidden"><div className="relative bg-gradient-to-br from-destructive via-destructive to-warning px-7 py-6 text-destructive-foreground"><div className="absolute inset-0 surface-grid opacity-15" /><div className="relative flex items-center gap-3"><span className="rounded-xl bg-destructive-foreground/15 p-2.5"><Siren className="size-6" /></span><div><p className="text-sm font-semibold text-destructive-foreground/80">Atención prioritaria</p><h1 className="text-2xl font-bold">Necesito ayuda urgente</h1></div></div></div><CardContent className="p-7 sm:p-10"><div className="mb-6 flex gap-3 rounded-2xl border border-warning-border bg-warning-soft p-4 text-warning-soft-foreground"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-soft-foreground" /><p className="text-sm leading-6">Si existe riesgo de gas, fuego, electricidad expuesta o una emergencia médica, no manipules la situación y contacta a los servicios de emergencia pertinentes.</p></div><EmergencyWizard isDemoMode={isDemoModeEnabled()} /></CardContent></Card></main></>;
}
