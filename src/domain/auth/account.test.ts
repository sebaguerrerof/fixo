import { describe,expect,it } from "vitest";
import { customerRegistrationInputSchema,technicianRegistrationInputSchema } from "@/integrations/auth/auth-provider";
import { accountChangeSchema,profileUpdateSchema,safeContinuation } from "./account";
const customer={firstName:"Prueba",lastName:"Local",email:"test@example.invalid",phone:"+56912345678",password:"Local-password-123",confirmPassword:"Local-password-123",acceptTerms:true};
describe("account boundaries",()=>{
  it("validates customer registration and strips privilege overposting",()=>{
    const data=customerRegistrationInputSchema.parse({...customer,role:"superadmin",account_status:"active",account_type:"superadmin"});
    expect(data).not.toHaveProperty("role");expect(data).not.toHaveProperty("account_status");expect(data).not.toHaveProperty("account_type");
  });
  it.each([{acceptTerms:false},{confirmPassword:"other"},{phone:"bad"},{password:"short",confirmPassword:"short"},{lastName:""}])("rejects invalid identity/consent %j",override=>{expect(customerRegistrationInputSchema.safeParse({...customer,...override}).success).toBe(false);});
  it("allows a minimal technician application without optional professional fields",()=>{
    const result=technicianRegistrationInputSchema.parse({...customer,city:"Ñuñoa",coverageAreas:"Ñuñoa",categoryIds:["electricidad"]});
    expect(result.headline).toBe("");expect(result.startingPriceClp).toBe(0);
  });
  it("strips access fields from own profile updates",()=>{
    const result=profileUpdateSchema.parse({...customer,role:"superadmin",accountStatus:"active",professional:null});
    expect(result).not.toHaveProperty("role");expect(result).not.toHaveProperty("accountStatus");
  });
  it("requires reason and an idempotency key for access changes",()=>{
    expect(accountChangeSchema.safeParse({targetUser:"10000000-0000-4000-8000-000000000001",newStatus:"suspended",newRole:null,reason:"",operationId:"fake"}).success).toBe(false);
  });
  it.each(["//evil.invalid","/\\evil.invalid","https://evil.invalid","/%2f%2fevil.invalid","/admin?next=evil","/admin/%5cevil","/administracion","/cliente#x"])("rejects unsafe continuation %s",path=>expect(safeContinuation(path,"/cliente")).toBe("/cliente"));
  it.each(["/admin","/cliente/solicitudes/abc","/tecnico/perfil","/perfil"])("keeps an allowed internal continuation %s",path=>expect(safeContinuation(path,"/cliente")).toBe(path));
});
