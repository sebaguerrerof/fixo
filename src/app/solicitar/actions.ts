"use server";

import { isDemoModeEnabled } from "@/config/demo-mode";

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
  if (user.role !== "customer") return { ok: false, message: "Esta acción requiere una cuenta de cliente." };

  const parsed = serviceRequestInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos validar tu solicitud. Revisa los datos ingresados." };
  if (!isDemoModeEnabled() && (!parsed.data.operationId || parsed.data.priority !== "standard")) return { ok: false, message: "Actualiza el formulario antes de registrar una solicitud normal." };

  try {
    const request = await getServiceRequestRepository().create({
      customerId: user.id,
      operationId: parsed.data.operationId,
      address: parsed.data.address,
      reference: parsed.data.reference,
      preferredSlot: parsed.data.preferredSlot,
      complementaryInfo: parsed.data.complementaryInfo,
      title: parsed.data.title,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      locationLabel: parsed.data.locationLabel,
      priority: parsed.data.priority,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor).toISOString() : null,
    });
    // En este modo demo no existe un proceso de matching con demora real: la solicitud
    // queda disponible para cotizar de inmediato en lugar de quedar atascada en "submitted".
    if (isDemoModeEnabled()) {
      const repository = getServiceRequestRepository();
      await repository.updateStatus(request.id, "matching");
      await repository.updateStatus(request.id, "receiving_quotes");
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "No pudimos confirmar el registro. Revisa tus solicitudes antes de volver a intentarlo." };
  }
}
