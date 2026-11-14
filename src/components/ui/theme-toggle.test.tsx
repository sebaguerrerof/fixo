// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { THEME_STORAGE_KEY, themeInitScript } from "@/design-system/theme";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function stubSystemTheme(dark: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: dark && query.includes("dark"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
}

const runInitScript = () => new Function(themeInitScript)();
const isDark = () => document.documentElement.classList.contains("dark");

beforeEach(() => {
  document.documentElement.className = "";
  window.localStorage.clear();
  stubSystemTheme(false);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("theme init script (runs before first paint)", () => {
  it("uses the stored preference over the system setting", () => {
    stubSystemTheme(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    runInitScript();
    expect(isDark()).toBe(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    stubSystemTheme(false);
    runInitScript();
    expect(isDark()).toBe(true);
  });

  it("falls back to the system setting when nothing is stored", () => {
    stubSystemTheme(true);
    runInitScript();
    expect(isDark()).toBe(true);
  });

  it("blocked storage still follows the system preference (dark system gets dark, light system stays light)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    stubSystemTheme(true);
    expect(() => runInitScript()).not.toThrow();
    expect(isDark()).toBe(true);
    document.documentElement.className = "";
    stubSystemTheme(false);
    runInitScript();
    expect(isDark()).toBe(false);
  });

  it("an unavailable matchMedia does not discard a stored preference", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    vi.stubGlobal("matchMedia", () => { throw new Error("unsupported"); });
    expect(() => runInitScript()).not.toThrow();
    expect(isDark()).toBe(true);
  });
});

describe("ThemeToggle", () => {
  it("switches the theme and persists the choice", () => {
    act(() => root.render(<ThemeToggle />));
    const button = container.querySelector("button")!;
    expect(button.getAttribute("aria-label")).toBe("Cambiar a tema oscuro");
    act(() => button.click());
    expect(isDark()).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(button.getAttribute("aria-label")).toBe("Cambiar a tema claro");
    act(() => button.click());
    expect(isDark()).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("still switches for this visit when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    act(() => root.render(<ThemeToggle />));
    const button = container.querySelector("button")!;
    expect(() => act(() => button.click())).not.toThrow();
    expect(isDark()).toBe(true);
  });

  it("reflects a dark theme already applied before hydration", () => {
    document.documentElement.classList.add("dark");
    act(() => root.render(<ThemeToggle />));
    expect(container.querySelector("button")!.getAttribute("aria-label")).toBe("Cambiar a tema claro");
  });
});
