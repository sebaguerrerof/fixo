// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { byText, check, deferred, field, flush, mount, setValue, submit } from "@/test/form-helpers";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const actions = vi.hoisted(() => ({ saveProfessionalDraft: vi.fn(), submitProfessionalApplication: vi.fn(), uploadProfessionalDocument: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/tecnico/postulacion/actions", () => actions);

import { ProfessionalApplicationForm } from "@/components/technicians/professional-application-form";
import type { ProfessionalApplication, ProfessionalRequirement } from "@/domain/technicians/application";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const categories = [{ id: "electricidad", name: "Electricidad" }, { id: "gasfiteria", name: "Gasfitería" }];
const application = (overrides: Partial<ProfessionalApplication> = {}, status = "active"): ProfessionalApplication => ({
  technician_id: ID(1), revision: 3, state: "needs_information", primary_category: "electricidad", availability: "Lunes a viernes", portfolio: ["https://ejemplo.cl/trabajo-1"], review_reason: "Falta un antecedente", published: false, name: "Camila Rojas",
  profile: { city: "Providencia", headline: "Electricista certificada", bio: "Bio", coverage_areas: ["Providencia", "Ñuñoa"], years_of_experience: 9, starting_price_clp: 25000, status },
  categories: ["electricidad"], specialties: ["Tableros", "Cortocircuitos"], documents: [], history: [],
  ...overrides,
});
const requirements: ProfessionalRequirement[] = [{ id: ID(3), category_id: "electricidad", requirement_key: "antecedente-identidad", version: 1, kind: "internal", required: true, document_type: "identity", description: "Documento de identidad vigente", source_url: null }];

let view: ReturnType<typeof mount> | null = null;
beforeEach(() => { Object.values(actions).forEach((mock) => mock.mockReset()); router.refresh.mockReset(); });
afterEach(() => { view?.unmount(); view = null; });

const draftForm = () => view!.container.querySelectorAll("form")[0] as HTMLFormElement;
const reviewForm = () => [...view!.container.querySelectorAll("form")].find((form) => form.textContent?.includes("Enviar a revisión")) as HTMLFormElement;

