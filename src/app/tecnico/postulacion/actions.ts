"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { requireServerRole } from "@/services/auth/server-authentication-service";
import { professionalDraftSchema } from "@/domain/technicians/application";
import { inspectContent } from "../../../../scripts/lib/inspect-document.mjs";
export type ProfessionalActionResult={ok:boolean;message:string};
function refresh(){for(const path of ["/tecnico/postulacion","/tecnico/perfil","/admin/postulaciones","/tecnicos"])revalidatePath(path);}
export async function saveProfessionalDraft(raw:unknown,revision:number,operationId:string):Promise<ProfessionalActionResult>{
 try{await requireServerRole(["technician"]);const payload=professionalDraftSchema.parse(raw);z.number().int().positive().parse(revision);z.uuid().parse(operationId);
 const client=await getSupabaseServerClient();const result=await client.rpc("save_professional_application",{payload,expected_revision:revision,operation_id:operationId});if(result.error)throw result.error;refresh();return{ok:true,message:"Borrador guardado. Los cambios requieren revisión antes de publicar."};}
 catch{return{ok:false,message:"No pudimos guardar. Revisa los datos y actualiza la página si cambió la versión."};}
}
export async function submitProfessionalApplication(revision:number,consent:boolean,operationId:string):Promise<ProfessionalActionResult>{
 try{await requireServerRole(["technician"]);z.number().int().positive().parse(revision);z.uuid().parse(operationId);if(consent!==true)throw new Error("Consentimiento requerido");
 const client=await getSupabaseServerClient();const result=await client.rpc("submit_professional_application",{expected_revision:revision,consent,operation_id:operationId});if(result.error)throw result.error;refresh();return{ok:true,message:"Postulación enviada a revisión. Puedes consultar aquí su estado."};}
 catch{return{ok:false,message:"No pudimos enviar. Guarda los antecedentes completos, confirma el consentimiento y revisa los requisitos del rubro."};}
}
export async function uploadProfessionalDocument(data:FormData):Promise<ProfessionalActionResult>{
 try{const actor=await requireServerRole(["technician"]);const requirement=z.uuid().parse(data.get("requirement"));const replaces=data.get("replaces")?z.uuid().parse(data.get("replaces")):null;const file=data.get("file");
 if(!(file instanceof File)||file.size<1||file.size>10485760)throw new Error("Tamaño inválido");
 const bytes=Buffer.from(await file.arrayBuffer());const mime=await inspectContent(bytes);
 if(mime!==file.type)throw new Error("Contenido discordante");const extension=mime==="application/pdf"?"pdf":mime==="image/png"?"png":"jpg";const id=randomUUID(),path=actor.id+"/"+id+"."+extension;
 const client=await getSupabaseServerClient();const uploaded=await client.storage.from("technician-documents").upload(path,bytes,{contentType:mime,cacheControl:"0",upsert:false});if(uploaded.error)throw uploaded.error;
 const recorded=await client.rpc("register_professional_document",{document_id:id,requirement,object_path:path,replaces});
 if(recorded.error)throw new Error("Archivo recibido sin confirmar metadatos. Conservado en cuarentena para reconciliación.");
 refresh();return{ok:true,message:"Documento recibido en cuarentena. La inspección automática y revisión administrativa están pendientes."};}
 catch{return{ok:false,message:"No se confirmó la carga. Usa PDF sin contenido activo, PNG o JPEG válido, hasta 10 MiB. Los archivos no confirmados permanecen en cuarentena."};}
}
