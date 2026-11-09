"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { administratorClient, changeAccount, inviteUser, recordFailure } from "@/services/admin/user-administration-service";
export type AdminResult = {message:string;ok:boolean};
export async function changeAccountAction(input:unknown):Promise<AdminResult> {
  try {await changeAccount(input);revalidatePath("/admin/usuarios");return {ok:true,message:"Cambio guardado y auditado."};}
  catch {const raw=input as Record<string,unknown>|null;if(raw&&z.uuid().safeParse(raw.targetUser).success)await recordFailure(String(raw.targetUser),"account_change",typeof raw.reason==="string"?raw.reason:"Cambio no completado");return {ok:false,message:"No se aplicó el cambio. Revisa permisos, motivo y protección del último superadministrador."};}
}
export async function invitationAction(input:unknown):Promise<AdminResult> {
  try {const result=await inviteUser(input);revalidatePath("/admin/usuarios/invitaciones");return {ok:true,message:result.message};}
  catch {await recordFailure(null,"invitation","Invitación no completada desde administración");return {ok:false,message:"No pudimos procesar la invitación. Revisa la configuración de envío, permisos, duplicados y límites."};}
}
export async function revokeInvitationAction(id:string,reason:string):Promise<AdminResult> {
  try {z.uuid().parse(id);z.string().trim().min(3).max(500).parse(reason);const client=await administratorClient();const {error}=await client.rpc("admin_revoke_invitation",{invitation_id:id,change_reason:reason});if(error) throw error;revalidatePath("/admin/usuarios/invitaciones");return {ok:true,message:"Invitación revocada."};}
  catch {await recordFailure(null,"invitation_revoke",reason);return {ok:false,message:"No pudimos revocar la invitación."};}
}
export async function observeUserAction(id:string,reason:string):Promise<AdminResult> {
  try {z.uuid().parse(id);z.string().trim().min(3).max(500).parse(reason);const client=await administratorClient();const {error}=await client.rpc("admin_observe_user",{target_user:id,observation:reason,operation_id:crypto.randomUUID()});if(error)throw error;revalidatePath("/admin/usuarios/"+id);return {ok:true,message:"Observación registrada."};}
  catch {if(z.uuid().safeParse(id).success)await recordFailure(id,"observation",reason);return {ok:false,message:"No pudimos registrar la observación."};}
}
