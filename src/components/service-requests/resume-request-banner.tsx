"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

import { clearDraft, loadDraft } from "@/components/service-requests/request-draft";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Shown in the customer panel when this browser still holds a request draft: the visitor who wrote a request
 * before creating the account (the confirmation e-mail lands them here) gets back to it in one click.
 */
export function ResumeRequestBanner() {
  const [title, setTitle] = useState<string | null>(null);
  useEffect(() => { setTitle(loadDraft()?.title || null); }, []);
  if (title === null) return null;
  return (
    <Alert className="mt-6" title="Tienes una solicitud sin enviar" tone="info">
      Dejaste escrito «{title}» en este dispositivo. Retómala y envíala con tu cuenta.
      <div className="mt-4 flex flex-wrap gap-3">
        <Link className={buttonVariants({ size: "sm" })} href="/solicitar">Retomar solicitud</Link>
        <Button onClick={() => { clearDraft(); setTitle(null); }} size="sm" type="button" variant="outline">Descartar borrador</Button>
      </div>
    </Alert>
  );
}
