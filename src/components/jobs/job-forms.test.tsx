// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { byText, check, deferred, field, flush, mount, setValue, submit } from "@/test/form-helpers";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const jobs = vi.hoisted(() => ({ performJobCommand: vi.fn() }));
const requests = vi.hoisted(() => ({ cancelServiceRequest: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/jobs", () => jobs);
vi.mock("@/app/cliente/solicitudes/[id]/actions", () => requests);

import { JobCommandForm, JobFieldInput, JobFieldSelect, JobMessage, JobReason } from "@/components/jobs/job-command-form";
import { CancelRequestButton, RequestPhotoForm } from "@/components/service-requests/request-actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let view: ReturnType<typeof mount> | null = null;
beforeEach(() => { jobs.performJobCommand.mockReset(); requests.cancelServiceRequest.mockReset(); router.refresh.mockReset(); });
afterEach(() => { view?.unmount(); view = null; vi.unstubAllGlobals(); });
const form = () => view!.container.querySelector("form")!;
const confirm = () => view!.container.querySelector<HTMLInputElement>("input[name=confirm]")!;

describe("JobCommandForm (every operational command on a job)", () => {
  const mountSchedule = () => mount(
    <JobCommandForm action="propose_schedule" jobId="job-1" label="Proponer fecha" revision={4} values={{ proposalId: "p-1" }}>
      <JobFieldInput label="Fecha en Santiago" name="date" type="date" />
      <JobFieldSelect label="Si se repite la hora" name="startChoice"><option value="">Aclarar</option><option value="first">Primera</option></JobFieldSelect>
      <JobReason />
    </JobCommandForm>,
  );
  const fillSchedule = () => {
    setValue(field(view!.container, "Fecha en Santiago") as HTMLInputElement, "2026-12-01");
    setValue(field(view!.container, "Motivo") as HTMLTextAreaElement, "Reprogramación por lluvia");
  };

  it("needs the explicit confirmation: without it nothing is sent", async () => {
    view = mountSchedule(); fillSchedule(); submit(form()); await flush();
    expect(jobs.performJobCommand).not.toHaveBeenCalled();
  });

  it("sends the command with the job, the revision it was loaded at, an operation id and every field (the confirmation is NOT part of the payload)", async () => {
    jobs.performJobCommand.mockResolvedValue({ ok: false, message: "Revisión desactualizada" });
    view = mountSchedule(); fillSchedule(); check(confirm()); submit(form()); await flush();
    expect(jobs.performJobCommand).toHaveBeenCalledWith({
      jobId: "job-1", expectedRevision: 4, operationId: expect.stringMatching(UUID),
      command: { action: "propose_schedule", payload: { proposalId: "p-1", date: "2026-12-01", startChoice: "", reason: "Reprogramación por lluvia" } },
    });
    expect(Object.keys(jobs.performJobCommand.mock.calls[0][0].command.payload)).not.toContain("confirm");
    expect(view.container.querySelector("[role=alert]")!.textContent).toContain("Revisión desactualizada");
  });

  it("an identical retry reuses the operation id (the server replays idempotently); changing a field renews it", async () => {
    jobs.performJobCommand.mockResolvedValue({ ok: false, message: "x" });
    view = mountSchedule(); fillSchedule(); check(confirm()); submit(form()); await flush(); submit(form()); await flush();
    const [first, second] = jobs.performJobCommand.mock.calls.map((call) => call[0].operationId);
    expect(second).toBe(first);
    setValue(field(view.container, "Motivo") as HTMLTextAreaElement, "Otro motivo distinto"); submit(form()); await flush();
    expect(jobs.performJobCommand.mock.calls[2][0].operationId).not.toBe(first);
  });

  it("is busy and locked while the command runs and ignores a second submit", async () => {
    const pending = deferred<{ ok: boolean; message: string }>();
    jobs.performJobCommand.mockReturnValue(pending.promise);
    view = mountSchedule(); fillSchedule(); check(confirm()); submit(form()); await flush();
    expect(form().querySelector("fieldset")!.disabled).toBe(true);
    expect(byText<HTMLButtonElement>(form(), "button[type=submit]", "Proponer fecha").getAttribute("aria-busy")).toBe("true");
    submit(form()); await flush();
    expect(jobs.performJobCommand).toHaveBeenCalledTimes(1);
    pending.resolve({ ok: false, message: "listo" }); await flush();
    expect(form().querySelector("fieldset")!.disabled).toBe(false);
  });

  it("a network failure keeps the operation id and tells the user it is safe to retry with the same data", async () => {
    jobs.performJobCommand.mockRejectedValue(new Error("offline"));
    view = mountSchedule(); fillSchedule(); check(confirm()); submit(form()); await flush();
    expect(view.container.textContent).toContain("Puedes reintentar con los mismos campos");
  });

  it("job fields label their own control and never share ids with other fields", () => {
    view = mount(<><JobFieldInput label="Desde" name="startTime" type="time" /><JobFieldInput label="Hasta" name="endTime" type="time" /><JobMessage /><JobMessage label="Resultado" name="result" /></>);
    const ids = [...view.container.querySelectorAll("input, textarea")].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const control of view.container.querySelectorAll<HTMLInputElement>("input, textarea")) expect(control.labels!.length).toBe(1);
    expect((field(view.container, "Mensaje") as HTMLTextAreaElement).minLength).toBe(10);
  });
});

describe("CancelRequestButton (customer cancels a request)", () => {
  it("asks for confirmation first: declining does nothing", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    view = mount(<CancelRequestButton id="req-1" revision={2} />);
    byText(view.container, "button", "Cancelar solicitud").click(); await flush();
    expect(requests.cancelServiceRequest).not.toHaveBeenCalled();
  });

  it("confirming cancels with the id and the revision, then refreshes the page", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    requests.cancelServiceRequest.mockResolvedValue({ ok: true });
    view = mount(<CancelRequestButton id="req-1" revision={2} />);
    byText(view.container, "button", "Cancelar solicitud").click(); await flush();
    expect(requests.cancelServiceRequest).toHaveBeenCalledWith("req-1", 2);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("a refusal from the server is shown as an alert and nothing is refreshed", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    requests.cancelServiceRequest.mockResolvedValue({ ok: false, message: "Ya tiene un trabajo" });
    view = mount(<CancelRequestButton id="req-1" revision={2} />);
    byText(view.container, "button", "Cancelar solicitud").click(); await flush();
    expect(view.container.querySelector("[role=alert]")!.textContent).toContain("Ya tiene un trabajo");
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("RequestPhotoForm (private photo of a request)", () => {
  it("offers only JPEG/PNG, requires a file, says who can see it, and does not upload an empty form", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    view = mount(<RequestPhotoForm id="req-1" />);
    const file = view.container.querySelector<HTMLInputElement>("input[type=file]")!;
    expect(file.getAttribute("accept")).toBe("image/jpeg,image/png");
    expect(file.required).toBe(true);
    expect(file.labels![0].textContent).toContain("Fotografía privada");
    expect(view.container.textContent).toContain("Solo tú, administración y el técnico adjudicado");
    submit(form()); await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
