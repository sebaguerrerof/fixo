export type QuoteStatus = "draft" | "submitted" | "accepted" | "rejected" | "withdrawn" | "expired";

export interface Quote {
  readonly id: string;
  readonly serviceRequestId: string;
  readonly technicianId: string;
  readonly amountClp: number;
  readonly status: QuoteStatus;
  readonly description: string;
  readonly estimatedDuration: string;
  readonly availableOn: string;
}
