// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PriceBreakdown } from "@/components/payments/price-breakdown";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("PriceBreakdown", () => {
  const rows = [{ label: "Importe del profesional (Q)", value: "$50.000" }, { label: "Comisión SoyFixo (F)", value: "$5.000" }, { label: "Total (T = Q + F)", value: "$55.000", strong: true }];

  it("is a description list: every label is a term and every amount its definition, in order", () => {
    act(() => root.render(<PriceBreakdown rows={rows} />));
    expect([...container.querySelectorAll("dt")].map((node) => node.textContent)).toEqual(rows.map((row) => row.label));
    expect([...container.querySelectorAll("dd")].map((node) => node.textContent)).toEqual(rows.map((row) => row.value));
  });

  it("sets the total apart (heavier, separated by a rule) and uses tabular numerals for the amounts", () => {
    act(() => root.render(<PriceBreakdown rows={rows} />));
    const lines = [...container.querySelectorAll("dl > div")];
    expect(lines[2].className).toContain("font-semibold");
    expect(lines[2].className).toContain("border-t-2");
    expect(lines[0].className).not.toContain("font-semibold");
    expect(container.querySelector("dd")!.className).toContain("tabular");
  });
});
