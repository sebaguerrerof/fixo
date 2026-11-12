/** Cálculo de comisión Fixo en CLP entero y puntos base (plan Sprint 05 §3). Sin punto flotante. */
export const MAX_AMOUNT_CLP = 1_000_000_000;
export const MAX_FEE_BASIS_POINTS = 10_000;

export interface PaymentTerms {
  /** Q: importe del profesional. */
  readonly professionalAmountClp: number;
  /** F: comisión Fixo. */
  readonly platformFeeClp: number;
  /** T = Q + F: total cobrado al cliente. */
  readonly customerTotalClp: number;
  readonly feeBasisPoints: number;
}

export interface PlatformMargin {
  readonly status: "pending_reconciliation" | "confirmed";
  /** F - G; puede ser negativo. Null mientras G no esté confirmado (nunca se asume 0). */
  readonly marginClp: number | null;
}

function assertAmount(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_AMOUNT_CLP) throw new RangeError("Importe CLP inválido");
}

export function calculatePaymentTerms(professionalAmountClp: number, feeBasisPoints: number): PaymentTerms {
  assertAmount(professionalAmountClp);
  if (!Number.isSafeInteger(feeBasisPoints) || feeBasisPoints < 0 || feeBasisPoints > MAX_FEE_BASIS_POINTS) throw new RangeError("Porcentaje inválido");
  // Redondeo al peso más cercano, mitades hacia arriba, con aritmética entera.
  const platformFeeClp = Math.floor((professionalAmountClp * feeBasisPoints + 5_000) / 10_000);
  return Object.freeze({ professionalAmountClp, platformFeeClp, customerTotalClp: professionalAmountClp + platformFeeClp, feeBasisPoints });
}

/** G a cargo de Fixo: no reduce Q ni se suma al cliente. */
export function calculatePlatformMargin(platformFeeClp: number, flowCostClp: number | null): PlatformMargin {
  if (!Number.isSafeInteger(platformFeeClp) || platformFeeClp < 0 || platformFeeClp > MAX_AMOUNT_CLP) throw new RangeError("Comisión inválida");
  if (flowCostClp === null) return { status: "pending_reconciliation", marginClp: null };
  if (!Number.isSafeInteger(flowCostClp) || flowCostClp < 0) throw new RangeError("Coste Flow inválido");
  return { status: "confirmed", marginClp: platformFeeClp - flowCostClp };
}
