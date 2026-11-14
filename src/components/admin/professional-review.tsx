"use client";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { decideProfessionalApplication, reviewProfessionalDocument, versionProfessionalRequirement } from "@/app/admin/postulaciones/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxRow, Field, Input, Select, Textarea } from "@/components/ui/field";
import { brand } from "@/design-system/brand";

export function ProfessionalDecisionForm({ target, revision, documentId, state }: { target?: string; revision?: number; documentId?: string; state?: string }) {
  const id = useId();
  const [saving, setPending] = useState(false), [message, setMessage] = useState("");
  const [refreshing, startTransition] = useTransition();
  const pending = saving || refreshing;
  const router = useRouter();
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault(); const data = new FormData(e.currentTarget); setPending(true);
      try {
        const result = documentId
          ? await reviewProfessionalDocument({ document_id: documentId, decision: data.get("decision"), reason: data.get("reason") })
          : await decideProfessionalApplication({ target, expected_revision: revision, decision: data.get("decision"), reason: data.get("reason"), operation_id: crypto.randomUUID() });
        setMessage(result.message); if (result.ok) startTransition(() => router.refresh());
      } catch { setMessage("No pudimos completar la revisión."); } finally { setPending(false); }
    }}>
      <Field htmlFor={`${id}-decision`} label="Decisión">
        <Select disabled={pending} id={`${id}-decision`} name="decision" required>
          <option value="">Selecciona una decisión</option>
          {documentId ? <><option value="approved">Aprobar documento</option><option value="rejected">Rechazar documento</option></>
            : state === "approved" ? <option value="suspended">Suspender profesionalmente</option>
            : <><option value="needs_information">Solicitar antecedentes</option><option value="approved">Aprobar y publicar</option><option value="rejected">Rechazar postulación</option></>}
        </Select>
      </Field>
      <Field htmlFor={`${id}-reason`} label="Motivo de la decisión"><Textarea disabled={pending} id={`${id}-reason`} maxLength={1000} minLength={3} name="reason" required /></Field>
      <Button disabled={pending} loading={pending} type="submit">Registrar revisión</Button>
      {message ? <div aria-live="polite"><Alert tone="info">{message}</Alert></div> : null}
    </form>
  );
}

export function RequirementVersionForm({ category }: { category: string }) {
  const id = useId();
  const [saving, setPending] = useState(false), [message, setMessage] = useState("");
  const [refreshing, startTransition] = useTransition();
  const pending = saving || refreshing;
  const router = useRouter();
  return (
    <form className="space-y-4 rounded-lg border border-border bg-card p-5" onSubmit={async (e) => {
      e.preventDefault(); const data = new FormData(e.currentTarget); setPending(true);
      try {
        const result = await versionProfessionalRequirement({ category, key: data.get("key"), requirement_kind: data.get("kind"), is_required: data.get("required") === "on", document_kind: data.get("documentType"), description: data.get("description"), source_url: data.get("source") || null, reason: data.get("reason") });
        setMessage(result.message); if (result.ok) startTransition(() => router.refresh());
      } catch { setMessage("No pudimos guardar el requisito."); } finally { setPending(false); }
    }}>
      <h2 className="text-2xl">Crear requisito o nueva versión</h2>
      <p className="text-sm leading-6 text-muted-foreground">La misma clave crea la siguiente versión. Una fuente enlazada debe ser revisada por {brand.name} antes de declarar un requisito legal confirmado.</p>
      <Field htmlFor={`${id}-key`} label="Clave del requisito"><Input id={`${id}-key`} maxLength={60} name="key" pattern="[a-z0-9-]{2,60}" placeholder="antecedente-identidad" required /></Field>
      <Field htmlFor={`${id}-kind`} label="Clasificación">
        <Select id={`${id}-kind`} name="kind"><option value="internal">Criterio interno {brand.name}</option><option value="optional">Información opcional</option><option value="legal">Requisito legal confirmado</option></Select>
      </Field>
      <CheckboxRow><Checkbox name="required" />Obligatorio para publicar</CheckboxRow>
      <Field htmlFor={`${id}-doc`} label="Tipo de documento">
        <Select id={`${id}-doc`} name="documentType"><option value="identity">Identidad</option><option value="certificate">Certificado</option><option value="license">Licencia</option><option value="other">Otro</option></Select>
      </Field>
      <Field htmlFor={`${id}-description`} label="Descripción del criterio"><Textarea id={`${id}-description`} maxLength={1000} minLength={3} name="description" required /></Field>
      <Field htmlFor={`${id}-source`} label="Fuente oficial HTTPS, obligatoria para requisitos legales"><Input id={`${id}-source`} maxLength={1000} name="source" type="url" /></Field>
      <Field htmlFor={`${id}-reason`} label="Motivo de la versión"><Textarea id={`${id}-reason`} maxLength={1000} minLength={3} name="reason" required /></Field>
      <Button disabled={pending} loading={pending} type="submit">Guardar nueva versión</Button>
      {message ? <div aria-live="polite"><Alert tone="info">{message}</Alert></div> : null}
    </form>
  );
}
