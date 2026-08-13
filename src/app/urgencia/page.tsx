import { AlertTriangle, ArrowRight, Siren } from "lucide-react";
import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function EmergencyPage() {
  return <><SiteHeader /><main className="container flex min-h-[70vh] items-center justify-center pb-24 pt-12 md:pb-12"><Card className="w-full max-w-2xl animate-enter overflow-hidden"><div className="relative bg-gradient-to-br from-rose-600 via-rose-600 to-orange-600 px-7 py-6 text-white"><div className="absolute inset-0 surface-grid opacity-15" /><div className="relative flex items-center gap-3"><span className="rounded-xl bg-white/15 p-2.5"><Siren className="size-6" /></span><div><p className="text-sm font-semibold text-rose-100">Atención prioritaria</p><h1 className="text-2xl font-bold">Necesito ayuda urgente</h1></div></div></div><CardContent className="p-7 sm:p-10"><h2 className="text-xl font-bold">El flujo de urgencias está modelado desde el inicio</h2><p className="mt-3 leading-7 text-muted-foreground">La siguiente etapa conectará orientación, ubicación, matching, broadcasting y aceptación atómica para que un solo técnico pueda adjudicarse una urgencia.</p><div className="mt-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" /><p className="text-sm leading-6">Si existe riesgo de gas, fuego, electricidad expuesta o una emergencia médica, no manipules la situación y contacta a los servicios de emergencia pertinentes.</p></div><Link className={`${buttonVariants({ variant: "emergency", size: "lg" })} mt-7`} href="/tecnicos">Ver técnicos disponibles <ArrowRight className="size-4" /></Link></CardContent></Card></main></>;
}
