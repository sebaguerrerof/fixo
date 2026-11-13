import { describe, expect, it } from "vitest";
import { quoteInputSchema } from "./quote-input";
import { technicianRegistrationInputSchema } from "@/integrations/auth/auth-provider";

describe("Zod 4 form compatibility",()=>{
  it("coerces valid quote CLP and applies defaults",()=>{
    const result=quoteInputSchema.parse({serviceRequestId:"request",priceClp:"25000",description:"Revisión completa de la instalación eléctrica",estimatedDuration:"2 horas",availableDate:new Date(Date.now()+86400000).toISOString(),expiresAt:new Date(Date.now()+172800000).toISOString()});
    expect(result.priceClp).toBe(25000);
    expect(result.materialsIncluded).toBe("");
    expect(result.diagnosticVisit).toBe(false);
  });
  it.each(["Infinity","NaN",-1,50000001])("rejects invalid quote price %s",price=>{
    expect(quoteInputSchema.safeParse({serviceRequestId:"request",priceClp:price,description:"Revisión completa de la instalación eléctrica",estimatedDuration:"2 horas",availableDate:"date",expiresAt:"date"}).success).toBe(false);
  });
  it("keeps technician numeric coercion and public registration fields",()=>{
    const value=technicianRegistrationInputSchema.parse({firstName:"Prueba",lastName:"Local",phone:"+56912345678",email:"test@example.invalid",password:"Local-test-only-123",confirmPassword:"Local-test-only-123",acceptTerms:true,city:"Ñuñoa",coverageAreas:"Ñuñoa",headline:"Instalaciones eléctricas",bio:"Experiencia declarada para una prueba local aislada.",categoryIds:["electricidad"],specialties:"Iluminación",yearsOfExperience:"4",emergencyEnabled:false,startingPriceClp:"20000",role:"superadmin"});
    expect(value.yearsOfExperience).toBe(4);
    expect(value.startingPriceClp).toBe(20000);
    expect(value).not.toHaveProperty("role");
  });
});
