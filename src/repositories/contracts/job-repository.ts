import type { AcceptedQuoteSnapshot } from "@/domain/entities/quote";
import type { Job } from "@/domain/entities/job";
import type { JobStatus } from "@/domain/enums/job-status";
import type { JobDetail, JobPage, JobCommandReceipt } from "@/domain/entities/job-operations";
import type { JobCommandInput } from "@/domain/validation/job-command";

export interface CreateJobInput {
  readonly serviceRequestId: string;
  readonly quoteId: string | null;
  readonly emergencyId: string | null;
  readonly customerId: string;
  readonly technicianId: string;
  readonly status: JobStatus;
  readonly snapshot: AcceptedQuoteSnapshot | null;
}

export interface JobRepository {
  listPage?(page: number, state?: string): Promise<JobPage>;
  getDetail?(id: string): Promise<JobDetail | null>;
  command?(input: JobCommandInput): Promise<JobCommandReceipt>;
  findByServiceRequest?(requestId: string): Promise<Job | null>;
  getById(id: string): Promise<Job | null>;
  listForCustomer(customerId: string): Promise<readonly Job[]>;
  listForTechnician(technicianId: string): Promise<readonly Job[]>;
  findByEmergencyId(emergencyId: string): Promise<Job | null>;
  create(input: CreateJobInput): Promise<Job>;
  updateStatus(id: string, next: JobStatus): Promise<Job>;
}
