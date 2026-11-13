"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function ApplicationError({ reset }: { readonly reset: () => void }) {
  return <main className="container space-y-5 py-16" role="alert"><EmptyState title="No pudimos cargar esta sección" description="Inténtalo nuevamente en unos minutos. Tus datos guardados se conservan." /><div className="text-center"><Button onClick={reset}>Volver a intentar</Button></div></main>;
}
