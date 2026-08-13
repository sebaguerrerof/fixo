import { ArrowRight, ClipboardPenLine, Sparkles } from "lucide-react";
import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RequestServicePage() {
  return <><SiteHeader /><main className="container flex min-h-[70vh] items-center justify-center pb-24 pt-12 md:pb-12"><Card className="w-full max-w-2xl animate-enter"><CardContent className="p-7 sm:p-10"><Badge variant="info">Próximo paso</Badge><span className="mt-5 flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><ClipboardPenLine className="size-6" /></span><h1 className="mt-5 text-3xl font-bold tracking-tight">Solicitud de servicio</h1><p className="mt-3 max-w-xl leading-7 text-muted-foreground">La plataforma ya tiene los contratos de solicitud, cotización, estados y orientación asistida. El siguiente avance conectará este espacio al flujo completo de creación y matching.</p><div className="mt-7 rounded-2xl border border-primary/15 bg-primary/5 p-4"><div className="flex items-center gap-2 font-semibold text-primary"><Sparkles className="size-4" />Orientación desacoplada</div><p className="mt-2 text-sm leading-6 text-muted-foreground">La interfaz consume una salida estructurada y validada; nunca se comunica directamente con un proveedor de IA.</p></div><div className="mt-7 flex flex-wrap gap-3"><Link className={buttonVariants({ size: "lg" })} href="/tecnicos">Buscar técnico <ArrowRight className="size-4" /></Link><Link className={buttonVariants({ variant: "outline", size: "lg" })} href="/cliente">Volver a mi panel</Link></div></CardContent></Card></main></>;
}
