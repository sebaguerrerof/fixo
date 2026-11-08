import type { ServiceRequestStatus } from "@/domain/enums/service-request-status";

export type ServicePriority = "standard" | "urgent";

export interface ServiceRequest {
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
