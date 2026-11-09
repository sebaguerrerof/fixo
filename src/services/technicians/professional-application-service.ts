import "server-only";
import { z } from "zod";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { requireServerRole } from "@/services/auth/server-authentication-service";
import { professionalApplicationSchema, requirementSchema } from "@/domain/technicians/application";
export async function loadProfessionalApplication(target?:string){
 await requireServerRole(target?["moderator","superadmin"]:["technician"]);
 if(target)z.uuid().parse(target);
 const client=await getSupabaseServerClient();const result=await client.rpc("professional_application",{target:target??null});
 if(result.error)throw new Error("No pudimos cargar la postulación.");
 return result.data?professionalApplicationSchema.parse(result.data):null;
}
export async function loadProfessionalRequirements(category:string){
 const client=await getSupabaseServerClient();const result=await client.rpc("professional_requirements",{category});
 if(result.error)throw new Error("No pudimos cargar los requisitos.");return z.array(requirementSchema).parse(result.data);
}
export async function loadProfessionalCategories(){
 const client=await getSupabaseServerClient();const result=await client.from("categories").select("id,name").order("name");
 if(result.error)throw new Error("No pudimos cargar los rubros.");return z.array(z.object({id:z.string(),name:z.string()})).parse(result.data);
}
