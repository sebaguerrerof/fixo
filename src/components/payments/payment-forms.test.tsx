// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { byText, check, deferred, field, flush, mount, setValue, submit } from "@/test/form-helpers";

const actions = vi.hoisted(() => ({ startPayment: vi.fn(), respondExtraCharge: vi.fn(), proposeExtraCharge: vi.fn(), updateFeePolicy: vi.fn() }));
vi.mock("@/app/actions/payments", () => actions);

import { ExtraChargeProposalForm } from "@/components/payments/extra-charge-proposal-form";
import { ExtraChargeResponse } from "@/components/payments/extra-charge-response";
import { FeePolicyForm } from "@/components/payments/fee-policy-form";
import { PaymentCheckoutButton } from "@/components/payments/payment-checkout-button";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let view: ReturnType<typeof mount> | null = null;
beforeEach(() => { Object.values(actions).forEach((mock) => mock.mockReset()); });
afterEach(() => { view?.unmount(); view = null; });

describe("PaymentCheckoutButton (the customer pays the displayed total)", () => {
  const props = { jobId: "job-1", extraChargeId: null, policyVersion: 3, professionalAmountClp: 50000, platformFeeClp: 5000, totalClp: 55000 };
  const form = () => view!.container.querySelector("form")!;
  const consent = () => view!.container.querySelector<HTMLInputElement>("input[name=consent]")!;
  const pay = () => byText<HTMLButtonElement>(view!.container, "button[type=submit]", /Pagar/);

  it("shows the itemised Q + F = T and states that this is a sandbox payment", () => {
    view = mount(<PaymentCheckoutButton {...props} />);
    const text = view.container.textContent ?? "";
    expect(text).toContain("Importe del profesional (Q)");
    expect(text).toContain("Comisión SoyFixo (F)");
    expect(text).toContain("Total a pagar (T = Q + F)");
    expect(text).toContain("no se realiza ningún cobro real");
  });

  it("without the consent checkbox the payment is NOT started (HTML validation blocks the submit)", async () => {
    view = mount(<PaymentCheckoutButton {...props} />);
    submit(form()); await flush();
    expect(actions.startPayment).not.toHaveBeenCalled();
  });

  it("with consent it sends ONLY identifiers, the policy version, the consent flag and an idempotency key (never an amount)", async () => {
    actions.startPayment.mockResolvedValue({ ok: false, message: "No disponible", renewKey: false });
    view = mount(<PaymentCheckoutButton {...props} />);
    check(consent()); submit(form()); await flush();
    expect(actions.startPayment).toHaveBeenCalledTimes(1);
    const payload = actions.startPayment.mock.calls[0][0];
    expect(payload).toEqual({ jobId: "job-1", extraChargeId: null, expectedPolicyVersion: 3, consent: true, idempotencyKey: expect.stringMatching(UUID) });
    expect(JSON.stringify(payload)).not.toMatch(/55000|50000|5000|amount|total/i);
  });

  it("while the payment is being prepared the button is busy and disabled and a second submit is ignored", async () => {
    const pending = deferred<{ ok: false; message: string; renewKey: false }>();
    actions.startPayment.mockReturnValue(pending.promise);
    view = mount(<PaymentCheckoutButton {...props} />);
    check(consent()); submit(form()); await flush();
    expect(pay().getAttribute("aria-busy")).toBe("true");
    expect(pay().disabled).toBe(true);
    expect(view.container.querySelector("fieldset")!.disabled).toBe(true);
    submit(form()); await flush();
    expect(actions.startPayment).toHaveBeenCalledTimes(1);
    pending.resolve({ ok: false, message: "Listo", renewKey: false }); await flush();
    expect(pay().disabled).toBe(false);
    expect(pay().getAttribute("aria-busy")).toBeNull();
  });

  it("shows the error as an alert and keeps the SAME idempotency key for an ambiguous retry, but renews it after a definitive failure", async () => {
    actions.startPayment.mockResolvedValue({ ok: false, message: "Pendiente de confirmación", renewKey: false });
    view = mount(<PaymentCheckoutButton {...props} />);
    check(consent()); submit(form()); await flush();
    expect(view.container.querySelector("[role=alert]")!.textContent).toContain("Pendiente de confirmación");
    submit(form()); await flush();
    const [first, second] = actions.startPayment.mock.calls.map((call) => call[0].idempotencyKey);
    expect(second).toBe(first);
    actions.startPayment.mockResolvedValue({ ok: false, message: "Orden terminada", renewKey: true });
    submit(form()); await flush();
    submit(form()); await flush();
    const keys = actions.startPayment.mock.calls.map((call) => call[0].idempotencyKey);
    expect(keys[3]).not.toBe(keys[2]);
  });

  it("refuses to open a checkout whose total differs from the one the customer consented to", async () => {
    actions.startPayment.mockResolvedValue({ ok: true, checkoutUrl: "https://pago.invalid/x", totalClp: 60000 });
    view = mount(<PaymentCheckoutButton {...props} />);
    check(consent()); submit(form()); await flush();
    expect(view.container.textContent).toContain("El total cambió");
  });

  it("a rejected request (network failure) shows a neutral message and re-enables the form", async () => {
    actions.startPayment.mockRejectedValue(new Error("boom"));
    view = mount(<PaymentCheckoutButton {...props} />);
    check(consent()); submit(form()); await flush();
    expect(view.container.textContent).toContain("No se confirmó la respuesta");
    expect(pay().disabled).toBe(false);
  });
});

