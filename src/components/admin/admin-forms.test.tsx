// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { byText, check, deferred, field, flush, mount, setValue, submit } from "@/test/form-helpers";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const review = vi.hoisted(() => ({ decideProfessionalApplication: vi.fn(), reviewProfessionalDocument: vi.fn(), versionProfessionalRequirement: vi.fn() }));
const users = vi.hoisted(() => ({ changeAccountAction: vi.fn(), observeUserAction: vi.fn(), invitationAction: vi.fn(), revokeInvitationAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/admin/postulaciones/actions", () => review);
vi.mock("@/app/admin/usuarios/actions", () => users);

import { AccountControls } from "@/components/admin/account-controls";
import { InvitationsPanel } from "@/components/admin/invitations-panel";
import { ProfessionalDecisionForm, RequirementVersionForm } from "@/components/admin/professional-review";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let view: ReturnType<typeof mount> | null = null;
beforeEach(() => { [...Object.values(review), ...Object.values(users), router.refresh].forEach((mock) => mock.mockReset()); });
afterEach(() => { view?.unmount(); view = null; vi.unstubAllGlobals(); });
const form = (index = 0) => view!.container.querySelectorAll("form")[index] as HTMLFormElement;
const alertText = () => view!.container.querySelector("div[aria-live=polite]")!.textContent ?? "";

describe("ProfessionalDecisionForm (admin decides on an application or a document)", () => {
  it("for an application: a decision and a reason are required, and the payload carries target, revision, decision, reason and an operation id", async () => {
    review.decideProfessionalApplication.mockResolvedValue({ ok: false, message: "Revisión desactualizada" });
    view = mount(<ProfessionalDecisionForm revision={7} state="submitted" target="tech-1" />);
    submit(form()); await flush();
    expect(review.decideProfessionalApplication).not.toHaveBeenCalled();
    setValue(field(view.container, "Decisión") as HTMLSelectElement, "approved");
    setValue(field(view.container, "Motivo de la decisión") as HTMLTextAreaElement, "Antecedentes completos");
    submit(form()); await flush();
    expect(review.decideProfessionalApplication).toHaveBeenCalledWith({ target: "tech-1", expected_revision: 7, decision: "approved", reason: "Antecedentes completos", operation_id: expect.stringMatching(UUID) });
    expect(alertText()).toContain("Revisión desactualizada");
  });

  it("offers only the decisions that make sense for the state (suspend an approved one; approve/ask/reject a pending one; approve/reject a document)", () => {
    const options = (node: React.ReactNode) => { view = mount(node); const values = [...view.container.querySelectorAll("option")].map((option) => option.value).filter(Boolean); view.unmount(); view = null; return values; };
    expect(options(<ProfessionalDecisionForm state="approved" target="t" revision={1} />)).toEqual(["suspended"]);
    expect(options(<ProfessionalDecisionForm state="submitted" target="t" revision={1} />)).toEqual(["needs_information", "approved", "rejected"]);
    expect(options(<ProfessionalDecisionForm documentId="d-1" />)).toEqual(["approved", "rejected"]);
  });

  it("for a document it reviews that document and does not send application fields", async () => {
    review.reviewProfessionalDocument.mockResolvedValue({ ok: false, message: "No" });
    view = mount(<ProfessionalDecisionForm documentId="doc-9" />);
    setValue(field(view.container, "Decisión") as HTMLSelectElement, "rejected");
    setValue(field(view.container, "Motivo de la decisión") as HTMLTextAreaElement, "Ilegible");
    submit(form()); await flush();
    expect(review.reviewProfessionalDocument).toHaveBeenCalledWith({ document_id: "doc-9", decision: "rejected", reason: "Ilegible" });
    expect(review.decideProfessionalApplication).not.toHaveBeenCalled();
  });

  it("locks the form while the decision is in flight and refreshes the page when it succeeds", async () => {
    const pending = deferred<{ ok: boolean; message: string }>();
    review.decideProfessionalApplication.mockReturnValue(pending.promise);
    view = mount(<ProfessionalDecisionForm revision={1} state="submitted" target="t" />);
    setValue(field(view.container, "Decisión") as HTMLSelectElement, "approved");
    setValue(field(view.container, "Motivo de la decisión") as HTMLTextAreaElement, "Todo en orden");
    submit(form()); await flush();
    expect(byText<HTMLButtonElement>(form(), "button[type=submit]", "Registrar revisión").getAttribute("aria-busy")).toBe("true");
    pending.resolve({ ok: true, message: "Registrado" }); await flush();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("RequirementVersionForm (superadmin versions a requirement)", () => {
  it("maps every field to the action input, with the legal source nullable and the required flag as a boolean", async () => {
    review.versionProfessionalRequirement.mockResolvedValue({ ok: false, message: "Fuente obligatoria" });
    view = mount(<RequirementVersionForm category="electricidad" />);
    setValue(field(view.container, "Clave del requisito") as HTMLInputElement, "antecedente-identidad");
    setValue(field(view.container, "Descripción del criterio") as HTMLTextAreaElement, "Documento vigente");
    setValue(field(view.container, "Motivo de la versión") as HTMLTextAreaElement, "Primera versión");
    check(field(view.container, /Obligatorio para publicar/) as HTMLInputElement);
    submit(form()); await flush();
    expect(review.versionProfessionalRequirement).toHaveBeenCalledWith({ category: "electricidad", key: "antecedente-identidad", requirement_kind: "internal", is_required: true, document_kind: "identity", description: "Documento vigente", source_url: null, reason: "Primera versión" });
  });

  it("the key only accepts lowercase letters, digits and dashes (pattern), so an invalid key is not sent", async () => {
    view = mount(<RequirementVersionForm category="electricidad" />);
    const key = field(view.container, "Clave del requisito") as HTMLInputElement;
    // Browsers compile `pattern` with the `v` flag, where an unescaped "-" inside a character class is a syntax error and the whole attribute is
    // silently ignored (verified in Chromium): the alternation form is valid with and without that flag.
    expect(key.pattern).toBe("(?:[a-z0-9]|-){2,60}");
    expect(() => new RegExp(`^(?:${key.pattern})$`, "v")).not.toThrow();
    setValue(key, "Clave Inválida");
    setValue(field(view.container, "Descripción del criterio") as HTMLTextAreaElement, "x y z");
    setValue(field(view.container, "Motivo de la versión") as HTMLTextAreaElement, "x y z");
    submit(form()); await flush();
    expect(review.versionProfessionalRequirement).not.toHaveBeenCalled();
  });
});

describe("AccountControls (change access to an account)", () => {
  const mountControls = (props: Partial<React.ComponentProps<typeof AccountControls>> = {}) => mount(<AccountControls id="user-1" isSelf={false} role="customer" superadmin={false} {...props} />);

  it("your own account and protected roles cannot be modified from this session", () => {
    view = mountControls({ isSelf: true });
    expect(view.container.textContent).toContain("impiden modificar su acceso");
    expect(view.container.querySelector("select")).toBeNull();
    view.unmount();
    view = mountControls({ role: "superadmin", superadmin: false });
    expect(view.container.querySelector("select")).toBeNull();
  });

  it("only a superadmin sees the role selector", () => {
    view = mountControls({ superadmin: false }); expect(view.container.querySelector("select[name=role]")).toBeNull(); view.unmount();
    view = mountControls({ superadmin: true }); expect(view.container.querySelector("select[name=role]")).not.toBeNull();
  });

  it("choosing nothing says so and sends nothing; a change needs a reason, a browser confirmation, and carries target, status, role, reason and an operation id", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    users.changeAccountAction.mockResolvedValue({ ok: false, message: "Rol protegido" });
    view = mountControls({ superadmin: true });
    setValue(field(view.container, "Motivo obligatorio") as HTMLTextAreaElement, "Revisión de seguridad");
    submit(form()); await flush();
    expect(view.container.textContent).toContain("Selecciona un cambio.");
    expect(users.changeAccountAction).not.toHaveBeenCalled();
    setValue(field(view.container, "Estado de cuenta") as HTMLSelectElement, "suspended");
    submit(form()); await flush();
    expect(users.changeAccountAction).toHaveBeenCalledWith({ targetUser: "user-1", newStatus: "suspended", newRole: null, reason: "Revisión de seguridad", operationId: expect.stringMatching(UUID) });
    expect(alertText()).toContain("Rol protegido");
  });

  it("declining the browser confirmation changes nothing", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    view = mountControls();
    setValue(field(view.container, "Estado de cuenta") as HTMLSelectElement, "blocked");
    setValue(field(view.container, "Motivo obligatorio") as HTMLTextAreaElement, "Abuso");
    submit(form()); await flush();
    expect(users.changeAccountAction).not.toHaveBeenCalled();
  });

  it("the internal observation sends the account id and the text", async () => {
    users.observeUserAction.mockResolvedValue({ ok: false, message: "x" });
    view = mountControls();
    setValue(field(view.container, "Observación interna") as HTMLTextAreaElement, "Llamó por teléfono");
    submit(form(1)); await flush();
    expect(users.observeUserAction).toHaveBeenCalledWith("user-1", "Llamó por teléfono");
  });
});

describe("InvitationsPanel (invite users by email)", () => {
  const invitations = [{ id: "inv-1", email: "nuevo@ejemplo.cl", full_name: "Persona Nueva", role: "technician" as const, state: "pending", delivery: "enviado", expires_at: "2026-12-01", created_at: "2026-11-01" }];
  const fill = () => {
    setValue(field(view!.container, "Nombre completo") as HTMLInputElement, "Ana Pérez");
    setValue(field(view!.container, "Correo") as HTMLInputElement, "ana@ejemplo.cl");
  };

  it("when sending is not enabled in this environment it says so and the invite button is disabled", () => {
    view = mount(<InvitationsPanel enabled={false} invitations={[]} superadmin />);
    expect(view.container.textContent).toContain("no está habilitado en este entorno");
    expect(byText<HTMLButtonElement>(view.container, "button[type=submit]", "Enviar invitación").disabled).toBe(true);
  });

  it("a moderator can invite only customers and technicians; a superadmin can also invite staff", () => {
    const roles = (superadmin: boolean) => { view = mount(<InvitationsPanel enabled invitations={[]} superadmin={superadmin} />); const values = [...view.container.querySelectorAll("select[name=role] option")].map((option) => option.textContent); view.unmount(); view = null; return values; };
    expect(roles(false)).toEqual(["customer", "technician"]);
    expect(roles(true)).toEqual(["customer", "technician", "moderator", "superadmin"]);
  });

  it("asks for confirmation, then sends email, name, role, one operation id and resend:false", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    users.invitationAction.mockResolvedValue({ ok: false, message: "Correo ya invitado" });
    view = mount(<InvitationsPanel enabled invitations={[]} superadmin={false} />);
    fill(); submit(form()); await flush();
    expect(users.invitationAction).toHaveBeenCalledWith({ email: "ana@ejemplo.cl", fullName: "Ana Pérez", role: "customer", operationId: expect.stringMatching(UUID), resend: false });
    expect(alertText()).toContain("Correo ya invitado");
  });

  it("an ambiguous failure keeps the SAME operation id for the retry; after a success a new one is generated", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    users.invitationAction.mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true, message: "Enviada" }).mockResolvedValue({ ok: false, message: "x" });
    view = mount(<InvitationsPanel enabled invitations={[]} superadmin={false} />);
    fill(); submit(form()); await flush(); submit(form()); await flush();
    const [first, second] = users.invitationAction.mock.calls.map((call) => call[0].operationId);
    expect(second).toBe(first);
    expect(view.container.textContent).toContain("Resultado no confirmado");
    submit(form()); await flush();
    submit(form()); await flush();
    expect(users.invitationAction.mock.calls[3][0].operationId).not.toBe(first);
  });

  it("declining the confirmation sends nothing", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    view = mount(<InvitationsPanel enabled invitations={[]} superadmin />);
    fill(); submit(form()); await flush();
    expect(users.invitationAction).not.toHaveBeenCalled();
  });

  it("resend and revoke act on the listed invitation (revoke asks for a reason of at least 3 characters)", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    users.invitationAction.mockResolvedValue({ ok: true, message: "Reenviada" });
    users.revokeInvitationAction.mockResolvedValue({ ok: true, message: "Revocada" });
    view = mount(<InvitationsPanel enabled invitations={invitations} superadmin />);
    byText(view.container, "button", "Reenviar").click(); await flush();
    expect(users.invitationAction).toHaveBeenCalledWith({ email: "nuevo@ejemplo.cl", fullName: "Persona Nueva", role: "technician", operationId: expect.stringMatching(UUID), resend: true });
    vi.stubGlobal("prompt", vi.fn(() => "no"));
    byText(view.container, "button", "Revocar").click(); await flush();
    expect(users.revokeInvitationAction).not.toHaveBeenCalled();
    vi.stubGlobal("prompt", vi.fn(() => "Ya no aplica"));
    byText(view.container, "button", "Revocar").click(); await flush();
    expect(users.revokeInvitationAction).toHaveBeenCalledWith("inv-1", "Ya no aplica");
  });
});
