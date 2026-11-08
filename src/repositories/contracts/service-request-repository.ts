import type { ServiceRequest } from "@/domain/entities/service-request";
import type { ServiceRequestStatus } from "@/domain/enums/service-request-status";

export interface CreateServiceRequestInput {
  readonly customerId: string;
  readonly title: string;
  readonly categoryId: string;
  readonly description: string;
  readonly locationLabel: string;
  readonly priority: "standard" | "urgent";
  readonly scheduledFor: string | null;
}

export interface ServiceRequestRepository {
  listForCustomer(customerId: string): Promise<readonly ServiceRequest[]>;
  findById(id: string): Promise<ServiceRequest | null>;
  create(input: CreateServiceRequestInput): Promise<ServiceRequest>;
  updateStatus(id: string, next: ServiceRequestStatus): Promise<ServiceRequest>;
  /** Solicitudes abiertas a nuevas cotizaciones para un rubro determinado. */
  listOpenForCategory(categoryId: string): Promise<readonly ServiceRequest[]>;
}
