import { randomUUID } from "node:crypto";
import { getTechnicianDocumentUrl } from "@/services/technicians/technician-document-service";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={"Cache-Control":"private, no-store, max-age=0","CDN-Cache-Control":"no-store","Vercel-CDN-Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"};
 try{const{id}=await params;await getTechnicianDocumentUrl(id);const client=await getSupabaseServerClient();
 const row=await client.from("technician_documents").select("storage_path,detected_mime,inspection_status,current_document").eq("id",id).single();
 if(row.error||row.data.inspection_status!=="clean"||!row.data.current_document)throw new Error("Unavailable");
 const file=await client.storage.from("technician-documents").download(row.data.storage_path,{cacheNonce:randomUUID()},{cache:"no-store"});if(file.error)throw file.error;
 return new Response(file.data,{headers:{...headers,"Content-Type":row.data.detected_mime??"application/octet-stream","Content-Disposition":`attachment; filename="documento-${id}.${row.data.detected_mime==="application/pdf"?"pdf":row.data.detected_mime==="image/png"?"png":"jpg"}"`}});
 }catch{return new Response("Documento no disponible.",{status:404,headers});}
}
