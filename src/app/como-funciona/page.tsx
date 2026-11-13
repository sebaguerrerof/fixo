import { CheckCircle2, MessageSquareMore, SearchCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  { icon: SearchCheck, title: "Busca o describe", text: "Elige un rubro para explorar los perfiles que estén publicados." },
  { icon: MessageSquareMore, title: "Consulta perfiles", text: "Revisa la información de experiencia y cobertura declarada por cada profesional." },
  { icon: ShieldCheck, title: "Postula como técnico", text: "Registra tus datos y espera la revisión administrativa antes de aparecer en el directorio." },
];

export default function HowItWorksPage() {
  return <><SiteHeader /><main className="container pb-24 pt-14 md:pb-20 lg:pt-20"><SectionHeading className="mx-auto animate-enter text-center" eyebrow="Cómo funciona fixo" title="Más claridad para cada servicio" description="Diseñamos el marketplace para que puedas tomar buenas decisiones antes, durante y después del trabajo." /><div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">{steps.map((step, index) => <Card key={step.title} className="motion-card animate-enter" style={{ animationDelay: `${index * 90}ms` }}><CardContent className="p-6"><p className="text-sm font-bold text-primary">PASO {index + 1}</p><span className="mt-5 flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><step.icon className="size-6" /></span><h2 className="mt-5 text-lg font-bold">{step.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p></CardContent></Card>)}</div><div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-3xl bg-slate-950 p-8 text-center text-background"><CheckCircle2 className="mx-auto size-7 text-cyan-200" /><h2 className="mt-4 text-2xl font-bold">Tú eliges cómo avanzar</h2><p className="mt-3 text-slate-300">La contratación, los pagos y la atención de urgencias aún no están habilitados. Estamos incorporando profesionales para comenzar a operar.</p><Link className={`${buttonVariants({ variant: "secondary", size: "lg" })} mt-6`} href="/tecnicos">Buscar un técnico</Link></div></main></>;
}
