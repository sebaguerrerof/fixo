"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

export default function ApplicationFormError({ reset }: { readonly reset: () => void }) {
  return <main className="container py-16" role="alert"><PageHeader actions={<Button onClick={reset}>Intentar nuevamente</Button>} description="Inténtalo nuevamente. Lo que ya enviaste se conserva." title="No pudimos cargar la postulación" /></main>;
}
