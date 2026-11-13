export function assertAllowedPayer(email: unknown, configured: unknown): string;
export interface CreateOutcome { state: "created" | "refused" | "ambiguous"; http: number | null; flowOrder?: string; code?: number; message?: string; reason?: string }
export function classifyCreate(input?: { http?: number | null; bodyText?: string; networkError?: unknown }): CreateOutcome;
export interface Reconciliation { flowState: "pending" | "paid" | "rejected" | "cancelled" | "unknown"; open: boolean; problem?: string; flowOrder?: string; flowStatusCode?: number; amount?: unknown; currency?: unknown }
export function classifyReconciliation(entry: { commerceOrder: string; flowOrder?: string | null }, answer?: { http?: number | null; json?: unknown; networkError?: unknown }): Reconciliation;
export function openExternalIssues(manifest: { externalOrders?: Array<{ commerceOrder: string; flowOrder?: string | null; state: string; reconciliation?: { open: boolean; problem?: string; flowState?: string } }> } | null): Array<{ commerceOrder: string; flowOrder: string | null; state: string; reconciliation: string }>;
export function buildRetireCriterionSql(input: { criterion: string; run: string; technician: string; before: { n: number; d: string } }): string;
export function flowCost(amount: unknown, paymentData: unknown): number | null;
export function strictInt(v: unknown): number | null;
export function closureState(manifest: { retainedAt?: string; externalOrders?: unknown[] } | null): "open" | "retained-closure-pending" | "closed-retained";
export function applyClosure(manifest: { state?: string; closedAt?: string; closureHistory?: unknown[]; retainedAt?: string; externalOrders?: unknown[] }, at: string, options?: { closing?: boolean }): "open" | "retained-closure-pending" | "closed-retained";
