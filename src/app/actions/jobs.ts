"use server";
import { revalidatePath } from "next/cache";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { JobOperationsService } from "@/services/jobs/job-operations-service";
import { jobCommandSchema } from "@/domain/validation/job-command";
export async function performJobCommand(input: unknown): Promise<{ ok: boolean; message: string }> {
  const user = await getServerAuthenticatedUser(); if (!user) return { ok: false, message: "Inicia sesión antes de continuar." };
  const parsed = jobCommandSchema.safeParse(input); if (!parsed.success) return { ok: false, message: "Revisa los campos y el motivo de la operación." };
  try { await new JobOperationsService().command(parsed.data);
    for (const root of ["/cliente/trabajos", "/tecnico/trabajos", "/admin/trabajos"]) { revalidatePath(root); revalidatePath(root + "/" + parsed.data.jobId); }
    revalidatePath("/cliente"); return { ok: true, message: "Operación registrada. El historial conserva la confirmación." };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "No pudimos confirmar. Revisa el historial antes de repetirla." }; }
}
