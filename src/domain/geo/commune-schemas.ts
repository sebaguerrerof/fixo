import { z } from "zod";

import { MAX_COVERAGE_COMMUNES, canonicalCommune } from "./chile-communes";

const NOT_A_COMMUNE = "Elige una comuna de la lista.";

/** One commune, normalized to its official spelling ("nunoa" → "Ñuñoa"). Anything that is not a commune is rejected. */
export const communeSchema = z.string().trim().transform((value, ctx) => {
  const name = canonicalCommune(value);
  if (name === null) { ctx.addIssue({ code: "custom", message: NOT_A_COMMUNE }); return z.NEVER; }
  return name;
});

function uniqueCanonical(values: readonly string[], ctx: z.RefinementCtx): string[] {
  const names: string[] = [];
  for (const value of values) {
    const name = canonicalCommune(value);
    if (name === null) { ctx.addIssue({ code: "custom", message: NOT_A_COMMUNE }); return z.NEVER; }
    if (!names.includes(name)) names.push(name);
  }
  if (names.length > MAX_COVERAGE_COMMUNES) { ctx.addIssue({ code: "custom", message: `Elige como máximo ${MAX_COVERAGE_COMMUNES} comunas.` }); return z.NEVER; }
  return names;
}

/** Coverage as the list of official commune names (de-duplicated, at most 20). May be empty: drafts are saved before they are complete. */
export const coverageListSchema = z.array(z.string().trim()).transform((values, ctx) => uniqueCanonical(values, ctx));

/** Coverage as the comma-separated text the registration and profile endpoints use; at least one commune is required. */
export const coverageCsvSchema = z.string().trim().min(1, "Elige al menos una comuna de cobertura.").max(900).transform((value, ctx) => {
  const names = uniqueCanonical(value.split(",").map((part) => part.trim()).filter(Boolean), ctx);
  if (names === z.NEVER) return z.NEVER;
  if (names.length === 0) { ctx.addIssue({ code: "custom", message: "Elige al menos una comuna de cobertura." }); return z.NEVER; }
  return names.join(", ");
});
