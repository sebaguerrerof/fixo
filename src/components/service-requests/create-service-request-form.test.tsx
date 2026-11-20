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
beforeEach(() => { actions.submitServiceRequest.mockReset(); router.push.mockReset(); router.refresh.mockReset(); });
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
