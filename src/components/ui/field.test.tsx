// @vitest-environment jsdom
import { Mail } from "lucide-react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Checkbox, CheckboxRow, Field, Input } from "@/components/ui/field";
import { IconInput } from "@/components/ui/icon-input";
import { TextLink } from "@/components/ui/text-link";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const render = (node: React.ReactNode) => act(() => root.render(node));

beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("Field", () => {
  it("binds the label to the control", () => {
    render(<Field htmlFor="email" label="Correo"><Input id="email" /></Field>);
    const label = container.querySelector("label")!;
    expect(label.htmlFor).toBe("email");
    expect((label.control as HTMLInputElement).id).toBe("email");
  });

  it("shows an error as an alert (preferred over the hint) and a hint otherwise, under the id the control points to", () => {
    render(<Field error="Obligatorio" hint="Ayuda" htmlFor="x" label="X"><Input aria-describedby="x-msg" id="x" /></Field>);
    const message = container.querySelector("#x-msg")!;
    expect(message.textContent).toBe("Obligatorio");
    expect(message.getAttribute("role")).toBe("alert");
    render(<Field hint="Ayuda" htmlFor="x" label="X"><Input id="x" /></Field>);
    expect(container.querySelector("#x-msg")!.textContent).toBe("Ayuda");
    expect(container.querySelector("#x-msg")!.getAttribute("role")).toBeNull();
  });
});

describe("Checkbox", () => {
  it("is a native checkbox using the shared 44 px touch-area styling, and its row is the click target", () => {
    render(<CheckboxRow><Checkbox name="terms" />Acepto</CheckboxRow>);
    const input = container.querySelector("input")!;
    expect(input.type).toBe("checkbox");
    expect(input.className).toContain("checkbox");
    const row = container.querySelector("label")!;
    expect(row.className).toContain("min-h-11");
    act(() => row.click());
    expect(input.checked).toBe(true);
  });
});

describe("IconInput", () => {
  it("keeps the icon decorative and unclickable, and declares the trailing control as a field adornment", () => {
    render(<IconInput aria-label="Correo" icon={Mail} trailing={<button type="button">Ver</button>} />);
    const icon = container.querySelector("svg")!;
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.getAttribute("class")).toContain("pointer-events-none");
    const adornment = container.querySelector("[data-field-adornment]")!;
    expect(adornment.querySelector("button")).not.toBeNull();
    expect(adornment.parentElement!.contains(container.querySelector("input"))).toBe(true);
    expect(container.querySelector("input")!.className).toContain("pr-12");
  });

  it("has no adornment wrapper without a trailing control", () => {
    render(<IconInput aria-label="Correo" icon={Mail} />);
    expect(container.querySelector("[data-field-adornment]")).toBeNull();
  });
});

describe("TextLink", () => {
  it("keeps a 44 px minimum height for stand-alone links", () => {
    render(<TextLink href="/login">Ingresar</TextLink>);
    expect(container.querySelector("a")!.className).toContain("min-h-11");
  });
});
