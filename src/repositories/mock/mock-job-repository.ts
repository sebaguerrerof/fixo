import type { Job } from "@/domain/entities/job";
import { canTransitionJob, type JobStatus } from "@/domain/enums/job-status";
import type { CreateJobInput, JobRepository } from "@/repositories/contracts/job-repository";
import { DEMO_JOBS } from "@/repositories/mock/fixtures/jobs";

const jobs: Job[] = [...DEMO_JOBS];
let sequence = jobs.length;

export class MockJobRepository implements JobRepository {
  async getById(id: string): Promise<Job | null> {
    return jobs.find((job) => job.id === id) ?? null;
  }

  async listForCustomer(customerId: string): Promise<readonly Job[]> {
    return jobs
      .filter((job) => job.customerId === customerId)
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }

  async listForTechnician(technicianId: string): Promise<readonly Job[]> {
    return jobs
      .filter((job) => job.technicianId === technicianId)
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }

  async findByEmergencyId(emergencyId: string): Promise<Job | null> {
    return jobs.find((job) => job.emergencyId === emergencyId) ?? null;
  }

  async create(input: CreateJobInput): Promise<Job> {
    sequence += 1;
    const now = new Date().toISOString();
    const job: Job = {
      id: `job-demo-${sequence}`,
      serviceRequestId: input.serviceRequestId,
      quoteId: input.quoteId,
      emergencyId: input.emergencyId,
      customerId: input.customerId,
      technicianId: input.technicianId,
      status: input.status,
      snapshot: input.snapshot,
      createdAt: now,
      updatedAt: now,
    };
    jobs.unshift(job);
    return job;
  }

  async updateStatus(id: string, next: JobStatus): Promise<Job> {
    const index = jobs.findIndex((job) => job.id === id);
    if (index === -1) throw new Error("No encontramos el trabajo.");
    const current = jobs[index];
    if (!canTransitionJob(current.status, next)) {
      throw new Error(`No se puede pasar el trabajo de "${current.status}" a "${next}".`);
    }
    const updated: Job = { ...current, status: next, updatedAt: new Date().toISOString() };
    jobs[index] = updated;
    return updated;
  }
}
