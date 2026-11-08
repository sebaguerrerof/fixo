"use server";

import { revalidatePath } from "next/cache";

import type { JobStatus } from "@/domain/enums/job-status";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { TechnicianJobsService } from "@/services/technicians/technician-jobs-service";

export interface AdvanceJobResult {
  readonly ok: boolean;
  readonly message?: string;
}

export async function advanceJobStatus(jobId: string, next: JobStatus): Promise<AdvanceJobResult> {
  const user = await getServerAuthenticatedUser();
  if (!user || user.role !== "technician") return { ok: false, message: "unauthenticated" };

  try {
    await new TechnicianJobsService().advance(user.id, jobId, next);
    revalidatePath("/tecnico/trabajos");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No pudimos actualizar el trabajo." };
  }
}
