import type { AiAssessment } from "@/integrations/ai/ai-provider";
import type { EmergencyStatus } from "@/domain/enums/emergency-status";

export interface EmergencyRequest {
  readonly id: string;
  readonly customerId: string;
  readonly categoryId: string | null;
  readonly description: string;
  readonly locationLabel: string;
  readonly status: EmergencyStatus;
  readonly assignedTechnicianId: string | null;
  readonly candidateTechnicianIds: readonly string[];
  readonly aiAssessment: AiAssessment | null;
  readonly jobId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EmergencyStatusEvent {
  readonly emergencyId: string;
  readonly fromStatus: EmergencyStatus | null;
  readonly toStatus: EmergencyStatus;
  readonly actorId: string;
  readonly actorRole: "customer" | "technician" | "moderator" | "superadmin" | "system";
  readonly timestamp: string;
  readonly metadata?: Record<string, unknown>;
}
