import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="min-h-screen bg-slate-950 px-4 py-10 sm:py-16"><section className="mx-auto w-full max-w-lg rounded-3xl bg-background p-6 shadow-xl sm:p-10"><Logo /><h1 className="mt-8 text-3xl font-bold tracking-tight">{title}</h1><p className="mt-3 leading-7 text-muted-foreground">{description}</p><div className="mt-7">{children}</div><Link href="/login" className="mt-7 inline-block text-sm font-semibold text-primary underline">Volver a ingresar</Link></section></main>;
}
