/** Read model of `public.payment_admin_overview` (administrators only). Nothing here can mark a payment as paid. */
export interface FeePolicyVersion { readonly version: number; readonly feeBasisPoints: number; readonly reason: string; readonly createdAt: string; readonly authorName: string | null }
export interface PendingAttemptView {
  readonly attemptId: string; readonly orderId: string; readonly jobId: string; readonly state: string;
  /** Paid attempt whose Flow cost is still unknown ("pendiente de conciliación"). */
  readonly costPending: boolean; readonly exhausted: boolean;
  readonly lastCheckedAt: string | null; readonly nextCheckAt: string | null; readonly checkCount: number;
  /** Sanitized technical code authored by Fixo; never a provider payload. */
  readonly errorCode: string | null;
}
export interface PaymentReviewView { readonly orderId: string; readonly jobId: string; readonly reason: string; readonly status: string; readonly updatedAt: string }
export interface SandboxAccountView { readonly userId: string; readonly name: string; readonly reason: string; readonly authorizedAt: string; readonly revokedAt: string | null; readonly active: boolean }
export interface PaymentAdminOverview {
  readonly policy: FeePolicyVersion | null; readonly history: readonly FeePolicyVersion[];
  readonly pending: readonly PendingAttemptView[]; readonly reviews: readonly PaymentReviewView[]; readonly quarantinedInbox: number;
  /** Synthetic accounts authorized to use Sandbox payments (read-only list; authorization is a superadmin RPC). */
  readonly sandboxAccounts: readonly SandboxAccountView[];
}
