"use server";
import { revalidatePath } from "next/cache";
import { requireServerRole } from "@/services/auth/server-authentication-service";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { profileUpdateSchema } from "@/domain/auth/account";
export async function updateProfileAction(raw:unknown):Promise<{ok:boolean;message:string}> {
  try {
    await requireServerRole(["customer","technician","moderator","superadmin"]);
    const input=profileUpdateSchema.parse(raw);const client=await getSupabaseServerClient();
    const professional=input.professional?{city:input.professional.city,headline:input.professional.headline,bio:input.professional.bio,coverage_areas:input.professional.coverageAreas.split(",").map(v=>v.trim()).filter(Boolean),category_ids:input.professional.categoryIds}:null;
    const {error}=await client.rpc("update_my_profile",{first_name:input.firstName,last_name:input.lastName,phone_number:input.phone,professional});
    if(error)throw error;revalidatePath("/perfil");revalidatePath("/tecnico/perfil");return {ok:true,message:"Perfil guardado."};
  }catch{return {ok:false,message:"No pudimos guardar el perfil. Revisa los datos y si tu postulación permite edición."};}
}
