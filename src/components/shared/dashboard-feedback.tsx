"use client";
import { Button } from "@/components/ui/button";
export function DashboardLoading() { return <p role="status" className="container py-12 text-muted-foreground">Cargando información…</p>; }
export function DashboardError({ reset }: { readonly reset: () => void }) { return <div className="container space-y-4 py-12"><h1 className="text-xl font-bold">No pudimos cargar la información</h1><p>Tu acción puede haberse registrado. Revisa el estado antes de repetirla.</p><Button onClick={reset}>Volver a cargar</Button></div>; }
