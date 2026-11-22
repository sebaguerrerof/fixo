// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { VerificationSummary } from "./verification-summary";

const doc = (over: Record<string, unknown>) => ({ id: "11111111-1111-4111-8111-111111111111", requirement_id: null, document_type: "identity", status: "pending", inspection_status: "clean", inspection_engine: null, current_document: true, ...over }) as never;

describe("VerificationSummary", () => {
  it("shows the state, the reviewer's reason and only the current documents", () => {
    const html = renderToStaticMarkup(<VerificationSummary application={{ state: "needs_information", review_reason: "Falta el certificado", documents: [doc({}), doc({ id: "22222222-2222-4222-8222-222222222222", document_type: "certificate", current_document: false })] }} />);
    expect(html).toContain("Requiere antecedentes");
    expect(html).toContain("Falta el certificado");
    expect(html).toContain("Identidad");
    expect(html).not.toContain("Certificado");
    expect(html).toContain("/tecnico/postulacion");
  });

  it("says so when there are no documents", () => {
    expect(renderToStaticMarkup(<VerificationSummary application={{ state: "draft", review_reason: null, documents: [] }} />)).toContain("Todavía no has subido documentos");
  });
});
