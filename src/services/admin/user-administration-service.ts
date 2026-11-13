import "server-only";
import { z } from "zod";
import { requireServerRole } from "@/services/auth/server-authentication-service";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { getSupabaseAdminClient } from "@/integrations/supabase/admin-client";
import { accountChangeSchema, invitationInputSchema, roleSchema, accountStatusSchema } from "@/domain/auth/account";
import { getAuthOrigin } from "@/config/auth-origin";
import { hasPermission } from "@/domain/auth/permissions";

export const userRecordSchema = z.object({ id:z.string().uuid(),full_name:z.string(),email:z.string(),role:roleSchema,account_status:accountStatusSchema,created_at:z.string(),last_sign_in_at:z.string().nullable() });
export type UserRecord = z.infer<typeof userRecordSchema>;
export interface InvitationRecord { id:string; email:string; full_name:string; role:z.infer<typeof roleSchema>; state:string; delivery:string; expires_at:string; created_at:string }
export async function administratorClient() { await requireServerRole(["moderator","superadmin"]); return getSupabaseServerClient(); }
export async function recordFailure(target:string|null,action:string,reason:string) {
  try{const client=await getSupabaseServerClient();await client.rpc("record_account_action_failure",{target_user:target,attempted_action:action,change_reason:reason.slice(0,500)||"Intento no completado",failure_result:"failed"});}catch{/* Original failure stays visible; no fabricated audit success. */}
}
export async function listUsers(search = "", role: string | null = null, status: string | null = null, page = 1) {
  const client = await administratorClient();
  const { data,error } = await client.rpc("admin_list_users", { search_text:search.slice(0,120),role_filter:roleSchema.safeParse(role).success?role:null,status_filter:accountStatusSchema.safeParse(status).success?status:null,page_number:Math.max(1,Math.min(10000,Math.floor(page)||1)) });
  if(error) throw new Error("No pudimos cargar las cuentas.");
  return z.object({total:z.number(),page:z.number(),pageSize:z.number(),users:z.array(userRecordSchema)}).parse(data);
}
export async function userDetail(id:string) {
  z.uuid().parse(id); const client=await administratorClient();
  const {data,error}=await client.rpc("admin_user_detail",{target_user:id});
  if(error) throw new Error("No pudimos cargar esta cuenta.");
  if(!data) return null;
  return userRecordSchema.extend({phone:z.string().nullable(),technician_status:z.string().nullable(),history:z.array(z.object({id:z.string(),actor_id:z.string().nullable(),action:z.string(),reason:z.string(),previous_value:z.unknown(),next_value:z.unknown(),result:z.string(),created_at:z.string()}))}).parse(data);
}
export async function changeAccount(raw:unknown) {
  const input=accountChangeSchema.parse(raw);
  const actor=await requireServerRole(["moderator","superadmin"]);
  if(input.newRole!==null&&!hasPermission(actor.role,"user:assign_privileged_role"))throw new Error("Operación no autorizada.");
  const client=await getSupabaseServerClient();
  const target=await userDetail(input.targetUser);
  if(!target || (["moderator","superadmin"].includes(target.role)&&actor.role!=="superadmin"))throw new Error("Operación no autorizada.");
  const {error}=await client.rpc("admin_change_account",{target_user:input.targetUser,new_status:input.newStatus,new_role:input.newRole,change_reason:input.reason,operation_id:input.operationId});
  if(error) throw new Error("No se aplicó el cambio. Revisa tus permisos, el motivo y la protección de administradores.");
}
export async function listInvitations():Promise<InvitationRecord[]> {
  const client=await administratorClient(); const {data,error}=await client.rpc("admin_list_invitations");
  if(error) throw new Error("No pudimos cargar las invitaciones."); return data;
}
export async function inviteUser(raw:unknown) {
  const input=invitationInputSchema.parse(raw); const actor=await requireServerRole(["moderator","superadmin"]);
  if(!hasPermission(actor.role,["moderator","superadmin"].includes(input.role)?"user:invite_administrator":input.role==="technician"?"user:invite_technician":"user:invite_customer"))throw new Error("Operación no autorizada.");
  const client=await getSupabaseServerClient();
  if(process.env.FIXO_INVITATIONS_ENABLED!=="true") throw new Error("El envío de invitaciones aún no está habilitado en este entorno.");
  const {data:reservation,error}=await client.rpc("admin_reserve_invitation",{invite_email:input.email,invite_name:input.fullName,invite_role:input.role,operation_id:input.operationId,resend:input.resend});
  if(error || !reservation) throw new Error("No pudimos reservar la invitación. Revisa si existe la cuenta, tus permisos o el límite de envíos.");
  if(!reservation.send) return { message:"La invitación ya está registrada. Revisa su estado antes de reenviar." };
  const admin=getSupabaseAdminClient();
  let userId:string|null=null; let delivery="uncertain";
  try {
    const result=await admin.auth.admin.inviteUserByEmail(reservation.email,{redirectTo:getAuthOrigin()+"/auth/callback",data:{full_name:reservation.fullName}});
    if(result.error && reservation.userId && ["email_exists","user_already_exists"].includes(result.error.code??"")) {
      // The invite OTP may have been consumed before password/profile completion failed.
      // A recovery OTP proves the same email owner; DB still requires the pending invitation.
      const recovery=await admin.auth.resetPasswordForEmail(reservation.email,{redirectTo:getAuthOrigin()+"/auth/callback"});
      userId=reservation.userId;
      delivery=recovery.error?(recovery.error.status&&recovery.error.status<500?"failed":"uncertain"):"sent";
    }
    else if(result.error) delivery=result.error.status&&result.error.status<500?"failed":"uncertain";
    else {userId=result.data.user?.id??null;delivery=userId?"sent":"uncertain";}
  } catch { /* A timeout may have sent a message. Persist uncertainty, never auto-resend. */ }
  const finalized=await admin.rpc("finish_invitation_delivery",{invitation_id:reservation.id,delivery_generation:reservation.generation,invited_user:userId,delivery_result:delivery});
  if(finalized.error) throw new Error("El resultado del envío no pudo confirmarse. Revisa la invitación antes de reenviar.");
  return {message:delivery==="sent"?"Supabase aceptó el envío de la invitación. Esto no confirma su entrega.":"El envío no está confirmado. Revisa el estado antes de reenviar."};
}
