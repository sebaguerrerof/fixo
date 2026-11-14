// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CredentialCard, CredentialSlot } from "@/components/technicians/credential-card";
import { HeroCredential } from "@/components/technicians/hero-credential";
import type { Technician } from "@/domain/entities/technician";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const technician: Technician = {
  id: "t1", slug: "camila-rojas", displayName: "Camila Rojas", avatarUrl: null, city: "Providencia", coverageAreas: ["Providencia", "Ñuñoa"],
  headline: "Electricista certificada", bio: "Bio", status: "verified", categoryIds: ["c1"], specialties: ["Tableros eléctricos", "Cortocircuitos"],
  yearsOfExperience: 9, emergencyEnabled: false, startingPriceClp: 25000,
  metrics: { rating: 0, reviewCount: 0, completedJobs: 0, responseTimeMinutes: 0, completionRate: 0 },
};

let container: HTMLDivElement;
let root: Root;
const render = (node: React.ReactNode) => act(() => root.render(node));
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("CredentialCard", () => {
  it("shows only real profile data, with the public profile address as its number", () => {
    render(<CredentialCard technician={technician} />);
    const text = container.textContent ?? "";
    for (const fact of ["Camila Rojas", "Electricista certificada", "Tableros eléctricos, Cortocircuitos", "Providencia", "9 años, declarada", "soyfixo.cl/tecnicos/camila-rojas"]) expect(text).toContain(fact);
    expect(text).toMatch(/\$\s?25\.000/);
  });

  it("does not invent a serial number, a review date or a photo", () => {
    render(<CredentialCard technician={technician} />);
    expect(container.textContent).not.toMatch(/N[º°.]\s*\d|serie|\b(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\w*\s+\d{4}/i);
    expect(container.querySelector("img")).toBeNull();
  });

  it("stamps only approved profiles (active or verified)", () => {
    render(<CredentialCard technician={technician} />);
    expect(container.textContent).toContain("Perfil aprobado");
    render(<CredentialCard technician={{ ...technician, status: "pending_verification" }} />);
    expect(container.textContent).not.toContain("Perfil aprobado");
  });

  it("as a list card, a single link over the whole surface leads to the profile; as the page header it is an h1 with no link", () => {
    render(<CredentialCard technician={technician} />);
    const link = container.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("/tecnicos/camila-rojas");
    expect(link.className).toContain("after:absolute");
    expect(container.querySelectorAll("a")).toHaveLength(1);
    render(<CredentialCard technician={technician} variant="page" />);
    expect(container.querySelector("h1")!.textContent).toBe("Camila Rojas");
    expect(container.querySelector("a")).toBeNull();
  });

  it("plays the stamp animation only when asked, so a list does not stamp every card", () => {
    render(<CredentialCard technician={technician} />);
    expect(container.querySelector(".stamp-in")).toBeNull();
    render(<CredentialCard animateStamp technician={technician} />);
    expect(container.querySelector(".stamp-in")).not.toBeNull();
  });

  it("uses the requested heading level so it never skips one under the page title", () => {
    render(<CredentialCard headingLevel={2} technician={technician} />);
    expect(container.querySelector("h2")!.textContent).toBe("Camila Rojas");
    expect(container.querySelector("h3")).toBeNull();
    render(<CredentialCard technician={technician} />);
    expect(container.querySelector("h3")!.textContent).toBe("Camila Rojas");
  });

  it("falls back to 'A convenir' when no reference price was declared", () => {
    render(<CredentialCard technician={{ ...technician, startingPriceClp: 0 }} />);
    expect(container.textContent).toContain("A convenir");
  });
});

describe("Home hero credential", () => {
  // The home page is an h1 followed by the hero credential, with or without published profiles.
  const levels = () => [...container.querySelectorAll("h1, h2, h3, h4")].map((heading) => Number(heading.tagName.slice(1)));

  it("with a published profile the heading order is h1, h2", () => {
    render(<><h1>Titular</h1><HeroCredential technician={technician} /></>);
    expect(levels()).toEqual([1, 2]);
  });

  it("with NO published profiles (empty directory) the slot title is an h2 too: no jump from h1 to h3", () => {
    render(<><h1>Titular</h1><HeroCredential technician={null} /></>);
    expect(levels()).toEqual([1, 2]);
    expect(container.textContent).toContain("Aquí aparecerá el primer perfil aprobado");
    expect(container.querySelector("a")!.getAttribute("href")).toBe("/registro/tecnico");
  });

  it("the slot defaults to h3 for use under a section heading", () => {
    render(<CredentialSlot title="Pendiente"><p>x</p></CredentialSlot>);
    expect(container.querySelector("h3")).not.toBeNull();
  });
});

describe("CredentialSlot", () => {
  it("is the honest empty state: a pending credential with an explanation, not a fake profile", () => {
    render(<CredentialSlot title="Aquí aparecerá el primer perfil aprobado"><p>Texto</p></CredentialSlot>);
    expect(container.textContent).toContain("Carné pendiente");
    expect(container.textContent).toContain("Aquí aparecerá el primer perfil aprobado");
    expect(container.textContent).not.toContain("Perfil aprobado por");
  });
});
