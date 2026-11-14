// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

const levels = () => [...container.querySelectorAll("h1, h2, h3, h4")].map((heading) => Number(heading.tagName.slice(1)));

describe("CardTitle", () => {
  it("is an h2 by default so a card directly under the page title does not skip a level", () => {
    act(() => root.render(<><h1>Panel</h1><Card><CardHeader><CardTitle>Estado de tu perfil</CardTitle></CardHeader></Card></>));
    expect(levels()).toEqual([1, 2]);
  });

  it("can be an h3 inside a section that already has its own h2", () => {
    act(() => root.render(<><h1>Panel</h1><h2>Sección</h2><Card><CardHeader><CardTitle as="h3">Detalle</CardTitle></CardHeader></Card></>));
    expect(levels()).toEqual([1, 2, 3]);
  });
});
