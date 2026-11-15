import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Mounts a React tree in jsdom and gives back the container plus an unmount function. */
export function mount(node: React.ReactNode): { container: HTMLDivElement; root: Root; unmount: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return { container, root, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

/** Types into a field the way a user would, so React-controlled inputs see it too. */
export function setValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value);
  act(() => { element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true })); });
}

export function check(element: HTMLInputElement, checked = true): void {
  if (element.checked !== checked) act(() => element.click());
}

/** Submits through the browser's own path (requestSubmit), so HTML5 validation (required, pattern) really blocks an invalid form. */
export function submit(form: HTMLFormElement): void {
  act(() => form.requestSubmit());
}

/** Lets pending promises and effects settle. */
export async function flush(): Promise<void> {
  await act(async () => { await Promise.resolve(); await new Promise((resolve) => setTimeout(resolve, 0)); });
}

/** A promise whose resolution the test controls, to observe the UI while a submission is in flight. */
export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

export function byText<T extends Element = HTMLElement>(container: ParentNode, selector: string, text: string | RegExp): T {
  const found = [...container.querySelectorAll<T>(selector)].find((node) => (typeof text === "string" ? node.textContent?.trim() === text : text.test(node.textContent ?? "")));
  if (!found) throw new Error(`No ${selector} con texto ${String(text)}`);
  return found;
}

export function field(container: ParentNode, labelText: string | RegExp): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const label = [...container.querySelectorAll("label")].find((node) => (typeof labelText === "string" ? node.textContent?.trim() === labelText : labelText.test(node.textContent ?? "")));
  if (!label) throw new Error(`No hay etiqueta ${String(labelText)}`);
  const control = (label as HTMLLabelElement).control;
  if (!control) throw new Error(`La etiqueta ${String(labelText)} no apunta a ningun control`);
  return control as HTMLInputElement;
}