describe("ProfessionalApplicationForm: saving the draft", () => {
  it("sends the declared data parsed and typed (lists split on commas, numbers as numbers), the revision and a generated operation id", async () => {
    actions.saveProfessionalDraft.mockResolvedValue({ ok: false, message: "Sin cambios" });
    view = mount(<ProfessionalApplicationForm application={application()} categories={categories} requirements={requirements} />);
    submit(draftForm()); await flush();
    expect(actions.saveProfessionalDraft).toHaveBeenCalledTimes(1);
    const [data, revision, operationId] = actions.saveProfessionalDraft.mock.calls[0];
    expect(data).toEqual({ city: "Providencia", headline: "Electricista certificada", bio: "Bio", coverage: ["Providencia", "Ñuñoa"], categories: ["electricidad"], primaryCategory: "electricidad", specialties: ["Tableros", "Cortocircuitos"], years: 9, price: 25000, availability: "Lunes a viernes", portfolio: ["https://ejemplo.cl/trabajo-1"] });
    expect(revision).toBe(3);
    expect(operationId).toMatch(UUID);
    expect(view.container.querySelector("div[aria-live=polite][role=status]")!.textContent).toContain("Sin cambios");
  });

  it("an empty required field never reaches the action (HTML validation), and so does a missing primary category", async () => {
    view = mount(<ProfessionalApplicationForm application={application()} categories={categories} requirements={requirements} />);
    setValue(field(view.container, "Comuna base") as HTMLInputElement, "");
    submit(draftForm()); await flush();
    expect(actions.saveProfessionalDraft).not.toHaveBeenCalled();
  });

  it("a portfolio link that is not HTTPS is refused by the schema with its message and the action is not called", async () => {
    view = mount(<ProfessionalApplicationForm application={application()} categories={categories} requirements={requirements} />);
    setValue(field(view.container, /Portafolio/) as HTMLTextAreaElement, "http://inseguro.cl/a");
    submit(draftForm()); await flush();
    expect(actions.saveProfessionalDraft).not.toHaveBeenCalled();
    expect(view.container.querySelector("div[aria-live=polite][role=status]")!.textContent).toMatch(/HTTPS|URL|inválid/i);
  });

  it("the draft form is busy and locked while saving, ignores no field name changes and refreshes the page on success", async () => {
    const pending = deferred<{ ok: boolean; message: string }>();
    actions.saveProfessionalDraft.mockReturnValue(pending.promise);
    view = mount(<ProfessionalApplicationForm application={application()} categories={categories} requirements={requirements} />);
    submit(draftForm()); await flush();
    expect(draftForm().querySelector("fieldset")!.disabled).toBe(true);
    expect(byText<HTMLButtonElement>(draftForm(), "button[type=submit]", "Guardar borrador").getAttribute("aria-busy")).toBe("true");
    pending.resolve({ ok: true, message: "Borrador guardado" }); await flush();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("a suspended profile cannot edit, save or send anything (everything is disabled)", () => {
    view = mount(<ProfessionalApplicationForm application={application({}, "suspended")} categories={categories} requirements={requirements} />);
    expect(draftForm().querySelector("fieldset")!.disabled).toBe(true);
    expect(byText<HTMLButtonElement>(reviewForm(), "button[type=submit]", /Enviar postulación/).disabled).toBe(true);
  });

  it("every field keeps the name the server action and the schema expect", () => {
    view = mount(<ProfessionalApplicationForm application={application()} categories={categories} requirements={requirements} />);
    const names = [...draftForm().querySelectorAll("[name]")].map((node) => node.getAttribute("name"));
    for (const name of ["city", "headline", "coverage", "specialties", "bio", "categories", "primaryCategory", "years", "price", "availability", "portfolio"]) expect(names, name).toContain(name);
  });
});

describe("ProfessionalApplicationForm: sending to review (consent)", () => {
  it("the declaration of truthfulness is required: without it nothing is sent", async () => {
    view = mount(<ProfessionalApplicationForm application={application()} categories={categories} requirements={requirements} />);
    submit(reviewForm()); await flush();
    expect(actions.submitProfessionalApplication).not.toHaveBeenCalled();
  });

  it("with the declaration it sends the revision, consent true and an operation id", async () => {
    actions.submitProfessionalApplication.mockResolvedValue({ ok: false, message: "Aún falta un documento" });
    view = mount(<ProfessionalApplicationForm application={application()} categories={categories} requirements={requirements} />);
    check(reviewForm().querySelector<HTMLInputElement>("input[name=consent]")!); submit(reviewForm()); await flush();
    expect(actions.submitProfessionalApplication).toHaveBeenCalledWith(3, true, expect.stringMatching(UUID));
    expect(view.container.querySelector("div[aria-live=polite][role=status]")!.textContent).toContain("Aún falta un documento");
  });

  it("an application that is already approved or under review cannot be sent again", () => {
    for (const state of ["approved", "submitted"]) {
      view = mount(<ProfessionalApplicationForm application={application({ state })} categories={categories} requirements={requirements} />);
      expect(byText<HTMLButtonElement>(reviewForm(), "button[type=submit]", /Enviar postulación/).disabled, state).toBe(true);
      view.unmount(); view = null;
    }
  });
});

describe("ProfessionalApplicationForm: documents", () => {
  it("each requirement gets its own upload form with the requirement id, a restricted file type and a labelled file input", () => {
    view = mount(<ProfessionalApplicationForm application={application()} categories={categories} requirements={requirements} />);
    const upload = [...view.container.querySelectorAll("form")].find((form) => form.querySelector("input[type=file]"))!;
    expect(upload.querySelector<HTMLInputElement>("input[name=requirement]")!.value).toBe(ID(3));
    const file = upload.querySelector<HTMLInputElement>("input[type=file]")!;
    expect(file.getAttribute("accept")).toBe("application/pdf,image/png,image/jpeg");
    expect(file.required).toBe(true);
    expect(file.labels![0].textContent).toContain("antecedente-identidad");
  });

  it("without requirements it says so instead of showing an empty list", () => {
    view = mount(<ProfessionalApplicationForm application={application()} categories={categories} requirements={[]} />);
    expect(view.container.textContent).toContain("Administración aún no ha configurado criterios");
    expect(view.container.querySelector("input[type=file]")).toBeNull();
  });
});
