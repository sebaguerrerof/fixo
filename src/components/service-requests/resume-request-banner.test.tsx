// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { flush, mount } from "@/test/form-helpers";

import { loadDraft, saveDraft } from "./request-draft";
import { ResumeRequestBanner } from "./resume-request-banner";

let view: ReturnType<typeof mount> | null = null;
beforeEach(() => window.localStorage.clear());
afterEach(() => { view?.unmount(); view = null; });

describe("ResumeRequestBanner", () => {
  it("shows nothing without a draft", async () => {
    view = mount(<ResumeRequestBanner />); await flush();
    expect(view.container.textContent).toBe("");
  });

  it("offers to resume the draft left before creating the account, or to discard it", async () => {
    saveDraft({ title: "Revisión de tablero", description: "Una llave se calienta." });
    view = mount(<ResumeRequestBanner />); await flush();
    expect(view.container.textContent).toContain("Revisión de tablero");
    expect([...view.container.querySelectorAll("a")].find((anchor) => anchor.textContent === "Retomar solicitud")!.getAttribute("href")).toBe("/solicitar");
    [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Descartar borrador")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
    expect(view.container.textContent).toBe("");
    expect(loadDraft()).toBeNull();
  });
});
