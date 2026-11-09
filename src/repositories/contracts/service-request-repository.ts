import type { ServiceRequest } from "@/domain/entities/service-request";
import type { ServiceRequestStatus } from "@/domain/enums/service-request-status";

export interface CreateServiceRequestInput {
  readonly operationId?: string;
  readonly address?: string;
  readonly reference?: string;
  readonly preferredSlot?: string;
  readonly complementaryInfo?: string;
  readonly customerId: string;
  readonly title: string;
  readonly categoryId: string;
  readonly description: string;
  readonly locationLabel: string;
  readonly priority: "standard" | "urgent";
  readonly scheduledFor: string | null;
}

export interface ServiceRequestRepository {
  listPageForCustomer?(page: number): Promise<{ items: readonly ServiceRequest[]; total: number }>;
  cancel?(id: string, revision: number): Promise<ServiceRequest>;
  listForCustomer(customerId: string): Promise<readonly ServiceRequest[]>;
  findById(id: string): Promise<ServiceRequest | null>;
  create(input: CreateServiceRequestInput): Promise<ServiceRequest>;
  updateStatus(id: string, next: ServiceRequestStatus): Promise<ServiceRequest>;
  /** Solicitudes abiertas a nuevas cotizaciones para un rubro determinado. */
  listOpenForCategory(categoryId: string): Promise<readonly ServiceRequest[]>;
}
