// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { byText, check, deferred, field, flush, mount, setValue, submit } from "@/test/form-helpers";

const flow = vi.hoisted(() => ({ checkPasswordFlow: vi.fn() }));
const passwordAction = vi.hoisted(() => ({ updatePassword: vi.fn() }));
const callbackAction = vi.hoisted(() => ({ confirmAuthLink: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/services/auth/auth-flow-service", () => flow);
vi.mock("@/app/auth/update-password/actions", () => passwordAction);
vi.mock("@/app/auth/callback/actions", () => callbackAction);

import { RecoveryForm } from "@/components/auth/recovery-form";

let view: ReturnType<typeof mount> | null = null;
beforeEach(() => { flow.checkPasswordFlow.mockReset(); passwordAction.updatePassword.mockReset(); callbackAction.confirmAuthLink.mockReset(); });
afterEach(() => { view?.unmount(); view = null; vi.unstubAllGlobals(); });

async function passwordPage(kind: "invite" | "recovery" | null, query: { error?: string } = {}) {
  flow.checkPasswordFlow.mockImplementation(async () => { if (kind === null) throw new Error("sin enlace"); return kind; });
  const { default: PasswordPage } = await import("@/app/auth/update-password/page");
  view = mount(await PasswordPage({ searchParams: Promise.resolve(query) }));
  return view;
}
const form = () => view!.container.querySelector("form")!;
const STRONG = "ClaveSegura123";

describe("/auth/update-password with a valid RECOVERY link", () => {
  it("asks only for the new password twice, with the right autocomplete, length and strength rules", async () => {
    await passwordPage("recovery");
    expect([...form().querySelectorAll("input")].map((input) => input.name)).toEqual(["password", "confirmPassword"]);
    for (const input of form().querySelectorAll<HTMLInputElement>("input")) {
      expect(input.type).toBe("password"); expect(input.required).toBe(true); expect(input.autocomplete).toBe("new-password");
      expect(input.minLength).toBe(12); expect(input.maxLength).toBe(128);
      expect(input.labels![0].textContent).toMatch(/contraseña/i);
      expect(() => new RegExp(`^(?:${input.pattern})$`, "v")).not.toThrow(); // valid under the `v` flag browsers use for `pattern`
    }
    expect(view!.container.querySelector("h1")!.textContent).toBe("Define tu nueva contraseña");
  });

  it("a weak password is blocked in the browser and the action is not called; a strong one reaches the action with both fields", async () => {
    await passwordPage("recovery");
    setValue(field(view!.container, "Nueva contraseña") as HTMLInputElement, "corta1A");
    setValue(field(view!.container, "Repite la contraseña") as HTMLInputElement, "corta1A");
    submit(form()); await flush();
    expect(passwordAction.updatePassword).not.toHaveBeenCalled();
    setValue(field(view!.container, "Nueva contraseña") as HTMLInputElement, STRONG);
    setValue(field(view!.container, "Repite la contraseña") as HTMLInputElement, STRONG);
    submit(form()); await flush();
    expect(passwordAction.updatePassword).toHaveBeenCalledTimes(1);
    const data = passwordAction.updatePassword.mock.calls[0][0] as FormData;
    expect([data.get("password"), data.get("confirmPassword")]).toEqual([STRONG, STRONG]);
    expect([...data.keys()].sort()).toEqual(["confirmPassword", "password"]);
  });

  it("the submit button is busy and blocked while the action runs (useFormStatus)", async () => {
    const pending = deferred<void>();
    passwordAction.updatePassword.mockReturnValue(pending.promise);
    await passwordPage("recovery");
    setValue(field(view!.container, "Nueva contraseña") as HTMLInputElement, STRONG);
    setValue(field(view!.container, "Repite la contraseña") as HTMLInputElement, STRONG);
    submit(form()); await flush();
    const button = byText<HTMLButtonElement>(form(), "button[type=submit]", /Guardar contraseña/);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.disabled).toBe(true);
    pending.resolve(); await flush();
    expect(button.disabled).toBe(false);
  });

  it("an error from a previous attempt is announced as an alert without revealing why", async () => {
    await passwordPage("recovery", { error: "1" });
    expect(view!.container.querySelector("[role=alert]")!.textContent).toBe("No pudimos completar el cambio. Revisa los datos o solicita un nuevo enlace.");
  });
});

describe("/auth/update-password with a valid INVITATION link", () => {
  it("also collects name, phone and the acceptance of terms, all required, plus the password", async () => {
    await passwordPage("invite");
    expect([...form().querySelectorAll("input")].map((input) => input.name)).toEqual(["firstName", "lastName", "phone", "acceptTerms", "password", "confirmPassword"]);
    expect(form().querySelector<HTMLInputElement>("input[name=acceptTerms]")!.required).toBe(true);
    expect(field(view!.container, "Teléfono").getAttribute("autocomplete")).toBe("tel");
    expect(view!.container.querySelector("h1")!.textContent).toBe("Completa tu cuenta");
  });

  it("without accepting the terms nothing is sent; with every field it sends all of them", async () => {
    await passwordPage("invite");
    setValue(field(view!.container, "Nombre") as HTMLInputElement, "Ana");
    setValue(field(view!.container, "Apellido") as HTMLInputElement, "Pérez");
    setValue(field(view!.container, "Teléfono") as HTMLInputElement, "+56911112222");
    setValue(field(view!.container, "Nueva contraseña") as HTMLInputElement, STRONG);
    setValue(field(view!.container, "Repite la contraseña") as HTMLInputElement, STRONG);
    submit(form()); await flush();
    expect(passwordAction.updatePassword).not.toHaveBeenCalled();
    check(form().querySelector<HTMLInputElement>("input[name=acceptTerms]")!); submit(form()); await flush();
    const data = passwordAction.updatePassword.mock.calls[0][0] as FormData;
    expect(Object.fromEntries([...data.entries()].filter(([key]) => key !== "acceptTerms"))).toEqual({ firstName: "Ana", lastName: "Pérez", phone: "+56911112222", password: STRONG, confirmPassword: STRONG });
    expect(data.get("acceptTerms")).toBe("on");
  });
});

describe("/auth/update-password without a valid link (fail closed)", () => {
  it("shows no form at all, only how to ask for a new link", async () => {
    await passwordPage(null);
    expect(view!.container.querySelector("form")).toBeNull();
    expect(view!.container.querySelector("a[href='/recuperar-contrasena']")).not.toBeNull();
    expect(view!.container.textContent).toContain("El enlace no está disponible o ya expiró");
  });
});

describe("/auth/callback (confirm an emailed link)", () => {
  const callback = async (query: Record<string, string | undefined>) => {
    const { default: CallbackPage } = await import("@/app/auth/callback/page");
    view = mount(await CallbackPage({ searchParams: Promise.resolve(query) }));
    return view;
  };

  it("a well-formed token shows a single confirmation button and carries token, code and type as hidden fields", async () => {
    const token = "a".repeat(64);
    await callback({ token_hash: token, type: "recovery" });
    const hidden = Object.fromEntries([...view!.container.querySelectorAll<HTMLInputElement>("input[type=hidden]")].map((input) => [input.name, input.value]));
    expect(hidden).toEqual({ token_hash: token, code: "", type: "recovery" });
    expect(view!.container.querySelectorAll("button[type=submit]")).toHaveLength(1);
    expect(view!.container.querySelector("h1")!.textContent).toBe("Confirma tu acceso");
  });

  it("malformed tokens, unknown types or an error parameter show no form (so an arbitrary link cannot be submitted)", async () => {
    for (const query of [{ token_hash: "corto", type: "recovery" }, { token_hash: "a".repeat(64), type: "magiclink-falso" }, { token_hash: "a".repeat(64), type: "recovery", error: "expired" }, {}]) {
      await callback(query);
      expect(view!.container.querySelector("form"), JSON.stringify(query)).toBeNull();
      expect(view!.container.querySelector("h1")!.textContent).toBe("El enlace no está disponible");
      view!.unmount(); view = null;
    }
  });
});

describe("RecoveryForm (request a password reset)", () => {
  it("posts the email to /api/auth as a recover action, and always answers with the same neutral message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    view = mount(<RecoveryForm />);
    setValue(field(view.container, "Correo electrónico") as HTMLInputElement, "ana@ejemplo.cl");
    submit(form()); await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recover", input: { email: "ana@ejemplo.cl" } }) });
    expect(view.container.textContent).toContain("Si el correo corresponde a una cuenta habilitada, recibirás instrucciones");
  });

  it("a network error gives the SAME neutral message (it must not reveal whether the account exists)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    view = mount(<RecoveryForm />);
    setValue(field(view.container, "Correo electrónico") as HTMLInputElement, "ana@ejemplo.cl");
    submit(form()); await flush();
    expect(view.container.textContent).toContain("Si el correo corresponde a una cuenta habilitada, recibirás instrucciones");
  });

  it("requires an email, caps its length and blocks the button while the request is in flight", async () => {
    const pending = deferred<{ ok: boolean }>();
    const fetchMock = vi.fn().mockReturnValue(pending.promise);
    vi.stubGlobal("fetch", fetchMock);
    view = mount(<RecoveryForm />);
    const email = field(view.container, "Correo electrónico") as HTMLInputElement;
    expect([email.required, email.type, email.maxLength, email.autocomplete]).toEqual([true, "email", 254, "email"]);
    submit(form()); await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    setValue(email, "ana@ejemplo.cl"); submit(form()); await flush();
    expect(byText<HTMLButtonElement>(form(), "button[type=submit]", "Solicitar recuperación").getAttribute("aria-busy")).toBe("true");
    pending.resolve({ ok: true }); await flush();
  });
});
