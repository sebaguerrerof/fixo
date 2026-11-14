// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("Button", () => {
  it("runs its handler when idle", () => {
    const onClick = vi.fn();
    act(() => root.render(<Button onClick={onClick}>Guardar</Button>));
    act(() => container.querySelector("button")!.click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("blocks repeated activation and announces busy state while loading", () => {
    const onClick = vi.fn();
    act(() => root.render(<Button loading onClick={onClick}>Guardar</Button>));
    const button = container.querySelector("button")!;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.querySelector("svg")).not.toBeNull();
    act(() => button.click());
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is not busy and has no spinner when not loading", () => {
    act(() => root.render(<Button>Guardar</Button>));
    const button = container.querySelector("button")!;
    expect(button.hasAttribute("aria-busy")).toBe(false);
    expect(button.querySelector("svg")).toBeNull();
  });

  it("keeps a 44 px interactive area on every size, whatever it looks like", () => {
    for (const size of ["default", "sm", "lg", "icon"] as const) {
      act(() => root.render(<Button size={size}>x</Button>));
      expect(container.querySelector("button")!.className, size).toContain("touch-area");
    }
  });
});