describe("ExtraChargeResponse (customer accepts or rejects an additional charge)", () => {
  const props = { jobId: "job-1", extraChargeId: "extra-9", policyVersion: 2, professionalAmountClp: 10000, platformFeeClp: 1000, totalClp: 11000 };
  const form = () => view!.container.querySelector("form")!;

  it("accepting requires the consent checkbox; with it the payload carries the policy version and no reason", async () => {
    actions.respondExtraCharge.mockResolvedValue({ ok: false, message: "Rechazado por el servidor" });
    view = mount(<ExtraChargeResponse {...props} />);
    submit(form()); await flush();
    expect(actions.respondExtraCharge).not.toHaveBeenCalled();
    check(view.container.querySelector<HTMLInputElement>("input[name=consent]")!); submit(form()); await flush();
    expect(actions.respondExtraCharge).toHaveBeenCalledWith({ jobId: "job-1", extraChargeId: "extra-9", decision: "accepted", expectedPolicyVersion: 2, reason: null });
    expect(view.container.querySelector("[role=alert]")!.textContent).toContain("Rechazado por el servidor");
  });

  it("rejecting needs no consent, sends no policy version and carries the typed reason", async () => {
    actions.respondExtraCharge.mockResolvedValue({ ok: false, message: "x" });
    view = mount(<ExtraChargeResponse {...props} />);
    setValue(field(view.container, /Motivo del rechazo/) as HTMLTextAreaElement, "Es demasiado caro");
    byText(view.container, "button", "Rechazar").click(); await flush();
    expect(actions.respondExtraCharge).toHaveBeenCalledWith({ jobId: "job-1", extraChargeId: "extra-9", decision: "rejected", expectedPolicyVersion: null, reason: "Es demasiado caro" });
  });

  it("blocks the controls while the answer is in flight", async () => {
    const pending = deferred<{ ok: boolean; message: string }>();
    actions.respondExtraCharge.mockReturnValue(pending.promise);
    view = mount(<ExtraChargeResponse {...props} />);
    check(view.container.querySelector<HTMLInputElement>("input[name=consent]")!); submit(form()); await flush();
    expect(view.container.querySelector("fieldset")!.disabled).toBe(true);
    pending.resolve({ ok: false, message: "ok" }); await flush();
    expect(view.container.querySelector("fieldset")!.disabled).toBe(false);
  });
});

