import type { Job } from "@/domain/entities/job";
import type { JobStatus } from "@/domain/enums/job-status";
import type { CreateJobInput, JobRepository } from "@/repositories/contracts/job-repository";

const NOT_IMPLEMENTED = "SupabaseJobRepository no está implementado todavía. Usa NEXT_PUBLIC_DEMO_MODE=true mientras se agrega la persistencia real (próximo milestone).";

export class SupabaseJobRepository implements JobRepository {
  async getById(_id: string): Promise<Job | null> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async listForCustomer(_customerId: string): Promise<readonly Job[]> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async listForTechnician(_technicianId: string): Promise<readonly Job[]> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async findByEmergencyId(_emergencyId: string): Promise<Job | null> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async create(_input: CreateJobInput): Promise<Job> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async updateStatus(_id: string, _next: JobStatus): Promise<Job> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
