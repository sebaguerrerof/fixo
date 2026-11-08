import type { Job } from "@/domain/entities/job";
import type { JobStatus } from "@/domain/enums/job-status";
import { getEmergencyRepository, getJobRepository, getServiceRequestRepository } from "@/repositories/repository-factory";
import { EmergencyService } from "@/services/emergencies/emergency-service";

export interface TechnicianJobView {
  readonly job: Job;
  readonly title: string;
  readonly locationLabel: string;
}

const CLOSED_STATUSES: readonly JobStatus[] = ["completed", "cancelled", "disputed"];

/** Vista de trabajos activos de un técnico, ya sea que provengan de una cotización o de una urgencia. */
export class TechnicianJobsService {
  async listActiveJobs(technicianId: string): Promise<readonly TechnicianJobView[]> {
    const jobs = await getJobRepository().listForTechnician(technicianId);
    const active = jobs.filter((job) => !CLOSED_STATUSES.includes(job.status));
    return Promise.all(active.map((job) => this.describe(job)));
  }

  private async describe(job: Job): Promise<TechnicianJobView> {
    if (job.emergencyId) {
      const emergency = await getEmergencyRepository().getById(job.emergencyId);
      return { job, title: `Urgencia — ${emergency?.description ?? "servicio de urgencia"}`, locationLabel: emergency?.locationLabel ?? "" };
    }
    const request = await getServiceRequestRepository().findById(job.serviceRequestId);
    return { job, title: request?.title ?? "Servicio", locationLabel: request?.locationLabel ?? "" };
  }

  /**
   * Avanza el estado de un trabajo. Si proviene de una urgencia, delega en
   * `EmergencyService` para mantener sincronizadas ambas máquinas de estado.
   */
  async advance(technicianId: string, jobId: string, next: JobStatus): Promise<Job> {
    const jobRepository = getJobRepository();
    const job = await jobRepository.getById(jobId);
    if (!job) throw new Error("No encontramos el trabajo.");
    if (job.technicianId !== technicianId) throw new Error("No puedes modificar este trabajo.");

    if (job.emergencyId && (next === "arrived" || next === "in_progress" || next === "completed")) {
      await new EmergencyService().advanceAsTechnician(technicianId, job.emergencyId, next);
      const updated = await jobRepository.getById(jobId);
      if (!updated) throw new Error("No encontramos el trabajo.");
      return updated;
    }

    return jobRepository.updateStatus(jobId, next);
  }
}
