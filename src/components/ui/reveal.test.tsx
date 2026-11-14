// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Reveal } from "@/components/ui/reveal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Callback = (entries: Array<{ isIntersecting: boolean }>) => void;
let observers: Array<{ callback: Callback; disconnect: ReturnType<typeof vi.fn> }> = [];
let container: HTMLDivElement;
let root: Root;

function installObserver() {
  class FakeObserver {
    disconnect = vi.fn();
    constructor(callback: Callback) { observers.push({ callback, disconnect: this.disconnect }); }
    observe() {}
    unobserve() {}
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
}

function stubViewportPosition(top: number, bottom: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON: () => ({}) });
}

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
}

const block = () => container.querySelector<HTMLElement>(".reveal")!;

beforeEach(() => {
  observers = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  stubReducedMotion(false);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Reveal", () => {
  it("is fully visible in the server HTML, so a failed hydration never leaves content transparent", () => {
    const html = renderToString(<Reveal>contenido</Reveal>);
    expect(html).toContain('data-armed="false"');
    expect(html).toContain("contenido");
    expect(html).not.toContain('data-armed="true"');
  });

  it("stays visible when IntersectionObserver does not exist", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    stubViewportPosition(2000, 2100);
    act(() => root.render(<Reveal>x</Reveal>));
    expect(block().dataset.armed).toBe("false");
  });

  it("stays visible with prefers-reduced-motion", () => {
    installObserver();
    stubReducedMotion(true);
    stubViewportPosition(2000, 2100);
    act(() => root.render(<Reveal>x</Reveal>));
    expect(block().dataset.armed).toBe("false");
    expect(observers).toHaveLength(0);
  });

  it("does not hide content that is already inside the viewport (no flash)", () => {
    installObserver();
    stubViewportPosition(100, 300);
    act(() => root.render(<Reveal>x</Reveal>));
    expect(block().dataset.armed).toBe("true");
    expect(block().dataset.visible).toBe("true");
    expect(observers).toHaveLength(0);
  });

  it("arms content below the fold and reveals it once it intersects, then stops observing", () => {
    installObserver();
    stubViewportPosition(2000, 2100);
    act(() => root.render(<Reveal delay={120}>x</Reveal>));
    expect(block().dataset.armed).toBe("true");
    expect(block().dataset.visible).toBe("false");
    expect(block().style.getPropertyValue("--reveal-delay")).toBe("120ms");
    act(() => observers[0].callback([{ isIntersecting: false }]));
    expect(block().dataset.visible).toBe("false");
    act(() => observers[0].callback([{ isIntersecting: true }]));
    expect(block().dataset.visible).toBe("true");
    expect(observers[0].disconnect).toHaveBeenCalled();
  });
});
