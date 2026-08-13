import type { ServiceRequest } from "@/domain/entities/service-request";

export interface ServiceRequestRepository {
  listForCustomer(customerId: string): Promise<readonly ServiceRequest[]>;
  findById(id: string): Promise<ServiceRequest | null>;
}
