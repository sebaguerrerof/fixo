"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { requireServerRole } from "@/services/auth/server-authentication-service";
import { requirementInputSchema } from "@/domain/technicians/application";
const reasonSchema=z.string().trim().min(3).max(1000);
function refresh(){for(const p of ["/admin/postulaciones","/admin/requisitos","/tecnico/postulacion","/tecnicos"])revalidatePath(p,"layout");}
export async function decideProfessionalApplication(raw:unknown){
 try{await requireServerRole(["moderator","superadmin"]);const args=z.object({target:z.uuid(),decision:z.enum(["approved","rejected","needs_information","suspended"]),expected_revision:z.number().int().positive(),reason:reasonSchema,operation_id:z.uuid()}).strict().parse(raw);
 const client=await getSupabaseServerClient();const r=await client.rpc("admin_decide_professional_application",args);if(r.error)throw r.error;refresh();return{ok:true,message:"Decisión registrada con historial."};}
 catch{return{ok:false,message:"No se aplicó la decisión. Revisa la versión, el motivo, los documentos y el estado actual de la postulación."};}
}
export async function reviewProfessionalDocument(raw:unknown){
 try{await requireServerRole(["moderator","superadmin"]);const args=z.object({document_id:z.uuid(),decision:z.enum(["approved","rejected"]),reason:reasonSchema}).strict().parse(raw);
 const client=await getSupabaseServerClient();const r=await client.rpc("admin_review_professional_document",args);if(r.error)throw r.error;refresh();return{ok:true,message:"Revisión del documento registrada."};}
 catch{return{ok:false,message:"No se confirmó la revisión. Un documento en cuarentena no puede aprobarse."};}
}
export async function versionProfessionalRequirement(raw:unknown){
 try{await requireServerRole(["superadmin"]);const args=requirementInputSchema.parse(raw);const client=await getSupabaseServerClient();const r=await client.rpc("admin_version_requirement",args);if(r.error)throw r.error;refresh();return{ok:true,message:"Nueva versión guardada. Las postulaciones deben cumplir los criterios vigentes antes de publicarse."};}
 catch{return{ok:false,message:"No se guardó el requisito. Revisa los datos, permisos y la fuente del requisito legal."};}
}