describe("ExtraChargeProposalForm (technician proposes an additional charge)", () => {
  const form = () => view!.container.querySelector("form")!;
  const fill = (concept: string, amount: string) => {
    setValue(field(view!.container, "Concepto") as HTMLTextAreaElement, concept);
    setValue(field(view!.container, "Importe en pesos (entero)") as HTMLInputElement, amount);
  };

  it("sends the concept and the amount as a NUMBER with a generated operation id", async () => {
    actions.proposeExtraCharge.mockResolvedValue({ ok: false, message: "No" });
    view = mount(<ExtraChargeProposalForm jobId="job-1" />);
    fill("Cambio de un automático", "15000"); submit(form()); await flush();
    expect(actions.proposeExtraCharge).toHaveBeenCalledWith({ jobId: "job-1", operationId: expect.stringMatching(UUID), concept: "Cambio de un automático", amountClp: 15000 });
  });

  it("an identical retry keeps the operation id (idempotent replay); changing the content renews it", async () => {
    actions.proposeExtraCharge.mockResolvedValue({ ok: false, message: "No" });
    view = mount(<ExtraChargeProposalForm jobId="job-1" />);
    fill("Cambio de un automático", "15000"); submit(form()); await flush(); submit(form()); await flush();
    const [a, b] = actions.proposeExtraCharge.mock.calls.map((call) => call[0].operationId);
    expect(b).toBe(a);
    fill("Cambio de un automático", "16000"); submit(form()); await flush();
    expect(actions.proposeExtraCharge.mock.calls[2][0].operationId).not.toBe(a);
  });

  it("does not submit without a concept and an amount (required) and blocks while in flight", async () => {
    const pending = deferred<{ ok: boolean; message: string }>();
    actions.proposeExtraCharge.mockReturnValue(pending.promise);
    view = mount(<ExtraChargeProposalForm jobId="job-1" />);
    submit(form()); await flush();
    expect(actions.proposeExtraCharge).not.toHaveBeenCalled();
    fill("Concepto válido de prueba", "2000"); submit(form()); await flush();
    expect(view.container.querySelector("fieldset")!.disabled).toBe(true);
    expect(byText<HTMLButtonElement>(view.container, "button[type=submit]", "Proponer adicional").getAttribute("aria-busy")).toBe("true");
    pending.resolve({ ok: false, message: "x" }); await flush();
  });
});

describe("FeePolicyForm (superadmin changes the commission percentage)", () => {
  const form = () => view!.container.querySelector("form")!;

  it("shows the current version and a worked example from the typed percentage", () => {
    view = mount(<FeePolicyForm basisPoints={1000} version={4} />);
    expect(view.container.textContent).toContain("Versión vigente: 4");
    expect(view.container.textContent).toMatch(/Ejemplo: en un servicio de \$100\.000/);
  });

  it("an invalid percentage shows an error tied to the field, disables saving and never calls the action", async () => {
    view = mount(<FeePolicyForm basisPoints={1000} version={4} />);
    const percent = field(view.container, /Nuevo porcentaje/) as HTMLInputElement;
    setValue(percent, "35");
    expect(view.container.querySelector("[role=alert]")!.textContent).toContain("porcentaje válido");
    expect(percent.getAttribute("aria-invalid")).toBe("true");
    expect(percent.getAttribute("aria-describedby")).toBe(view.container.querySelector("[role=alert]")!.id);
    expect(byText<HTMLButtonElement>(view.container, "button[type=submit]", "Guardar nueva versión").disabled).toBe(true);
    submit(form()); await flush();
    expect(actions.updateFeePolicy).not.toHaveBeenCalled();
  });

  it("needs the explicit confirmation and sends expectedVersion, the percentage in basis points and the reason", async () => {
    actions.updateFeePolicy.mockResolvedValue({ ok: false, message: "Versión desactualizada" });
    view = mount(<FeePolicyForm basisPoints={1000} version={4} />);
    setValue(field(view.container, /Nuevo porcentaje/) as HTMLInputElement, "12,5");
    setValue(field(view.container, /Motivo/) as HTMLTextAreaElement, "Ajuste comercial aprobado");
    submit(form()); await flush();
    expect(actions.updateFeePolicy).not.toHaveBeenCalled();
    check(view.container.querySelector<HTMLInputElement>("input[name=confirm]")!); submit(form()); await flush();
    expect(actions.updateFeePolicy).toHaveBeenCalledWith({ expectedVersion: 4, basisPoints: 1250, reason: "Ajuste comercial aprobado" });
    expect(view.container.querySelector("[role=alert]")!.textContent).toContain("Versión desactualizada");
  });
});
