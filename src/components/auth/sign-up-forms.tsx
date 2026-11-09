"use client";
import Link from "next/link";
import { useState } from "react";
import type { Category } from "@/domain/entities/category";
import { customerRegistrationInputSchema, technicianRegistrationInputSchema } from "@/integrations/auth/auth-provider";
import { AuthenticationService } from "@/services/auth/authentication-service";
import { Button } from "@/components/ui/button";

const inputClass = "h-12 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
function RegistrationForm({ technician = false, categories = [] }: { technician?: boolean; categories?: readonly Category[] }) {
  const [errors,setErrors] = useState<Record<string,string>>({});
  const [pending,setPending] = useState(false); const [message,setMessage] = useState("");
  const [sent,setSent] = useState(false);
  const fields = [
    {name:"firstName",label:"Nombre",type:"text",auto:"given-name"},
    {name:"lastName",label:"Apellido",type:"text",auto:"family-name"},
    {name:"email",label:"Correo electrónico",type:"email",auto:"email"},
    {name:"phone",label:"Teléfono",type:"tel",auto:"tel"},
    {name:"password",label:"Contraseña",type:"password",auto:"new-password"},
    {name:"confirmPassword",label:"Repite la contraseña",type:"password",auto:"new-password"},
  ];
  if (sent) return <div role="status" className="rounded-2xl border bg-muted p-5"><h2 className="font-bold">Revisa tu correo</h2><p className="mt-2 text-sm leading-6">Si podemos completar el registro, recibirás un enlace para confirmar tu cuenta. Si ya tienes una cuenta, puedes ingresar o recuperar tu contraseña.</p><Link href="/login" className="mt-4 inline-block font-semibold text-primary underline">Ir a ingresar</Link></div>;
  return <form className="space-y-5" noValidate onSubmit={async event=>{
    event.preventDefault(); const data=new FormData(event.currentTarget);
    const raw={...Object.fromEntries(data),acceptTerms:data.get("acceptTerms")==="on",categoryIds:data.getAll("categoryIds"),coverageAreas:String(data.get("city")??"")};
    const parsed=technician?technicianRegistrationInputSchema.safeParse(raw):customerRegistrationInputSchema.safeParse(raw);
    if(!parsed.success) {setErrors(Object.fromEntries(parsed.error.issues.map(i=>[String(i.path[0]),i.message])));return;}
    setErrors({});setMessage("");setPending(true);
    try {const service=new AuthenticationService(); if(technician) await service.registerTechnician(technicianRegistrationInputSchema.parse(raw)); else await service.registerCustomer(customerRegistrationInputSchema.parse(raw));setSent(true);}
    catch {setMessage("No pudimos completar la solicitud. Inténtalo más tarde.");}
    finally {setPending(false);}
  }}><div className="grid gap-5 sm:grid-cols-2">{fields.map(field=><label key={field.name} className="block space-y-2"><span className="text-sm font-semibold">{field.label}</span><input name={field.name} required autoComplete={field.auto} type={field.type} maxLength={field.type==="password"?128:field.name==="phone"?24:field.name==="email"?254:60} aria-invalid={!!errors[field.name]} aria-describedby={field.name+"-error"} className={inputClass}/><span id={field.name+"-error"} className="text-sm text-destructive">{errors[field.name]}</span></label>)}</div><p className="text-xs leading-5 text-muted-foreground">Contraseña: al menos 12 caracteres, mayúscula, minúscula y número.</p>{technician?<><label className="block space-y-2"><span className="text-sm font-semibold">Comuna de cobertura</span><input name="city" required maxLength={80} className={inputClass}/><span className="text-sm text-destructive">{errors.city}</span></label><fieldset className="rounded-2xl border p-4"><legend className="px-2 text-sm font-semibold">Especialidades</legend><div className="grid gap-3 sm:grid-cols-2">{categories.map(category=><label className="flex gap-3 text-sm" key={category.id}><input name="categoryIds" type="checkbox" value={category.id}/>{category.name}</label>)}</div><p className="mt-2 text-sm text-destructive">{errors.categoryIds}</p></fieldset><p className="text-sm leading-6 text-muted-foreground">Tu postulación quedará pendiente. Después de confirmar tu correo podrás completar tu perfil; se publicará solo tras una revisión administrativa.</p></>:null}<label className="flex items-start gap-3 text-sm leading-6"><input name="acceptTerms" required type="checkbox" className="mt-1 size-4"/><span>Acepto los <Link href="/terminos" className="font-semibold underline">términos de uso</Link> y la <Link href="/privacidad" className="font-semibold underline">política de privacidad</Link>.</span></label>{errors.acceptTerms?<p className="text-sm text-destructive">{errors.acceptTerms}</p>:null}{message?<p role="alert" className="rounded-xl bg-muted p-4 text-sm">{message}</p>:null}<Button className="h-12 w-full" disabled={pending}>{pending?"Procesando…":technician?"Enviar postulación":"Crear cuenta"}</Button></form>;
}
export function CustomerSignUpForm(){return <RegistrationForm/>;}
export function TechnicianSignUpForm({categories}:{categories:readonly Category[]}){return <RegistrationForm technician categories={categories}/>;}
