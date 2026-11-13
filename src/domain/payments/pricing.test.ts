import { describe, expect, it } from "vitest";
import { calculatePaymentTerms, calculatePlatformMargin } from "./pricing";

describe("calculatePaymentTerms", () => {
  it("ejemplo aprobado: Q=100.000, 5% => F=5.000, T=105.000", () => {
    expect(calculatePaymentTerms(100_000, 500)).toEqual({ professionalAmountClp: 100_000, platformFeeClp: 5_000, customerTotalClp: 105_000, feeBasisPoints: 500 });
  });
  it("redondea mitades hacia arriba", () => {
    expect(calculatePaymentTerms(10, 500).platformFeeClp).toBe(1); // 0,5
    expect(calculatePaymentTerms(9, 500).platformFeeClp).toBe(0); // 0,45
    expect(calculatePaymentTerms(1_010, 500).platformFeeClp).toBe(51); // 50,5
  });
  it("0 puntos base no cobra comisión", () => {
    expect(calculatePaymentTerms(50_000, 0).customerTotalClp).toBe(50_000);
  });
  it("rechaza importes y porcentajes fuera de rango", () => {
    for (const q of [0, -1, 1.5, NaN, Infinity, 1_000_000_001]) expect(() => calculatePaymentTerms(q, 500)).toThrow(RangeError);
    for (const bp of [-1, 0.5, 10_001, NaN]) expect(() => calculatePaymentTerms(1_000, bp)).toThrow(RangeError);
  });
});

describe("calculatePlatformMargin", () => {
  it("G ausente queda pendiente, no cero", () => {
    expect(calculatePlatformMargin(5_000, null)).toEqual({ status: "pending_reconciliation", marginClp: null });
  });
  it("G mayor que F da margen negativo sin tocar Q", () => {
    expect(calculatePlatformMargin(5_000, 6_000)).toEqual({ status: "confirmed", marginClp: -1_000 });
  });
  it("comisión cero válida: margen = -G", () => {
    expect(calculatePlatformMargin(0, 500)).toEqual({ status: "confirmed", marginClp: -500 });
    expect(calculatePlatformMargin(0, null).status).toBe("pending_reconciliation");
  });
  it("rechaza comisión inválida, con o sin coste Flow", () => {
    for (const f of [NaN, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1, 1_000_000_001]) {
      expect(() => calculatePlatformMargin(f, 1_000)).toThrow(RangeError);
      expect(() => calculatePlatformMargin(f, null)).toThrow(RangeError);
    }
  });
  it("rechaza coste inválido", () => {
    expect(() => calculatePlatformMargin(5_000, -1)).toThrow(RangeError);
  });
});
