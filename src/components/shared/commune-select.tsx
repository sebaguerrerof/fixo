"use client";
import { useState } from "react";

import { Field, Select } from "@/components/ui/field";
import { CHILE_REGIONS, canonicalCommune, communesOfRegion, regionOfCommune } from "@/domain/geo/chile-communes";

interface CommuneSelectProps {
  /** Unique prefix for the control ids (use React's useId in the parent). */
  readonly idPrefix: string;
  /** The selected commune's official name, or "" when none. Controlled by the parent (e.g. a react-hook-form field). */
  readonly value: string;
  readonly onChange: (commune: string) => void;
  readonly onBlur?: () => void;
  readonly error?: string;
  readonly label?: string;
}

/** One commune of Chile chosen by region first: region select, then the commune select of that region. */
export function CommuneSelect({ idPrefix, value, onChange, onBlur, error, label = "Comuna" }: CommuneSelectProps) {
  const [region, setRegion] = useState(regionOfCommune(value)?.id ?? "");
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field htmlFor={id("region")} label="Región">
        <Select id={id("region")} onChange={(event) => { setRegion(event.target.value); onChange(""); }} value={region}>
          <option value="">Selecciona una región</option>
          {CHILE_REGIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </Field>
      <Field error={error} htmlFor={id("commune")} label={label}>
        <Select
          aria-describedby={`${id("commune")}-msg`}
          aria-invalid={error ? true : undefined}
          disabled={!region}
          id={id("commune")}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          value={canonicalCommune(value) ?? ""}
        >
          <option value="">{region ? "Selecciona una comuna" : "Primero elige la región"}</option>
          {communesOfRegion(region).map((name) => <option key={name} value={name}>{name}</option>)}
        </Select>
      </Field>
    </div>
  );
}
