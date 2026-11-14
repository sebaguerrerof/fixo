"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveProfessionalDraft, submitProfessionalApplication, uploadProfessionalDocument } from "@/app/tecnico/postulacion/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxRow, Field, Input, Select, Textarea } from "@/components/ui/field";
import { TextLink } from "@/components/ui/text-link";
import { brand } from "@/design-system/brand";
import type { ProfessionalApplication, ProfessionalRequirement } from "@/domain/technicians/application";
import { professionalDraftSchema } from "@/domain/technicians/application";
import { applicationStateLabel, documentReviewLabel, documentTypeLabel, inspectionStateLabel, professionalEventLabel } from "@/domain/technicians/application-labels";

const csv = (value: FormDataEntryValue | null) => String(value ?? "").split(",").map((v) => v.trim()).filter(Boolean);
const fileInput = "h-auto min-h-11 py-2 file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-secondary-foreground";
const panel = "space-y-5 rounded-lg border border-border bg-card p-5";

export function ProfessionalApplicationForm({ application: a, categories, requirements }: { application: ProfessionalApplication; categories: { id: string; name: string }[]; requirements: ProfessionalRequirement[] }) {
  const [saving, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [refreshing, startTransition] = useTransition();
  const pending = saving || refreshing;
  const router = useRouter();
  const locked = ["suspended", "temporarily_suspended", "banned"].includes(a.profile.status);
  async function execute(run: () => Promise<{ ok: boolean; message: string }>) {
    setPending(true);
    try { const result = await run(); setMessage(result.message); if (result.ok) startTransition(() => router.refresh()); }
    catch { setMessage("No pudimos completar la operación. Intenta nuevamente."); }
    finally { setPending(false); }
  }
  const textFields = [
    ["city", "Comuna base", a.profile.city, 80],
    ["headline", "Presentación profesional", a.profile.headline, 180],
    ["coverage", "Comunas de cobertura, separadas por coma", a.profile.coverage_areas.join(", "), 2000],
    ["specialties", "Especialidades, separadas por coma", a.specialties.join(", "), 2000],
  ] as const;

  return (
    <div className="space-y-8">
      <section className={panel}>
        <h2 className="text-2xl">{a.name}</h2>
        <p>Postulación: <strong>{applicationStateLabel(a.state)}</strong> · {a.published ? "Publicada en el directorio" : "Pendiente de publicación"}</p>
        {a.review_reason ? <Alert tone="warning" title="Observación del equipo">{a.review_reason}</Alert> : null}
        <div><TextLink className="underline" href="/perfil">Editar nombre y contacto privado</TextLink></div>
        <p className="text-sm text-muted-foreground">Los cambios de antecedentes retiran la publicación y requieren revisión.</p>
      </section>

      <form className={panel} onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const raw = { city: data.get("city"), headline: data.get("headline"), bio: data.get("bio"), coverage: csv(data.get("coverage")), categories: data.getAll("categories"), primaryCategory: data.get("primaryCategory"), specialties: csv(data.get("specialties")), years: data.get("years"), price: data.get("price"), availability: data.get("availability"), portfolio: String(data.get("portfolio") ?? "").split(/\r?\n/).map((v) => v.trim()).filter(Boolean) };
        const parsed = professionalDraftSchema.safeParse(raw);
        if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? "Revisa los datos."); return; }
        void execute(() => saveProfessionalDraft(parsed.data, a.revision, crypto.randomUUID()));
      }}>
        <fieldset className="space-y-5" disabled={pending || locked}>
          <legend className="mb-4 text-2xl font-bold">Antecedentes profesionales</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            {textFields.map(([name, label, value, max]) => (
              <Field htmlFor={name} key={name} label={label}><Input defaultValue={value} id={name} maxLength={max} name={name} required={name === "city"} /></Field>
            ))}
          </div>
          <Field htmlFor="bio" label="Experiencia y servicios"><Textarea className="min-h-32" defaultValue={a.profile.bio} id="bio" maxLength={2000} name="bio" /></Field>
          <fieldset>
            <legend className="mb-1 font-semibold">Rubros de trabajo</legend>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {categories.map((c) => <CheckboxRow key={c.id}><Checkbox defaultChecked={a.categories.includes(c.id)} name="categories" value={c.id} />{c.name}</CheckboxRow>)}
            </div>
          </fieldset>
          <Field htmlFor="primaryCategory" label="Rubro principal">
            <Select defaultValue={a.primary_category ?? a.categories[0] ?? ""} id="primaryCategory" name="primaryCategory" required>
              <option value="">Selecciona un rubro</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field htmlFor="years" label="Años de experiencia declarada"><Input defaultValue={a.profile.years_of_experience} id="years" inputMode="numeric" max={80} min={0} name="years" required type="number" /></Field>
            <Field htmlFor="price" label="Precio referencial en CLP"><Input defaultValue={a.profile.starting_price_clp} id="price" inputMode="numeric" max={10000000} min={0} name="price" required type="number" /></Field>
          </div>
          <Field htmlFor="availability" label="Disponibilidad"><Textarea defaultValue={a.availability} id="availability" maxLength={500} name="availability" placeholder="Días y horarios habituales" /></Field>
          <Field htmlFor="portfolio" label="Portafolio: un enlace HTTPS por línea"><Textarea defaultValue={a.portfolio.join("\n")} id="portfolio" maxLength={5010} name="portfolio" /></Field>
          <Button disabled={pending || locked} loading={pending} type="submit">Guardar borrador</Button>
        </fieldset>
      </form>

      <section className={panel}>
        <h2 className="text-2xl">Documentación del rubro</h2>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">Guarda primero el rubro principal para ver sus requisitos. Archivos PDF sin contenido activo, PNG o JPEG, hasta 10 MiB. La cuarentena termina después de una inspección automática real.</p>
        {requirements.length ? requirements.map((r) => (
          <div className="space-y-2 rounded-lg border border-border p-4" key={r.id}>
            <p className="font-semibold">{r.description}</p>
            <p className="text-sm">{r.kind === "legal" ? "Requisito legal confirmado" : r.kind === "internal" ? `Criterio interno ${brand.name}` : "Información opcional"} · versión {r.version} · {r.required ? "Obligatorio" : "Opcional"}</p>
            {r.source_url ? <a className="inline-flex min-h-11 items-center text-sm text-primary underline" href={r.source_url} rel="noopener noreferrer" target="_blank">Consultar fuente</a> : null}
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); void execute(() => uploadProfessionalDocument(data)); }}>
              <input name="requirement" type="hidden" value={r.id} />
              <Field htmlFor={`file-${r.id}`} label={`Archivo para ${r.requirement_key}`}>
                <Input accept="application/pdf,image/png,image/jpeg" className={fileInput} disabled={pending || locked} id={`file-${r.id}`} name="file" required type="file" />
              </Field>
              <Button disabled={pending || locked} size="sm" type="submit" variant="outline">Cargar o reemplazar antecedente</Button>
            </form>
          </div>
        )) : <Alert tone="info">Administración aún no ha configurado criterios para este rubro. Puedes guardar el borrador.</Alert>}
        {a.documents.length ? (
          <ul className="space-y-3">
            {a.documents.map((d) => (
              <li className="rounded-lg border border-border p-4 text-sm" key={d.id}>
                <p>{documentTypeLabel(d.document_type)} · {d.current_document ? "Vigente" : "Reemplazado"}</p>
                <p>Inspección: {inspectionStateLabel(d.inspection_status)} · Revisión: {documentReviewLabel(d.status)}</p>
                {d.review_reason ? <p>{d.review_reason}</p> : null}
                {d.inspection_status === "clean" && d.current_document ? <a className="inline-flex min-h-11 items-center text-primary underline" href={`/api/technician-documents/${d.id}`}>Descargar documento</a> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <form className="space-y-4 rounded-lg border border-border bg-card p-5" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); void execute(() => submitProfessionalApplication(a.revision, data.get("consent") === "on", crypto.randomUUID())); }}>
        <h2 className="text-2xl">Enviar a revisión</h2>
        <CheckboxRow className="items-start"><Checkbox disabled={pending || locked} name="consent" required /><span className="text-sm">Confirmo que los antecedentes declarados son veraces y autorizo a {brand.name} a revisar esta postulación y sus documentos.</span></CheckboxRow>
        <Button disabled={pending || locked || !["draft", "needs_information", "rejected"].includes(a.state)} loading={pending} type="submit">Enviar postulación</Button>
      </form>

      {message ? <div aria-live="polite" role="status"><Alert tone="info">{message}</Alert></div> : null}

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-2xl">Historial de la postulación</h2>
        <ul className="mt-4 divide-y divide-border">
          {a.history.slice(0, 30).map((e) => (
            <li className="py-3 text-sm first:pt-0" key={e.id}>
              <p>{e.reason}</p>
              <p className="text-muted-foreground">{new Date(e.created_at).toLocaleString("es-CL")} · {e.next_state ? applicationStateLabel(e.next_state) : professionalEventLabel(e.action)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
