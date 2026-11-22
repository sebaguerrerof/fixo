// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VerificationSummary } from "./verification-summary";

const doc = (over: Record<string, unknown>) => ({ id: "11111111-1111-4111-8111-111111111111", requirement_id: null, document_type: "identity", status: "pending", inspection_status: "clean", inspection_engine: null, current_document: true, ...over }) as never;
const render = (documents: never[], state = "submitted", review_reason: string | null = null) => renderToStaticMarkup(<VerificationSummary application={{ state, review_reason, documents }} />);
/** The <li> that mentions this document type, so labels are checked inside their own document. */
const itemOf = (html: string, label: string) => html.split("<li").find((chunk) => chunk.includes(label)) ?? "";

describe("VerificationSummary", () => {
  it("shows the state, the reviewer's reason and only the current documents", () => {
    const html = render([doc({}), doc({ id: "22222222-2222-4222-8222-222222222222", document_type: "certificate", current_document: false })], "needs_information", "Falta el certificado");
    expect(html).toContain("Requiere antecedentes");
    expect(html).toContain("Falta el certificado");
    expect(html).toContain("Identidad");
    expect(html).not.toContain("Certificado");
    expect(html).toContain("/tecnico/postulacion");
  });

  it("says so when there are no documents", () => {
    expect(render([], "draft")).toContain("Todavía no has subido documentos");
  });

  it("shows each document's own inspection and review result", () => {
    const html = render([
      doc({ id: "a1111111-1111-4111-8111-111111111111", document_type: "identity", inspection_status: "clean", status: "approved" }),
      doc({ id: "b1111111-1111-4111-8111-111111111111", document_type: "certificate", inspection_status: "quarantined", status: "pending" }),
      doc({ id: "c1111111-1111-4111-8111-111111111111", document_type: "license", inspection_status: "unsafe", status: "rejected" }),
    ]);
    expect(itemOf(html, "Identidad")).toContain("Inspección: Inspeccionado");
    expect(itemOf(html, "Identidad")).toContain("Revisión: Aprobado");
    expect(itemOf(html, "Certificado")).toContain("Inspección: En cuarentena");
    expect(itemOf(html, "Certificado")).toContain("Revisión: Pendiente");
    expect(itemOf(html, "Licencia")).toContain("Inspección: Contenido rechazado");
    expect(itemOf(html, "Licencia")).toContain("Revisión: Rechazado");
  });
});
