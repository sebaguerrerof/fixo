// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { byText, deferred, field, flush, mount, setValue, submit } from "@/test/form-helpers";

const action = vi.hoisted(() => ({ change: vi.fn() }));
vi.mock("@/app/perfil/password-actions", () => ({ changePasswordAction: action.change }));

import { ChangePasswordForm } from "@/components/auth/change-password-form";

let view: ReturnType<typeof mount> | null = null;
beforeEach(() => action.change.mockReset());
afterEach(() => { view?.unmount(); view = null; });
const form = () => view!.container.querySelector("form")!;
function fill(current = "Actual-clave-123", next = "Nueva-clave-4567", again = next) {
  setValue(field(view!.container, "Contraseña actual") as HTMLInputElement, current);
  setValue(field(view!.container, "Contraseña nueva") as HTMLInputElement, next);
  setValue(field(view!.container, "Repite la contraseña nueva") as HTMLInputElement, again);
}

describe("ChangePasswordForm", () => {
  it("asks for the current password, the new one and its repetition, with the right autocomplete", () => {
    view = mount(<ChangePasswordForm />);
    const spec = (label: string) => { const i = field(view!.container, label) as HTMLInputElement; return [i.name, i.type, i.autocomplete, i.required]; };
    expect(spec("Contraseña actual")).toEqual(["currentPassword", "password", "current-password", true]);
    expect(spec("Contraseña nueva")).toEqual(["password", "password", "new-password", true]);
    expect(spec("Repite la contraseña nueva")).toEqual(["confirmPassword", "password", "new-password", true]);
  });

  it("does not submit a weak new password (browser validation)", async () => {
    view = mount(<ChangePasswordForm />);
    fill("Actual-clave-123", "corta");
    submit(form());
    await flush();
    expect(action.change).not.toHaveBeenCalled();
  });

  it("sends the three values, shows the result and clears the fields on success", async () => {
    action.change.mockResolvedValue({ ok: true, message: "Contraseña actualizada. Cerramos tus otras sesiones." });
    view = mount(<ChangePasswordForm />);
    fill();
    submit(form());
    await flush();
    expect(action.change).toHaveBeenCalledWith({ currentPassword: "Actual-clave-123", password: "Nueva-clave-4567", confirmPassword: "Nueva-clave-4567" });
    expect(byText(view.container, "div, p, span", "Contraseña actualizada. Cerramos tus otras sesiones.")).toBeTruthy();
    expect((field(view.container, "Contraseña actual") as HTMLInputElement).value).toBe("");
  });

  it("keeps the fields and shows the error when it fails", async () => {
    action.change.mockResolvedValue({ ok: false, message: "La contraseña actual no es correcta." });
    view = mount(<ChangePasswordForm />);
    fill();
    submit(form());
    await flush();
    expect(byText(view.container, "div, p, span", "La contraseña actual no es correcta.")).toBeTruthy();
    expect((field(view.container, "Contraseña actual") as HTMLInputElement).value).toBe("Actual-clave-123");
  });

  it("ignores a second submit while the first one is in flight", async () => {
    const pending = deferred<{ ok: boolean; message: string }>();
    action.change.mockReturnValue(pending.promise);
    view = mount(<ChangePasswordForm />);
    fill();
    submit(form());
    submit(form());
    await flush();
    expect(action.change).toHaveBeenCalledTimes(1);
    pending.resolve({ ok: true, message: "ok" });
    await flush();
  });
});
