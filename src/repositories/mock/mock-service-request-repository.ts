import type { ServiceRequest } from "@/domain/entities/service-request";
import type { ServiceRequestStatus } from "@/domain/enums/service-request-status";
import { canTransitionServiceRequest } from "@/domain/enums/service-request-status";
import type { CreateServiceRequestInput, ServiceRequestRepository } from "@/repositories/contracts/service-request-repository";
import { DEMO_SERVICE_REQUESTS } from "@/repositories/mock/fixtures/service-requests";

// Estado en memoria del proceso: persiste durante la sesión del servidor/demo,
// no sobrevive a un reinicio del proceso (suficiente para recorrer la demo).
const requests: ServiceRequest[] = [...DEMO_SERVICE_REQUESTS];
let sequence = requests.length;

export class MockServiceRequestRepository implements ServiceRequestRepository {
  async listForCustomer(customerId: string): Promise<readonly ServiceRequest[]> {
    return requests
      .filter((request) => request.customerId === customerId)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }

  async findById(id: string): Promise<ServiceRequest | null> {
    return requests.find((request) => request.id === id) ?? null;
  }

  async create(input: CreateServiceRequestInput): Promise<ServiceRequest> {
    sequence += 1;
    const request: ServiceRequest = {
      id: `req-demo-${sequence}`,
      customerId: input.customerId,
      title: input.title,
      categoryId: input.categoryId,
      description: input.description,
      priority: input.priority,
      status: "submitted",
      locationLabel: input.locationLabel,
      createdAt: new Date().toISOString(),
      scheduledFor: input.scheduledFor,
    };
    requests.unshift(request);
    return request;
  }

  async updateStatus(id: string, next: ServiceRequestStatus): Promise<ServiceRequest> {
    const index = requests.findIndex((request) => request.id === id);
    if (index === -1) throw new Error("No encontramos la solicitud.");
    const current = requests[index];
    if (!canTransitionServiceRequest(current.status, next)) {
      throw new Error(`No se puede pasar la solicitud de "${current.status}" a "${next}".`);
    }
    const updated: ServiceRequest = { ...current, status: next };
    requests[index] = updated;
    return updated;
  }

  async listOpenForCategory(categoryId: string): Promise<readonly ServiceRequest[]> {
    return requests
      .filter((request) => request.categoryId === categoryId && ["matching", "receiving_quotes"].includes(request.status))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }
}
