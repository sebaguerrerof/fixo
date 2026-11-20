// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { byText, check, deferred, field, flush, mount, setValue, submit } from "@/test/form-helpers";

const auth = vi.hoisted(() => ({ registerCustomer: vi.fn(), registerTechnician: vi.fn(), signIn: vi.fn() }));
const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("server-only", () => ({}));
vi.mock("@/services/auth/authentication-service", () => ({ AuthenticationService: class { registerCustomer = auth.registerCustomer; registerTechnician = auth.registerTechnician; signIn = auth.signIn; } }));
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => search.params }));

import { CustomerSignUpForm, TechnicianSignUpForm } from "@/components/auth/sign-up-forms";
import { SignInForm } from "@/components/auth/sign-in-form";

let view: ReturnType<typeof mount> | null = null;
beforeEach(() => { Object.values(auth).forEach((mock) => mock.mockReset()); Object.values(router).forEach((mock) => mock.mockReset()); search.params = new URLSearchParams(); });
afterEach(() => { view?.unmount(); view = null; });
const form = () => view!.container.querySelector("form")!;
const STRONG = "ClaveSegura123";

function fillCustomer(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = { "Nombre": "Ana", "Apellido": "Pérez", "Correo electrónico": "Ana@Ejemplo.cl", "Teléfono": "+56 9 1111 2222", "Contraseña": STRONG, "Repite la contraseña": STRONG, ...overrides };
  for (const [label, value] of Object.entries(values)) setValue(field(view!.container, label) as HTMLInputElement, value);
}

describe("Customer registration", () => {
  it("every field has the right type, autocomplete and length so browsers can help", () => {
    view = mount(<CustomerSignUpForm />);
    const spec = (label: string) => { const input = field(view!.container, label) as HTMLInputElement; return [input.name, input.type, input.autocomplete, input.required, input.maxLength]; };
    expect(spec("Nombre")).toEqual(["firstName", "text", "given-name", true, 60]);
    expect(spec("Correo electrónico")).toEqual(["email", "email", "email", true, 254]);
    expect(spec("Teléfono")).toEqual(["phone", "tel", "tel", true, 24]);
    expect(spec("Contraseña")).toEqual(["password", "password", "new-password", true, 128]);
  });

  it("the terms and privacy acceptance is required: nothing is sent without it", async () => {
    view = mount(<CustomerSignUpForm />);
    fillCustomer(); submit(form()); await flush();
    expect(auth.registerCustomer).not.toHaveBeenCalled();
  });

  it("sends the normalised data (email lowercased, trimmed) and then tells the user to check their email, without saying whether the account existed", async () => {
    auth.registerCustomer.mockResolvedValue(undefined);
    view = mount(<CustomerSignUpForm />);
    fillCustomer(); check(view.container.querySelector<HTMLInputElement>("input[name=acceptTerms]")!); submit(form()); await flush();
    expect(auth.registerCustomer).toHaveBeenCalledWith({ firstName: "Ana", lastName: "Pérez", phone: "+56 9 1111 2222", email: "ana@ejemplo.cl", password: STRONG, confirmPassword: STRONG, acceptTerms: true });
    expect(view.container.textContent).toContain("Revisa tu correo");
    expect(view.container.textContent).toContain("Si podemos completar el registro");
  });

  it("a mismatch between the passwords is reported on the confirmation field, tied to it, and the action is not called", async () => {
    view = mount(<CustomerSignUpForm />);
    fillCustomer({ "Repite la contraseña": "OtraClaveDistinta1" });
    check(view.container.querySelector<HTMLInputElement>("input[name=acceptTerms]")!); submit(form()); await flush();
    expect(auth.registerCustomer).not.toHaveBeenCalled();
    const confirm = field(view.container, "Repite la contraseña") as HTMLInputElement;
    expect(confirm.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(confirm.getAttribute("aria-describedby")!)!.textContent).toBe("Las contraseñas no coinciden.");
  });

  it("a weak password is explained under its own field", async () => {
    view = mount(<CustomerSignUpForm />);
    fillCustomer({ "Contraseña": "corta", "Repite la contraseña": "corta" });
    check(view.container.querySelector<HTMLInputElement>("input[name=acceptTerms]")!); submit(form()); await flush();
    const password = field(view.container, "Contraseña") as HTMLInputElement;
    expect(document.getElementById(password.getAttribute("aria-describedby")!)!.textContent).toMatch(/12 caracteres/);
  });

  it("a server failure shows a generic message and keeps the form (no detail leaks)", async () => {
    auth.registerCustomer.mockRejectedValue(new Error("duplicate key value violates unique constraint"));
    view = mount(<CustomerSignUpForm />);
    fillCustomer(); check(view.container.querySelector<HTMLInputElement>("input[name=acceptTerms]")!); submit(form()); await flush();
    expect(view.container.textContent).toContain("No pudimos completar la solicitud. Inténtalo más tarde.");
    expect(view.container.textContent).not.toContain("duplicate key");
    expect(view.container.querySelector("form")).not.toBeNull();
  });

  it("the button is busy and the form is not submitted twice while the request is in flight", async () => {
    const pending = deferred<void>();
    auth.registerCustomer.mockReturnValue(pending.promise);
    view = mount(<CustomerSignUpForm />);
    fillCustomer(); check(view.container.querySelector<HTMLInputElement>("input[name=acceptTerms]")!); submit(form()); await flush();
    expect(byText<HTMLButtonElement>(form(), "button[type=submit]", "Crear cuenta").getAttribute("aria-busy")).toBe("true");
    pending.resolve(); await flush();
  });
});

