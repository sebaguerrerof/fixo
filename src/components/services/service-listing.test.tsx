// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { mount } from "@/test/form-helpers";

import { ServiceListing } from "./service-listing";

let view: ReturnType<typeof mount> | null = null;
afterEach(() => { view?.unmount(); view = null; });
const copy = { emptyTitle: "Sin técnicos", emptyDescription: "Aún no hay perfiles." };

describe("ServiceListing empty state", () => {
  it("keeps the service and commune in the request link", () => {
    view = mount(<ServiceListing {...copy} requestHref="/solicitar?rubro=electricidad&comuna=providencia" technicians={[]} />);
    const link = [...view.container.querySelectorAll("a")].find((anchor) => anchor.textContent === "Pedir este servicio igual")!;
    expect(link.getAttribute("href")).toBe("/solicitar?rubro=electricidad&comuna=providencia");
  });

  it("falls back to the plain request page", () => {
    view = mount(<ServiceListing {...copy} technicians={[]} />);
    expect(view.container.querySelector("a")!.getAttribute("href")).toBe("/solicitar");
  });
});
