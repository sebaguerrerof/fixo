import { getServiceRequestRepository } from "@/repositories/repository-factory";

export class CustomerDashboardService {
  async getOverview(customerId: string) {
    const requests = await getServiceRequestRepository().listForCustomer(customerId);
    return {
      requests,
      activeRequests: requests.filter((request) => ["submitted", "matching", "receiving_quotes", "technician_selected", "awaiting_payment", "scheduled", "in_progress"].includes(request.status)),
    };
  }
}
