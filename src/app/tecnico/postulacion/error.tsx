"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function ApplicationFormError({ reset }: { readonly reset: () => void }) {
  return <main className="container space-y-5 py-16" role="alert"><EmptyState title="No pudimos cargar la postulación" description="Inténtalo nuevamente. Lo que ya enviaste se conserva." /><div className="text-center"><Button onClick={reset}>Intentar nuevamente</Button></div></main>;
}
