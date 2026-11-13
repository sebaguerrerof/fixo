import { getJobRepository } from "@/repositories/repository-factory";
import { jobCommandSchema } from "@/domain/validation/job-command";
export class JobOperationsService {
  async list(page = 1, state?: string) { const repository = getJobRepository(); if (!repository.listPage) throw new Error("Esta vista requiere persistencia real."); return repository.listPage(page, state); }
  async detail(id: string) { const repository = getJobRepository(); if (!repository.getDetail) throw new Error("Esta vista requiere persistencia real."); return repository.getDetail(id); }
  async command(input: unknown) { const parsed = jobCommandSchema.parse(input), repository = getJobRepository(); if (!repository.command) throw new Error("Esta operación requiere persistencia real."); return repository.command(parsed); }
}
