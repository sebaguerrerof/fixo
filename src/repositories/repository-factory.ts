import { usesSampleData } from "@/config/runtime";
import type { ServiceRequestRepository } from "@/repositories/contracts/service-request-repository";
import type { TechnicianRepository } from "@/repositories/contracts/technician-repository";
import { MockServiceRequestRepository } from "@/repositories/mock/mock-service-request-repository";
import { MockTechnicianRepository } from "@/repositories/mock/mock-technician-repository";

function missingAdapter(name: string): never {
  throw new Error(`${name} requires a Supabase adapter while local example data is disabled.`);
}

export function getTechnicianRepository(): TechnicianRepository {
  return usesSampleData() ? new MockTechnicianRepository() : missingAdapter("TechnicianRepository");
}

export function getServiceRequestRepository(): ServiceRequestRepository {
  return usesSampleData() ? new MockServiceRequestRepository() : missingAdapter("ServiceRequestRepository");
}
