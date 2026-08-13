import type { ServiceRequestRepository } from "@/repositories/contracts/service-request-repository";
import { sampleServiceRequests } from "@/repositories/mock/fixture-data";

export class MockServiceRequestRepository implements ServiceRequestRepository {
  async listForCustomer(customerId: string) {
    return sampleServiceRequests.filter((request) => request.customerId === customerId);
  }

  async findById(id: string) {
    return sampleServiceRequests.find((request) => request.id === id) ?? null;
  }
}
