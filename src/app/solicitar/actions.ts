"use server";

import { serviceRequestInputSchema, type ServiceRequestInput } from "@/domain/validation/service-request-input";
import { getServiceRequestRepository } from "@/repositories/repository-factory";
import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";

export interface SubmitServiceRequestResult {
  readonly ok: boolean;
  readonly message?: string;
}

export async function submitServiceRequest(input: ServiceRequestInput): Promise<SubmitServiceRequestResult> {
  const user = await getServerAuthenticatedUser();
  if (!user) return { ok: false, message: "unauthenticated" };

  const parsed = serviceRequestInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos validar tu solicitud. Revisa los datos ingresados." };

  try {
    const request = await getServiceRequestRepository().create({
      customerId: user.id,
      title: parsed.data.title,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      locationLabel: parsed.data.locationLabel,
      priority: parsed.data.priority,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor).toISOString() : null,
    });
    // En este modo demo no existe un proceso de matching con demora real: la solicitud
    // queda disponible para cotizar de inmediato en lugar de quedar atascada en "submitted".
    const repository = getServiceRequestRepository();
    await repository.updateStatus(request.id, "matching");
    await repository.updateStatus(request.id, "receiving_quotes");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No pudimos registrar tu solicitud." };
  }
}
