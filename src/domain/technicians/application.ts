import { z } from "zod";
const entry = z.string().trim().min(2).max(100);
export const professionalDraftSchema = z.object({
  city: z.string().trim().min(2).max(80), headline: z.string().trim().max(180), bio: z.string().trim().max(2000),
  coverage: z.array(entry).max(20), categories: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(8),
  primaryCategory: z.string().regex(/^[a-z0-9-]+$/), specialties: z.array(entry).max(20),
  years: z.coerce.number().int().min(0).max(80), price: z.coerce.number().int().min(0).max(10000000),
  availability: z.string().trim().max(500), portfolio: z.array(z.url().max(500).refine(value => { const u=new URL(value); return u.protocol==="https:"&&!u.username&&!u.password; },"Usa enlaces HTTPS sin credenciales.")).max(10),
}).strict().refine(value=>value.categories.includes(value.primaryCategory),{path:["primaryCategory"],message:"El rubro principal debe estar seleccionado."});
export type ProfessionalDraft = z.infer<typeof professionalDraftSchema>;
export const requirementSchema = z.object({id:z.uuid(),category_id:z.string(),requirement_key:z.string(),version:z.number(),kind:z.enum(["legal","internal","optional"]),required:z.boolean(),document_type:z.string(),description:z.string(),source_url:z.string().nullable()});
export type ProfessionalRequirement = z.infer<typeof requirementSchema>;
export const professionalDocumentSchema=z.object({id:z.uuid(),requirement_id:z.uuid().nullable(),document_type:z.string(),status:z.string(),inspection_status:z.string(),inspection_engine:z.string().nullable(),current_document:z.boolean(),review_reason:z.string().nullable(),created_at:z.string()});
export const professionalApplicationSchema=z.object({
 technician_id:z.uuid(),revision:z.number().int(),state:z.string(),primary_category:z.string().nullable(),availability:z.string(),portfolio:z.array(z.string()),review_reason:z.string().nullable(),published:z.boolean(),name:z.string(),
 profile:z.object({city:z.string(),headline:z.string(),bio:z.string(),coverage_areas:z.array(z.string()),years_of_experience:z.number(),starting_price_clp:z.number(),status:z.string()}),
 categories:z.array(z.string()),specialties:z.array(z.string()),documents:z.array(professionalDocumentSchema),
 history:z.array(z.object({id:z.uuid(),actor_id:z.uuid().nullable(),action:z.string(),previous_state:z.string().nullable(),next_state:z.string().nullable(),reason:z.string(),created_at:z.string()})),
});
export type ProfessionalApplication = z.infer<typeof professionalApplicationSchema>;
export const requirementInputSchema=z.object({category:z.string().regex(/^[a-z0-9-]+$/),key:z.string().regex(/^[a-z0-9-]{2,60}$/),requirement_kind:z.enum(["legal","internal","optional"]),is_required:z.boolean(),document_kind:z.enum(["identity","certificate","license","other"]),description:z.string().trim().min(3).max(1000),source_url:z.url().refine(v=>v.startsWith("https://")).nullable(),reason:z.string().trim().min(3).max(1000)})
 .refine(v=>v.requirement_kind!=="legal"||v.source_url!==null,{message:"Un requisito legal exige una fuente oficial confirmada."})
 .refine(v=>v.requirement_kind!=="optional"||!v.is_required,{message:"La información opcional no puede ser obligatoria."});
