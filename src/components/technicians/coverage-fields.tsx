"use client";
import { X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxRow, Field, Select } from "@/components/ui/field";
import { CHILE_REGIONS, MAX_COVERAGE_COMMUNES, canonicalCommune, communesOfRegion, regionOfCommune } from "@/domain/geo/chile-communes";

interface CoverageFieldsProps {
  /** Unique prefix for the control ids (use React's useId in the parent). */
  readonly idPrefix: string;
  /** Previously saved base commune and coverage; values that are not a commune are dropped and reported. */
  readonly defaultCity?: string;
  readonly defaultCoverage?: readonly string[];
  readonly errors?: { readonly city?: string; readonly coverageAreas?: string };
}

/**
 * Where a technician works: region → base commune (field "city"), and any number of coverage communes (up to 20, from any region)
 * submitted as repeated "coverageAreas" fields. Only official commune names can be chosen, so what is stored is always matchable.
 */
export function CoverageFields({ idPrefix, defaultCity = "", defaultCoverage = [], errors = {} }: CoverageFieldsProps) {
  const initialCity = canonicalCommune(defaultCity) ?? "";
  const initialCoverage = [...new Set(defaultCoverage.map((value) => canonicalCommune(value)).filter((name): name is string => name !== null))].slice(0, MAX_COVERAGE_COMMUNES);
  const dropped = [...new Set([defaultCity, ...defaultCoverage].map((value) => value.trim()).filter((value) => value && canonicalCommune(value) === null))];
  const initialRegion = regionOfCommune(initialCity)?.id ?? regionOfCommune(initialCoverage[0] ?? "")?.id ?? "";

  const [baseRegion, setBaseRegion] = useState(initialRegion);
  const [city, setCity] = useState(initialCity);
  const [browseRegion, setBrowseRegion] = useState(initialRegion);
  const [selected, setSelected] = useState<readonly string[]>(initialCoverage);

  const full = selected.length >= MAX_COVERAGE_COMMUNES;
  const id = (name: string) => `${idPrefix}-${name}`;
  const toggle = (commune: string) => setSelected((current) => current.includes(commune) ? current.filter((name) => name !== commune) : current.length >= MAX_COVERAGE_COMMUNES ? current : [...current, commune]);

  return (
    <div className="space-y-5">
      {dropped.length > 0 ? (
        <p className="rounded-lg border border-warning-border bg-warning-soft p-3 text-sm text-warning-soft-foreground" role="status">
          Estos valores anteriores no corresponden a una comuna y no se conservarán: {dropped.join(", ")}. Elige tus comunas de la lista.
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field htmlFor={id("base-region")} label="Región">
          <Select id={id("base-region")} onChange={(event) => { setBaseRegion(event.target.value); setBrowseRegion(event.target.value); setCity(""); }} value={baseRegion}>
            <option value="">Selecciona una región</option>
            {CHILE_REGIONS.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
          </Select>
        </Field>
        <Field error={errors.city} htmlFor={id("city")} label="Comuna base">
          <Select
            aria-describedby={`${id("city")}-msg`}
            aria-invalid={errors.city ? true : undefined}
            disabled={!baseRegion}
            id={id("city")}
            name="city"
            onChange={(event) => { const value = event.target.value; setCity(value); if (value) setSelected((current) => current.includes(value) || current.length >= MAX_COVERAGE_COMMUNES ? current : [...current, value]); }}
            required
            value={city}
          >
            <option value="">{baseRegion ? "Selecciona una comuna" : "Primero elige la región"}</option>
            {communesOfRegion(baseRegion).map((name) => <option key={name} value={name}>{name}</option>)}
          </Select>
        </Field>
      </div>

      <fieldset aria-describedby={errors.coverageAreas ? `${id("coverage")}-msg` : undefined} className="rounded-lg border border-border p-4">
        <legend className="px-2 text-sm font-semibold">Comunas de cobertura</legend>
        <p className="text-sm leading-6 text-muted-foreground">Elige una región y marca las comunas donde atiendes. Puedes sumar comunas de otras regiones, hasta {MAX_COVERAGE_COMMUNES}.</p>

        <Field className="mt-4 max-w-sm" htmlFor={id("browse-region")} label="Ver comunas de la región">
          <Select id={id("browse-region")} onChange={(event) => setBrowseRegion(event.target.value)} value={browseRegion}>
            <option value="">Selecciona una región</option>
            {CHILE_REGIONS.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
          </Select>
        </Field>

        {browseRegion ? (
          <div className="mt-3 grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
            {communesOfRegion(browseRegion).map((name) => {
              const checked = selected.includes(name);
              return (
                <CheckboxRow key={name}>
                  <Checkbox checked={checked} disabled={!checked && full} onChange={() => toggle(name)} />
                  {name}
                </CheckboxRow>
              );
            })}
          </div>
        ) : null}

        <div className="mt-4 border-t border-border pt-4">
          <p aria-live="polite" className="text-sm font-medium">Seleccionadas: {selected.length} de {MAX_COVERAGE_COMMUNES}{full ? " (máximo alcanzado)" : ""}</p>
          {selected.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {selected.map((name) => (
                <li className="inline-flex items-center gap-1 rounded-full border border-border bg-muted py-0.5 pl-3 pr-1 text-sm" key={name}>
                  {name}
                  <Button aria-label={`Quitar ${name}`} className="size-8 rounded-full" onClick={() => toggle(name)} size="icon" type="button" variant="ghost"><X aria-hidden="true" className="size-4" /></Button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-1 text-sm text-muted-foreground">Aún no eliges ninguna comuna.</p>}
        </div>
        {selected.map((name) => <input key={name} name="coverageAreas" type="hidden" value={name} />)}
        {errors.coverageAreas ? <p className="mt-3 text-sm text-destructive-soft-foreground" id={`${id("coverage")}-msg`} role="alert">{errors.coverageAreas}</p> : null}
      </fieldset>
    </div>
  );
}