function pickCommunes(container: HTMLElement, region: string, base: string, more: string[] = []) {
  const regionId = (label: string | RegExp) => (field(container, label) as HTMLSelectElement);
  const byName = (name: string) => [...container.querySelectorAll("label")].find((label) => label.textContent === name)!.querySelector("input")!;
  const regionSelect = regionId(/^Región$/);
  setValue(regionSelect, [...regionSelect.options].find((option) => option.textContent === region)!.value);
  setValue(field(container, "Comuna base") as HTMLSelectElement, base);
  for (const name of more) check(byName(name));
}

describe("Technician application registration", () => {
  const categories = [{ id: "electricidad", slug: "electricidad", name: "Electricidad", description: "", icon: "zap" as never, technicianCount: 0 }, { id: "gasfiteria", slug: "gasfiteria", name: "Gasfitería", description: "", icon: "droplet" as never, technicianCount: 0 }];

  it("needs at least one trade and a coverage commune, and sends the selected trade ids", async () => {
    auth.registerTechnician.mockResolvedValue(undefined);
    view = mount(<TechnicianSignUpForm categories={categories} />);
    fillCustomer(); pickCommunes(view.container, "Metropolitana de Santiago", "Providencia", ["Ñuñoa"]);
    check(view.container.querySelector<HTMLInputElement>("input[name=acceptTerms]")!); submit(form()); await flush();
    expect(auth.registerTechnician).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain("Selecciona al menos un rubro.");
    check(view.container.querySelector<HTMLInputElement>("input[name=categoryIds][value=electricidad]")!); submit(form()); await flush();
    expect(auth.registerTechnician).toHaveBeenCalledTimes(1);
    expect(auth.registerTechnician.mock.calls[0][0]).toMatchObject({ categoryIds: ["electricidad"], city: "Providencia", coverageAreas: "Providencia, Ñuñoa", email: "ana@ejemplo.cl", acceptTerms: true });
  });

  it("says that the application stays pending until an administrative review", () => {
    view = mount(<TechnicianSignUpForm categories={categories} />);
    expect(view.container.textContent).toContain("se publicará solo tras una revisión administrativa");
  });
});

describe("SignInForm", () => {
  const fillLogin = () => { setValue(field(view!.container, "Correo electrónico") as HTMLInputElement, "ana@ejemplo.cl"); setValue(field(view!.container, "Contraseña") as HTMLInputElement, "cualquiera"); };

  it("sends the credentials and goes to the dashboard of the role (replace, so Back does not return to the login)", async () => {
    auth.signIn.mockResolvedValue({ user: { role: "customer" } });
    view = mount(<SignInForm />);
    fillLogin(); submit(form()); await flush(); await flush();
    expect(auth.signIn).toHaveBeenCalledWith({ email: "ana@ejemplo.cl", password: "cualquiera" });
    expect(router.replace).toHaveBeenCalledWith("/cliente");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("honours a safe continuation target but ignores an external one (no open redirect)", async () => {
    auth.signIn.mockResolvedValue({ user: { role: "customer" } });
    search.params = new URLSearchParams({ continuar: "/solicitar" });
    view = mount(<SignInForm />);
    fillLogin(); submit(form()); await flush(); await flush();
    expect(router.replace).toHaveBeenLastCalledWith("/solicitar");
    view.unmount(); router.replace.mockReset();
    search.params = new URLSearchParams({ continuar: "https://evil.example/robo" });
    view = mount(<SignInForm />);
    fillLogin(); submit(form()); await flush(); await flush();
    expect(router.replace).toHaveBeenLastCalledWith("/cliente");
  });

  it("a failed sign-in shows the message as an alert, keeps the user on the page and re-enables the button", async () => {
    auth.signIn.mockRejectedValue(new Error("Correo o contraseña incorrectos."));
    view = mount(<SignInForm />);
    fillLogin(); submit(form()); await flush(); await flush();
    expect(view.container.querySelector("[role=alert]")!.textContent).toContain("Correo o contraseña incorrectos.");
    expect(router.replace).not.toHaveBeenCalled();
    expect(byText<HTMLButtonElement>(form(), "button[type=submit]", /Ingresar/).disabled).toBe(false);
  });

  it("an empty or invalid email is reported on its field and nothing is sent; the password can be shown and hidden", async () => {
    view = mount(<SignInForm />);
    setValue(field(view.container, "Correo electrónico") as HTMLInputElement, "no-es-correo");
    submit(form()); await flush(); await flush();
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(view.container.querySelector("#" + CSS.escape((field(view.container, "Correo electrónico") as HTMLInputElement).getAttribute("aria-describedby")!))!.textContent).toContain("correo válido");
    const password = field(view.container, "Contraseña") as HTMLInputElement;
    const toggle = view.container.querySelector<HTMLButtonElement>("button[aria-pressed]")!;
    expect([password.type, toggle.getAttribute("aria-pressed"), toggle.getAttribute("aria-label")]).toEqual(["password", "false", "Mostrar contraseña"]);
    toggle.click(); await flush();
    expect([password.type, toggle.getAttribute("aria-pressed"), toggle.getAttribute("aria-label")]).toEqual(["text", "true", "Ocultar contraseña"]);
  });

  it("while signing in the submit button is busy and a second submission is ignored", async () => {
    const pending = deferred<{ user: { role: string } }>();
    auth.signIn.mockReturnValue(pending.promise);
    view = mount(<SignInForm />);
    fillLogin(); submit(form()); await flush(); await flush();
    expect(byText<HTMLButtonElement>(form(), "button[type=submit]", /Ingresar/).getAttribute("aria-busy")).toBe("true");
    submit(form()); await flush();
    expect(auth.signIn).toHaveBeenCalledTimes(1);
    pending.resolve({ user: { role: "customer" } }); await flush();
  });
});
