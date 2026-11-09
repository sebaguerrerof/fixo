import type { ServiceRequestStatus } from "@/domain/enums/service-request-status";

export type ServicePriority = "standard" | "urgent";

export interface ServiceRequest {
  readonly revision?: number;
  readonly quoteCount?: number;
  readonly details?: { readonly address?: string; readonly reference?: string; readonly preferred_slot?: string; readonly complementary_info?: string };
  readonly history?: readonly { readonly id: string; readonly action: string; readonly next_state: string; readonly created_at: string }[];
  readonly id: string;
  readonly customerId: string;
  readonly title: string;
  readonly categoryId: string;
  readonly description: string;
  readonly priority: ServicePriority;
  readonly status: ServiceRequestStatus;
  readonly locationLabel: string;
  readonly createdAt: string;
  readonly scheduledFor: string | null;
}
