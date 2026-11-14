// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardError, DashboardLoading } from "@/components/shared/dashboard-feedback";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const render = (node: React.ReactNode) => act(() => root.render(node));

beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("PageHeader", () => {
  it("renders exactly one h1 with optional description and actions, and no kicker above it", () => {
    render(<PageHeader actions={<button type="button">Nuevo</button>} description="Hola, Ana. Texto" title="Mis solicitudes" />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelector("h1")!.textContent).toBe("Mis solicitudes");
    expect(container.textContent).toContain("Hola, Ana. Texto");
    expect(container.querySelector("button")!.textContent).toBe("Nuevo");
  });

  it("omits description and actions when not given", () => {
    render(<PageHeader title="Solo título" />);
    expect(container.querySelectorAll("p")).toHaveLength(0);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});

describe("Pagination", () => {
  const hrefFor = (page: number) => `/cliente?page=${page}`;
  const links = () => [...container.querySelectorAll("a")].map((link) => [link.textContent, link.getAttribute("href")]);

  it("shows only 'Siguiente' on the first page when there are more", () => {
    render(<Pagination hrefFor={hrefFor} noun="solicitudes" page={1} pageSize={20} total={45} />);
    expect(links()).toEqual([["Siguiente", "/cliente?page=2"]]);
    expect(container.textContent).toContain("Página 1 · 45 solicitudes");
  });

  it("shows both directions in the middle and only 'Anterior' on the last page", () => {
    render(<Pagination hrefFor={hrefFor} noun="solicitudes" page={2} pageSize={20} total={45} />);
    expect(links()).toEqual([["Anterior", "/cliente?page=1"], ["Siguiente", "/cliente?page=3"]]);
    render(<Pagination hrefFor={hrefFor} noun="solicitudes" page={3} pageSize={20} total={45} />);
    expect(links()).toEqual([["Anterior", "/cliente?page=2"]]);
  });

  it("shows no links for a single page and announces the summary politely", () => {
    render(<Pagination hrefFor={hrefFor} noun="solicitudes" page={1} pageSize={20} total={3} />);
    expect(links()).toEqual([]);
    expect(container.querySelector("[aria-live='polite']")!.textContent).toContain("3 solicitudes");
    expect(container.querySelector("nav")!.getAttribute("aria-label")).toBe("Paginación");
  });
});

describe("Dashboard feedback", () => {
  it("loading announces a busy region once and hides the skeleton blocks from assistive technology", () => {
    render(<DashboardLoading />);
    const region = container.querySelector("[role='status']")!;
    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(region.textContent).toContain("Cargando información");
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(3);
  });

  it("error keeps the warning about repeating a possibly recorded action and retries on demand", () => {
    const reset = vi.fn();
    render(<DashboardError reset={reset} />);
    expect(container.querySelector("h1")!.textContent).toBe("No pudimos cargar la información");
    expect(container.textContent).toContain("Tu acción puede haberse registrado. Revisa el estado antes de repetirla.");
    act(() => container.querySelector("button")!.click());
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
