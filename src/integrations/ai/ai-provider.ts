import { z } from "zod";

export const aiAssessmentSchema = z.object({
  suggestedCategoryId: z.string().nullable(),
  suggestedSpecialtyId: z.string().nullable(),
  urgencyLevel: z.enum(["standard", "urgent"]),
  summary: z.string().min(1),
  questions: z.array(z.string()),
  safetyFlags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type AiAssessment = z.infer<typeof aiAssessmentSchema>;

export interface AiAssessmentInput {
  readonly description: string;
  readonly locationLabel?: string;
}

export interface AiProvider {
  assessIssue(input: AiAssessmentInput): Promise<AiAssessment>;
}
