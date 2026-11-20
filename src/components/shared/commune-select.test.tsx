// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { field, mount, setValue } from "@/test/form-helpers";

import { CommuneSelect } from "./commune-select";

let view: ReturnType<typeof mount> | null = null;
afterEach(() => { view?.unmount(); view = null; });

function Harness({ initial = "", error }: { readonly initial?: string; readonly error?: string }) {
  const [value, setValue] = useState(initial);
  return <><CommuneSelect error={error} idPrefix="t" onChange={setValue} value={value} /><output data-testid="value">{value}</output></>;
}
const region = () => field(view!.container, "Región") as HTMLSelectElement;
const commune = () => field(view!.container, "Comuna") as HTMLSelectElement;
const optionValue = (select: HTMLSelectElement, text: string) => [...select.options].find((option) => option.textContent === text)!.value;
const value = () => view!.container.querySelector("output")!.textContent;

describe("CommuneSelect", () => {
  it("asks for the region first: the commune is disabled until one is chosen", () => {
    view = mount(<Harness />);
    expect(commune().disabled).toBe(true);
    expect(commune().options[0]!.textContent).toBe("Primero elige la región");
    expect(region().options).toHaveLength(17);
  });

  it("lists the communes of the chosen region and reports the official name when one is picked", () => {
    view = mount(<Harness />);
    setValue(region(), optionValue(region(), "Metropolitana de Santiago"));
    expect(commune().disabled).toBe(false);
    expect(commune().options).toHaveLength(53);
    setValue(commune(), "Ñuñoa");
    expect(value()).toBe("Ñuñoa");
    expect(commune().value).toBe("Ñuñoa");
  });

  it("changing the region clears the commune so it cannot belong to another region", () => {
    view = mount(<Harness initial="Providencia" />);
    expect(commune().value).toBe("Providencia");
    setValue(region(), optionValue(region(), "Valparaíso"));
    expect(value()).toBe("");
    expect(commune().value).toBe("");
  });

  it("opens on the region of a saved commune, whatever its accents or case", () => {
    view = mount(<Harness initial="nunoa" />);
    expect(region().options[region().selectedIndex]!.textContent).toBe("Metropolitana de Santiago");
    expect(commune().value).toBe("Ñuñoa");
  });

  it("shows the error it is given on the commune", () => {
    view = mount(<Harness error="Elige una comuna de la lista." />);
    expect(view.container.querySelector("[role=alert]")!.textContent).toBe("Elige una comuna de la lista.");
    expect(commune().getAttribute("aria-invalid")).toBe("true");
  });
});
