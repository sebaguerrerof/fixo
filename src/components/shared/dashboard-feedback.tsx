"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoadingRegion, Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Route-level loading state for dashboards: a title block and a grid of card skeletons. */
export function DashboardLoading() {
  return (
    <LoadingRegion label="Cargando información">
      <div className="container space-y-6 py-8">
        <div className="space-y-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-72 max-w-full" /><Skeleton className="h-4 w-96 max-w-full" /></div>
        <div className="grid gap-4 lg:grid-cols-2"><SkeletonCard /><SkeletonCard /></div>
      </div>
    </LoadingRegion>
  );
}

/** Route-level error state. Keeps the original warning about repeating an action that may already have been recorded. */
export function DashboardError({ reset }: { readonly reset: () => void }) {
  return (
    <div className="container max-w-2xl space-y-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">No pudimos cargar la información</h1>
      <Alert tone="warning">Tu acción puede haberse registrado. Revisa el estado antes de repetirla.</Alert>
      <Button onClick={reset}>Volver a cargar</Button>
    </div>
  );
}
