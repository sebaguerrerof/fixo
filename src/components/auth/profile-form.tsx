"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { TextLink } from "@/components/ui/text-link";
import { updateProfileAction } from "@/app/perfil/actions";
import { profileUpdateSchema } from "@/domain/auth/account";
export interface OwnProfile {firstName:string;lastName:string;phone:string;email:string;fullName:string;role:string;accountStatus:string;createdAt:string;termsAccepted:boolean;technician:{city:string;headline:string;bio:string;coverageAreas:string;status:string;categoryIds:string[]}|null}
export function ProfileForm({profile}:{profile:OwnProfile}) {
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;
  const [pending,setPending]=useState(false);const [message,setMessage]=useState("");const router=useRouter();
  return <form className="space-y-5" onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);const raw={...Object.fromEntries(data),professional:null};const parsed=profileUpdateSchema.safeParse(raw);if(!parsed.success){setMessage(parsed.error.issues[0]?.message??"Revisa los datos.");return;}setPending(true);try{const result=await updateProfileAction(parsed.data);setMessage(result.message);if(result.ok)router.refresh();}finally{setPending(false);}}}><p className="text-sm text-muted-foreground">{profile.email} · {profile.role} · Cuenta {profile.accountStatus}</p>
      <div className="grid gap-5 sm:grid-cols-2">
        {[["firstName", "Nombre", profile.firstName], ["lastName", "Apellido", profile.lastName], ["phone", "Teléfono", profile.phone]].map(([name, label, value]) => (
          <Field htmlFor={f(name)} key={name} label={label}><Input autoComplete={name === "firstName" ? "given-name" : name === "lastName" ? "family-name" : "tel"} defaultValue={value} id={f(name)} inputMode={name === "phone" ? "tel" : undefined} maxLength={name === "phone" ? 24 : 60} name={name} required type={name === "phone" ? "tel" : "text"} /></Field>
        ))}
      </div>
      {profile.technician ? <p className="text-sm text-muted-foreground">Tus datos profesionales, documentos y revisión están en <TextLink className="underline" href="/tecnico/perfil">Mi perfil profesional</TextLink>.</p> : null}
      {message ? <div aria-live="polite" role="status"><Alert tone="info">{message}</Alert></div> : null}
      <Button disabled={pending} loading={pending} type="submit">Guardar perfil</Button>
    </form>;
}
