import { z } from "zod";
import { resolveSantiagoInstant } from "@/domain/jobs/santiago-time";
const reason = z.string().trim().min(10).max(1000), message = z.string().trim().min(10).max(3000), id = z.string().uuid();
const schedule = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/), startChoice: z.enum(["first", "second", ""]).optional(), endChoice: z.enum(["first", "second", ""]).optional(), reason: z.string().trim().max(1000).default("") }).strict();
export const jobActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("propose_schedule"), payload: schedule }).strict(),
  z.object({ action: z.literal("accept_schedule"), payload: z.object({ proposalId: id }).strict() }).strict(),
  z.object({ action: z.literal("reject_schedule"), payload: z.object({ proposalId: id, reason }).strict() }).strict(),
  z.object({ action: z.enum(["prepare", "start", "confirm_completion"]), payload: z.object({}).strict() }).strict(),
  z.object({ action: z.enum(["progress", "report_completion"]), payload: z.object({ message: message.max(1000) }).strict() }).strict(),
  z.object({ action: z.literal("request_cancellation"), payload: z.object({ reason }).strict() }).strict(),
  z.object({ action: z.literal("resolve_cancellation"), payload: z.object({ cancellationId: id, decision: z.enum(["approved", "rejected"]), reason }).strict() }).strict(),
  z.object({ action: z.literal("open_incident"), payload: z.object({ kind: z.enum(["quality", "attendance", "scope", "conduct", "other"]), description: message.min(20) }).strict() }).strict(),
  z.object({ action: z.enum(["reply_incident", "add_observation", "resolve_incident"]), payload: z.object({ incidentId: id, message }).strict() }).strict(),
  z.object({ action: z.literal("request_information"), payload: z.object({ incidentId: id, party: z.enum(["customer", "technician"]), message }).strict() }).strict(),
]);
export const jobCommandSchema = z.object({ jobId: id, operationId: id, expectedRevision: z.number().int().positive(), command: jobActionSchema }).strict();
export type JobCommandInput = z.infer<typeof jobCommandSchema>;
export function jobRpcPayload(command: JobCommandInput["command"]): Record<string, unknown> {
  if (command.action !== "propose_schedule") return command.payload;
  const p = command.payload, startsAt = resolveSantiagoInstant(p.date, p.startTime, p.startChoice || undefined), endsAt = resolveSantiagoInstant(p.date, p.endTime, p.endChoice || undefined);
  if (Date.parse(startsAt) <= Date.now() || Date.parse(endsAt) <= Date.parse(startsAt) || Date.parse(endsAt) - Date.parse(startsAt) > 12 * 3600000) throw new Error("Elige una franja futura de hasta doce horas.");
  return { startsAt, endsAt, localDate: p.date, startTime: p.startTime, endTime: p.endTime, reason: p.reason };
}
