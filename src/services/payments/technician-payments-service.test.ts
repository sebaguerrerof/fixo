import { describe, expect, it, vi } from "vitest";
import { loadTechnicianPayments, parsePaymentsPage, TECHNICIAN_PAYMENTS_PAGE_SIZE } from "./technician-payments-service";
import type { JobListItem } from "@/domain/entities/job-operations";
import type { JobPaymentsLoad } from "./payment-read-service";

const item = (n: number) => ({ job: { id: `job-${n}` }, title: `Trabajo ${n}` }) as unknown as JobListItem;
const TOTAL = 45; // 3 pages: 20 + 20 + 5
const all = Array.from({ length: TOTAL }, (_, i) => item(i + 1));
const ok: JobPaymentsLoad = { status: "unavailable" };
const deps = (over: Partial<Parameters<typeof loadTechnicianPayments>[1]> = {}) => ({
  listJobs: vi.fn(async (page: number) => ({ items: all.slice((page - 1) * TECHNICIAN_PAYMENTS_PAGE_SIZE, page * TECHNICIAN_PAYMENTS_PAGE_SIZE), total: TOTAL })),
  loadPayments: vi.fn(async () => ok), ...over,
});

describe("technician payments page", () => {
  it("validates and clamps the page number", () => {
    expect(parsePaymentsPage(undefined)).toBe(1); expect(parsePaymentsPage("abc")).toBe(1); expect(parsePaymentsPage("-3")).toBe(1); expect(parsePaymentsPage("0")).toBe(1);
    expect(parsePaymentsPage("2")).toBe(2); expect(parsePaymentsPage("999999")).toBe(10000);
  });
  it("reaches payments beyond the first page, with bounded reads and navigation flags", async () => {
    const d = deps(), second = await loadTechnicianPayments("2", d);
    expect(d.listJobs).toHaveBeenCalledWith(2);
    expect(second).toMatchObject({ status: "ok", page: 2, total: TOTAL, hasPrevious: true, hasNext: true });
    if (second.status !== "ok") throw new Error("unreachable");
    expect(second.rows.map((r) => r.item.job.id)).toEqual(all.slice(20, 40).map((i) => i.job.id)); expect(d.loadPayments).toHaveBeenCalledTimes(20);
    const third = await loadTechnicianPayments("3", d);
    expect(third).toMatchObject({ status: "ok", hasPrevious: true, hasNext: false }); if (third.status === "ok") expect(third.rows).toHaveLength(5);
    expect(await loadTechnicianPayments(undefined, d)).toMatchObject({ page: 1, hasPrevious: false, hasNext: true });
  });
  it("an empty list is `ok` with no rows", async () => {
    const r = await loadTechnicianPayments("1", deps({ listJobs: async () => ({ items: [], total: 0 }) }));
    expect(r).toMatchObject({ status: "ok", total: 0, hasNext: false, rows: [] });
  });
  it("a listing failure is `unavailable`, never an empty list, and keeps the page for the retry link", async () => {
    for (const error of [new Error("503"), Object.assign(new Error("denied"), { code: "42501" })]) {
      const loadPayments = vi.fn(async () => ok);
      expect(await loadTechnicianPayments("2", deps({ listJobs: async () => { throw error; }, loadPayments }))).toEqual({ status: "unavailable", page: 2 });
      expect(loadPayments).not.toHaveBeenCalled();
    }
  });
});
