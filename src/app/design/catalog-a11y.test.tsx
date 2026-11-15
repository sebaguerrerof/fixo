// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mount } from "@/test/form-helpers";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/design",
  useSearchParams: () => new URLSearchParams(),
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));
vi.mock("@/components/layout/site-header", () => ({ SiteHeader: () => null }));

let view: ReturnType<typeof mount>;

beforeEach(async () => {
  if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, "crypto", { value: (await import("node:crypto")).webcrypto, configurable: true });
  const { default: DesignCatalogPage } = await import("./page");
  view = mount(DesignCatalogPage());
}, 60_000);
afterEach(() => { view.unmount(); vi.resetModules(); });

const CONTROLS = "input:not([type=hidden]), select, textarea";

describe("/design catalog: identifiers and labels across every form mounted at once", () => {
  it("every id on the page is unique (forms with the same field names must not share ids)", () => {
    const seen = new Map<string, number>();
    for (const node of view.container.querySelectorAll("[id]")) seen.set(node.id, (seen.get(node.id) ?? 0) + 1);
    expect([...seen].filter(([, count]) => count > 1).map(([id]) => id)).toEqual([]);
    expect(seen.size).toBeGreaterThan(50);
  });

  it("every label points to an existing control INSIDE THE SAME form (a label never reaches into another form)", () => {
    const labels = [...view.container.querySelectorAll<HTMLLabelElement>("label[for]")];
    expect(labels.length).toBeGreaterThan(40);
    const broken: string[] = [];
    for (const label of labels) {
      const control = document.getElementById(label.htmlFor);
      if (!control) { broken.push(`«${label.textContent?.trim()}» -> #${label.htmlFor} no existe`); continue; }
      if (label.closest("form") !== control.closest("form")) broken.push(`«${label.textContent?.trim()}» apunta a un control de otro formulario`);
    }
    expect(broken).toEqual([]);
  });

  it("every aria-describedby / aria-labelledby token resolves to an element on the page", () => {
    const dangling: string[] = [];
    for (const node of view.container.querySelectorAll("[aria-describedby], [aria-labelledby]")) {
      for (const attribute of ["aria-describedby", "aria-labelledby"]) {
        for (const token of (node.getAttribute(attribute) ?? "").split(/\s+/).filter(Boolean)) {
          // A hint or error paragraph only exists while there is a message; the reference may legitimately be unresolved then.
          if (!document.getElementById(token) && attribute === "aria-labelledby") dangling.push(`${attribute}=${token}`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it("every control has an accessible name (label, wrapping label, aria-label or title)", () => {
    const unnamed: string[] = [];
    for (const control of view.container.querySelectorAll<HTMLInputElement>(CONTROLS)) {
      const named = (control.labels?.length ?? 0) > 0 || control.getAttribute("aria-label") || control.getAttribute("aria-labelledby") || control.getAttribute("title");
      if (!named) unnamed.push(`${control.tagName.toLowerCase()}[name=${control.getAttribute("name")}]`);
    }
    expect(unnamed).toEqual([]);
  });

  it("the same field name can appear in several forms, each with its own label association (city, bio, headline, description)", () => {
    for (const name of ["city", "bio", "headline", "description"]) {
      const controls = [...view.container.querySelectorAll<HTMLElement>(`[name="${name}"]`)];
      if (controls.length < 2) continue;
      for (const control of controls) {
        expect((control as HTMLInputElement).labels?.length, `[name=${name}] id=${control.id}`).toBe(1);
        expect((control as HTMLInputElement).labels![0].closest("form")).toBe(control.closest("form"));
      }
    }
  });
});
