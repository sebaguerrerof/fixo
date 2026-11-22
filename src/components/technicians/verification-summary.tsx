import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { applicationStateLabel, documentReviewLabel, documentTypeLabel, inspectionStateLabel } from "@/domain/technicians/application-labels";
import type { ProfessionalApplication } from "@/domain/technicians/application";

/**
 * Read-only summary of where the technician's application stands: state, the reviewer's reason when information is
 * missing, and each current document with its inspection and review result. Editing and uploading stay in "Mi postulación".
 */
export function VerificationSummary({ application }: { readonly application: Pick<ProfessionalApplication, "state" | "review_reason" | "documents"> }) {
  const documents = application.documents.filter((document) => document.current_document);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verificación y documentos</CardTitle>
        <p className="text-sm text-muted-foreground">Estado de tu postulación: <strong className="text-foreground">{applicationStateLabel(application.state)}</strong></p>
      </CardHeader>
      <CardContent className="space-y-4">
        {application.review_reason ? <p className="rounded-md border border-border bg-muted p-3 text-sm">Observación de administración: {application.review_reason}</p> : null}
        {documents.length ? (
          <ul className="space-y-2">
            {documents.map((document) => (
              <li className="rounded-md border border-border p-3 text-sm" key={document.id}>
                <p className="font-medium">{documentTypeLabel(document.document_type)}</p>
                <p className="text-muted-foreground">Inspección: {inspectionStateLabel(document.inspection_status)} · Revisión: {documentReviewLabel(document.status)}</p>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Todavía no has subido documentos.</p>}
        <Link className="inline-flex min-h-11 items-center font-semibold text-primary underline" href="/tecnico/postulacion">Ver o actualizar mi postulación</Link>
      </CardContent>
    </Card>
  );
}
