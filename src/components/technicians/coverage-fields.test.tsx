// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { byText, check, field, mount, setValue } from "@/test/form-helpers";

import { CoverageFields } from "./coverage-fields";

let view: ReturnType<typeof mount> | null = null;
afterEach(() => { view?.unmount(); view = null; });

const regionSelect = (label: string | RegExp) => field(view!.container, label) as HTMLSelectElement;
const optionByText = (select: HTMLSelectElement, text: string) => [...select.options].find((option) => option.textContent === text)!.value;
const checkbox = (name: string) => [...view!.container.querySelectorAll("label")].find((label) => label.textContent === name)?.querySelector("input") as HTMLInputElement | undefined;
const hidden = () => [...view!.container.querySelectorAll<HTMLInputElement>("input[name=coverageAreas]")].map((input) => input.value);
const chips = () => [...view!.container.querySelectorAll("ul li")].map((li) => li.textContent);
const cityValue = () => (field(view!.container, "Comuna base") as HTMLSelectElement).value;
function chooseRegion(label: string | RegExp, name: string) { const select = regionSelect(label); setValue(select, optionByText(select, name)); }

describe("CoverageFields", () => {
  it("asks for the region first: the base commune is disabled until one is chosen", () => {
    view = mount(<CoverageFields idPrefix="t" />);
    const city = field(view.container, "Comuna base") as HTMLSelectElement;
    expect(city.disabled).toBe(true);
    expect(city.options[0]!.textContent).toBe("Primero elige la región");
    chooseRegion(/^Región$/, "Metropolitana de Santiago");
    expect(city.disabled).toBe(false);
    expect(city.options.length).toBe(53); // 52 communes + the placeholder
    expect(city.name).toBe("city");
    expect(city.required).toBe(true);
  });

  it("lists the 16 regions", () => {
    view = mount(<CoverageFields idPrefix="t" />);
    expect(regionSelect(/^Región$/).options.length).toBe(17);
  });

  it("lets you tick several communes of a region (Las Condes, Providencia, Ñuñoa, Vitacura) and submits each as its own field", () => {
    view = mount(<CoverageFields idPrefix="t" />);
    chooseRegion(/^Región$/, "Metropolitana de Santiago");
    for (const name of ["Las Condes", "Providencia", "Ñuñoa", "Vitacura"]) check(checkbox(name)!);
    expect(hidden()).toEqual(["Las Condes", "Providencia", "Ñuñoa", "Vitacura"]);
    expect(view.container.textContent).toContain("Seleccionadas: 4 de 20");
    expect(chips()).toHaveLength(4);
  });

  it("adds the base commune to the coverage and lets you change the region without losing what you picked", () => {
    view = mount(<CoverageFields idPrefix="t" />);
    chooseRegion(/^Región$/, "Metropolitana de Santiago");
    setValue(field(view.container, "Comuna base") as HTMLSelectElement, "Providencia");
    expect(hidden()).toEqual(["Providencia"]);
    chooseRegion(/Ver comunas/, "Valparaíso");
    check(checkbox("Viña del Mar")!);
    expect(hidden()).toEqual(["Providencia", "Viña del Mar"]);
    chooseRegion(/Ver comunas/, "Metropolitana de Santiago");
    expect(checkbox("Providencia")!.checked).toBe(true);
  });

  it("removes a commune from its chip or by unticking it", () => {
    view = mount(<CoverageFields defaultCity="Providencia" defaultCoverage={["Providencia", "Ñuñoa"]} idPrefix="t" />);
    expect(hidden()).toEqual(["Providencia", "Ñuñoa"]);
    act(() => view!.container.querySelector<HTMLButtonElement>("button[aria-label='Quitar Ñuñoa']")!.click());
    expect(hidden()).toEqual(["Providencia"]);
    check(checkbox("Providencia")!, false);
    expect(hidden()).toEqual([]);
    expect(view.container.textContent).toContain("Aún no eliges ninguna comuna");
  });

  it("stops at 20 communes: the rest of the boxes are disabled and it says so", () => {
    view = mount(<CoverageFields idPrefix="t" />);
    chooseRegion(/^Región$/, "Metropolitana de Santiago");
    const names = ["Alhué", "Buin", "Calera de Tango", "Cerrillos", "Cerro Navia", "Colina", "Conchalí", "Curacaví", "El Bosque", "El Monte", "Estación Central", "Huechuraba", "Independencia", "Isla de Maipo", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Lampa"];
    for (const name of names) check(checkbox(name)!);
    expect(hidden()).toHaveLength(20);
    expect(checkbox("Las Condes")!.disabled).toBe(true);
    expect(checkbox("Alhué")!.disabled).toBe(false);
    expect(view.container.textContent).toContain("(máximo alcanzado)");
  });

  it("starts from saved values: shows them selected, with the region already open", () => {
    view = mount(<CoverageFields defaultCity="Providencia" defaultCoverage={["Providencia", "Ñuñoa", "Las Condes"]} idPrefix="t" />);
    expect(cityValue()).toBe("Providencia");
    expect(hidden()).toEqual(["Providencia", "Ñuñoa", "Las Condes"]);
    expect(checkbox("Ñuñoa")!.checked).toBe(true);
    expect(view.container.textContent).not.toContain("no se conservarán");
  });

  it("recognizes saved names whatever their case or accents, and says which old values it dropped", () => {
    view = mount(<CoverageFields defaultCity="providencia" defaultCoverage={["nunoa", "Santiago Centro", "Zona norte"]} idPrefix="t" />);
    expect(hidden()).toEqual(["Ñuñoa"]);
    expect(cityValue()).toBe("Providencia");
    expect(byText(view.container, "p", /no se conservarán/).textContent).toContain("Santiago Centro, Zona norte");
  });

  it("changing the base region clears the base commune (so it cannot belong to another region)", () => {
    view = mount(<CoverageFields defaultCity="Providencia" defaultCoverage={["Providencia"]} idPrefix="t" />);
    chooseRegion(/^Región$/, "Valparaíso");
    expect(cityValue()).toBe("");
  });

  it("shows the errors it is given", () => {
    view = mount(<CoverageFields errors={{ city: "Elige una comuna de la lista.", coverageAreas: "Elige al menos una comuna de cobertura." }} idPrefix="t" />);
    const alerts = [...view.container.querySelectorAll("[role=alert]")].map((node) => node.textContent);
    expect(alerts).toEqual(["Elige una comuna de la lista.", "Elige al menos una comuna de cobertura."]);
  });
});
