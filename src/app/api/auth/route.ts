import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerRegistrationInputSchema, technicianRegistrationInputSchema, signInInputSchema } from "@/integrations/auth/auth-provider";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { allowAuthAttempt } from "@/services/auth/auth-flow-service";
import { getAuthOrigin } from "@/config/auth-origin";
import { accountAccessSchema } from "@/domain/auth/account";

export const runtime = "nodejs";
const neutral = "Si el correo corresponde a una cuenta habilitada, recibirás instrucciones para continuar.";
function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } }); }
async function readBody(request:NextRequest) {
  const reader=request.body?.getReader();if(!reader)throw new SyntaxError("Missing body");
  const chunks:Uint8Array[]=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw new RangeError("Body too large");}chunks.push(value);}
  return z.object({action:z.enum(["logout","recover","login","register-customer","register-technician"]),input:z.unknown()}).parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}
export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== getAuthOrigin()) return json({ message: "Solicitud no autorizada." }, 403);
    if (Number(request.headers.get("content-length") ?? 0) > 16384) return json({ message: "Solicitud inválida." }, 400);
    const body = await readBody(request);
    const client = await getSupabaseServerClient();
    if (body.action === "logout") {
      const { error } = await client.auth.signOut({ scope: "global" });
      return error ? json({ message: "No pudimos cerrar la sesión." }, 503) : json({ ok: true });
    }
    if (body.action === "recover") {
      const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).safeParse(body.input);
      if (parsed.success && await allowAuthAttempt("recover", parsed.data.email, 3)) {
        await client.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: getAuthOrigin()+"/auth/callback" });
      }
      return json({ message: neutral });
    }
    if (body.action === "login") {
      const input = signInInputSchema.parse(body.input);
      if (!await allowAuthAttempt("login", input.email, 10)) return json({ message: "Espera unos minutos antes de volver a intentar." }, 429);
      const { data, error } = await client.auth.signInWithPassword(input);
      if (error || !data.user) return json({ message: "Revisa tu correo y contraseña o confirma tu correo." }, 400);
      const { data: raw } = await client.rpc("my_account_access");
      const access = accountAccessSchema.safeParse(raw);
      if (!access.success) { await client.auth.signOut({ scope: "local" }); return json({ message: "Tu acceso no está disponible. Inténtalo más tarde." }, 503); }
      if (!access.data.allowed) return json({ session: null, redirect: "/cuenta-no-disponible", message: "Esta cuenta no tiene acceso habilitado." }, 403);
      return json({ session: { user: { id: data.user.id, name: access.data.name, email: data.user.email, role: access.data.role }, createdAt: new Date().toISOString() } });
    }
    if (body.action === "register-customer" || body.action === "register-technician") {
      const technician = body.action === "register-technician";
      const input = technician ? technicianRegistrationInputSchema.parse(body.input) : customerRegistrationInputSchema.parse(body.input);
      if (!await allowAuthAttempt("signup", input.email, 3)) return json({ message: neutral });
      const metadata: Record<string, unknown> = { full_name: input.firstName+" "+input.lastName, first_name: input.firstName, last_name: input.lastName, phone: input.phone, terms_accepted: true, account_type: technician ? "technician" : "customer" };
      if (technician) {
        const professional = technicianRegistrationInputSchema.parse(body.input);
        Object.assign(metadata, { city: professional.city, coverage_areas: professional.coverageAreas.split(",").map(v => v.trim()).filter(Boolean), category_ids: professional.categoryIds, headline: professional.headline, bio: professional.bio, specialties: professional.specialties.split(",").map(v => v.trim()).filter(Boolean), years_of_experience: professional.yearsOfExperience, starting_price_clp: professional.startingPriceClp });
      }
      await client.auth.signUp({ email: input.email, password: input.password, options: { data: metadata, emailRedirectTo: getAuthOrigin()+"/auth/callback" } });
      await client.auth.signOut({ scope: "local" });
      return json({ message: neutral });
    }
    return json({ message: "Solicitud inválida." }, 400);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ message: "Revisa los datos ingresados." }, 400);
    if (error instanceof RangeError) return json({message:"Solicitud demasiado grande."},413);
    return json({ message: "No pudimos completar la solicitud. Inténtalo más tarde." }, 503);
  }
}
