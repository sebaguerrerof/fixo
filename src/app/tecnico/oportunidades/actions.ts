"use server";

import { revalidatePath } from "next/cache";

import { getServerAuthenticatedUser } from "@/services/auth/server-authentication-service";
import { EmergencyService } from "@/services/emergencies/emergency-service";

export interface AcceptEmergencyResult {
  readonly ok: boolean;
  readonly message?: string;
}

export async function acceptEmergencyOpportunityAction(emergencyId: string): Promise<AcceptEmergencyResult> {
  const user = await getServerAuthenticatedUser();
  if (!user || user.role !== "technician") return { ok: false, message: "unauthenticated" };

  try {
    await new EmergencyService().acceptAsTechnician(user.id, emergencyId);
    revalidatePath("/tecnico/oportunidades");
    revalidatePath("/tecnico/trabajos");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No pudimos adjudicar esta urgencia." };
  }
}
