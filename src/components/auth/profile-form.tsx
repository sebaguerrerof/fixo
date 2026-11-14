"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxRow, Field, Input, Textarea } from "@/components/ui/field";
import { updateProfileAction } from "@/app/perfil/actions";
import { profileUpdateSchema } from "@/domain/auth/account";
export interface OwnProfile {firstName:string;lastName:string;phone:string;email:string;fullName:string;role:string;accountStatus:string;createdAt:string;termsAccepted:boolean;technician:{city:string;headline:string;bio:string;coverageAreas:string;status:string;categoryIds:string[]}|null}
export function ProfileForm({profile,categories}:{profile:OwnProfile;categories:{id:string;name:string}[]}) {
  const [pending,setPending]=useState(false);const [message,setMessage]=useState("");const router=useRouter();
  const editable=profile.role==="technician"&&profile.technician&&["draft","pending_verification","needs_information"].includes(profile.technician.status);
  return <form className="space-y-5" onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);const raw={...Object.fromEntries(data),professional:editable?{city:data.get("city"),headline:data.get("headline"),bio:data.get("bio"),coverageAreas:data.get("coverageAreas"),categoryIds:data.getAll("categoryIds")}:null};const parsed=profileUpdateSchema.safeParse(raw);if(!parsed.success){setMessage(parsed.error.issues[0]?.message??"Revisa los datos.");return;}setPending(true);try{const result=await updateProfileAction(parsed.data);setMessage(result.message);if(result.ok)router.refresh();}finally{setPending(false);}}}><p className="text-sm text-muted-foreground">{profile.email} · {profile.role} · Cuenta {profile.accountStatus}</p>
      <div className="grid gap-5 sm:grid-cols-2">
        {[["firstName", "Nombre", profile.firstName], ["lastName", "Apellido", profile.lastName], ["phone", "Teléfono", profile.phone]].map(([name, label, value]) => (
          <Field htmlFor={name} key={name} label={label}><Input autoComplete={name === "firstName" ? "given-name" : name === "lastName" ? "family-name" : "tel"} defaultValue={value} id={name} inputMode={name === "phone" ? "tel" : undefined} maxLength={name === "phone" ? 24 : 60} name={name} required type={name === "phone" ? "tel" : "text"} /></Field>
        ))}
      </div>
      {profile.technician ? (
        <section className="space-y-5 rounded-lg border border-border p-5">
          <h2 className="text-2xl">Postulación profesional</h2>
          <p className="text-sm text-muted-foreground">Estado: {profile.technician.status}. La cuenta y la aprobación profesional se gestionan por separado.</p>
          {editable ? (
            <>
              {[["city", "Comuna base", profile.technician.city], ["coverageAreas", "Comunas de cobertura (separadas por coma)", profile.technician.coverageAreas], ["headline", "Presentación profesional", profile.technician.headline]].map(([name, label, value]) => (
                <Field htmlFor={name} key={name} label={label}><Input defaultValue={value} id={name} maxLength={name === "city" ? 80 : name === "headline" ? 180 : 320} name={name} required={name !== "headline"} /></Field>
              ))}
              <Field htmlFor="bio" label="Experiencia y servicios"><Textarea className="min-h-28" defaultValue={profile.technician.bio} id="bio" maxLength={2000} name="bio" /></Field>
              <fieldset>
                <legend className="mb-1 text-sm font-medium">Rubros</legend>
                <div className="grid gap-x-4 sm:grid-cols-2">{categories.map((category) => <CheckboxRow key={category.id}><Checkbox defaultChecked={profile.technician?.categoryIds.includes(category.id)} name="categoryIds" value={category.id} />{category.name}</CheckboxRow>)}</div>
              </fieldset>
            </>
          ) : <p className="text-sm">Para modificar un perfil ya revisado, solicita una revisión administrativa. Este formulario conserva la aprobación existente.</p>}
        </section>
      ) : null}
      {message ? <div aria-live="polite" role="status"><Alert tone="info">{message}</Alert></div> : null}
      <Button disabled={pending} loading={pending} type="submit">Guardar perfil</Button>
    </form>;
}
