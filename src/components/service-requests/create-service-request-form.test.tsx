// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { field, flush, mount, setValue, submit } from "@/test/form-helpers";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const actions = vi.hoisted(() => ({ submitServiceRequest: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/solicitar/actions", () => actions);

import { CreateServiceRequestForm } from "@/components/service-requests/create-service-request-form";

const categories = [{ id: "electricidad", slug: "electricidad", name: "Electricidad", description: "", icon: "zap" as never, technicianCount: 0 }];
let view: ReturnType<typeof mount> | null = null;
beforeEach(() => { window.localStorage.clear(); actions.submitServiceRequest.mockReset(); router.push.mockReset(); router.refresh.mockReset(); });
afterEach(() => { view?.unmount(); view = null; });
const form = () => view!.container.querySelector("form")!;
const select = (label: string) => field(view!.container, label) as HTMLSelectElement;
const optionValue = (element: HTMLSelectElement, text: string) => [...element.options].find((option) => option.textContent === text)!.value;

function fillAll() {
  setValue(field(view!.container, "¿Qué necesitas resolver?") as HTMLInputElement, "Revisión de tablero eléctrico");
  setValue(select("Rubro"), "electricidad");
  setValue(field(view!.container, "Detalles del problema") as HTMLTextAreaElement, "El tablero hace un ruido extraño y una llave se calienta.");
}
function chooseCommune(regionName: string, commune: string) {
  setValue(select("Región"), optionValue(select("Región"), regionName));
  setValue(select("Comuna"), commune);
}

describe("CreateServiceRequestForm: the commune is chosen from the official list", () => {
  it("asks for the region, then the commune, and sends the official commune name", async () => {
    actions.submitServiceRequest.mockResolvedValue({ ok: true });
    view = mount(<CreateServiceRequestForm categories={categories} />);
    expect(select("Comuna").disabled).toBe(true);
    fillAll();
    chooseCommune("Metropolitana de Santiago", "Ñuñoa");
    submit(form()); await flush();
    expect(actions.submitServiceRequest).toHaveBeenCalledTimes(1);
    expect(actions.submitServiceRequest.mock.calls[0]![0]).toMatchObject({ locationLabel: "Ñuñoa", categoryId: "electricidad", title: "Revisión de tablero eléctrico" });
  });

  it("does not send the request without a commune, and says so", async () => {
    view = mount(<CreateServiceRequestForm categories={categories} />);
    fillAll();
    submit(form()); await flush();
    expect(actions.submitServiceRequest).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain("Elige una comuna de la lista.");
  });

  it("a region without a commune is not enough", async () => {
    view = mount(<CreateServiceRequestForm categories={categories} />);
    fillAll();
    setValue(select("Región"), optionValue(select("Región"), "Valparaíso"));
    submit(form()); await flush();
    expect(actions.submitServiceRequest).not.toHaveBeenCalled();
  });
});

describe("CreateServiceRequestForm: a visitor without an account", () => {
  it("fills the form, is sent to sign in on submit and keeps the public part of the draft", async () => {
    view = mount(<CreateServiceRequestForm categories={categories} signedIn={false} />);
    expect(view.container.textContent).toContain("Para enviarlo te pediremos ingresar o crear una cuenta");
    fillAll();
    chooseCommune("Metropolitana de Santiago", "Ñuñoa");
    setValue(field(view!.container, "Dirección privada (opcional)") as HTMLInputElement, "Calle Secreta 123");
    submit(form()); await flush();
    expect(actions.submitServiceRequest).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/login?continuar=%2Fsolicitar");
    const stored = window.localStorage.getItem("fixo.service-request-draft.v1")!;
    expect(stored).toContain("Revisión de tablero eléctrico");
    expect(stored).toContain("Ñuñoa");
    expect(stored).not.toContain("Secreta");
  });

  it("does not ask for sign-in while the form is still invalid", async () => {
    view = mount(<CreateServiceRequestForm categories={categories} signedIn={false} />);
    submit(form()); await flush();
    expect(router.push).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("fixo.service-request-draft.v1")).toBeNull();
  });

  it("restores the draft after signing in, then sends the request and clears the draft", async () => {
    actions.submitServiceRequest.mockResolvedValue({ ok: true });
    view = mount(<CreateServiceRequestForm categories={categories} signedIn={false} />);
    fillAll();
    chooseCommune("Valparaíso", "Viña del Mar");
    submit(form()); await flush();
    view.unmount();

    view = mount(<CreateServiceRequestForm categories={categories} />);
    await flush();
    expect(view.container.textContent).toContain("Recuperamos tu borrador");
    expect((field(view.container, "¿Qué necesitas resolver?") as HTMLInputElement).value).toBe("Revisión de tablero eléctrico");
    expect(select("Comuna").value).toBe("Viña del Mar");
    expect(select("Región").options[select("Región").selectedIndex]!.textContent).toBe("Valparaíso");
    submit(form()); await flush();
    expect(actions.submitServiceRequest.mock.calls[0]![0]).toMatchObject({ locationLabel: "Viña del Mar", categoryId: "electricidad" });
    expect(window.localStorage.getItem("fixo.service-request-draft.v1")).toBeNull();
  });

  it("keeps the form on screen and explains when the draft cannot be saved", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });
    try {
      view = mount(<CreateServiceRequestForm categories={categories} signedIn={false} />);
      fillAll();
      chooseCommune("Metropolitana de Santiago", "Ñuñoa");
      submit(form()); await flush();
      expect(router.push).not.toHaveBeenCalled();
      expect(view.container.textContent).toContain("No pudimos guardar tu borrador");
      expect((field(view.container, "¿Qué necesitas resolver?") as HTMLInputElement).value).toBe("Revisión de tablero eléctrico");
      const anyway = [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Ingresar de todos modos")!;
      anyway.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(router.push).toHaveBeenCalledWith("/login?continuar=%2Fsolicitar");
    } finally { setItem.mockRestore(); }
  });

  it("starts from the service and commune of the page the visitor came from", async () => {
    view = mount(<CreateServiceRequestForm categories={categories} initial={{ categoryId: "electricidad", locationLabel: "Providencia" }} signedIn={false} />);
    await flush();
    expect(select("Rubro").value).toBe("electricidad");
    expect(select("Comuna").value).toBe("Providencia");
    expect(select("Comuna").disabled).toBe(false);
  });

  it("ignores a starting service that does not exist", async () => {
    view = mount(<CreateServiceRequestForm categories={categories} initial={{ categoryId: "inventado" }} />);
    await flush();
    expect(select("Rubro").value).toBe("");
  });
});
