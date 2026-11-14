/**
 * Single source of truth for the SoyFixo brand in user-visible text and metadata.
 * Never write the product name by hand in a component: import it from here.
 * Technical identifiers (npm package, database objects, routes, env vars) intentionally keep the legacy "fixo" spelling.
 */
export const brand = {
  name: "SoyFixo",
  legalName: "SoyFixo",
  tagline: "Técnicos de confianza para tu hogar",
  description: "Encuentra técnicos verificados, pide cotizaciones y resuelve urgencias del hogar con claridad. Servicios a domicilio en Chile.",
  domain: "soyfixo.cl",
  url: "https://www.soyfixo.cl",
  locale: "es-CL",
  themeColor: { light: "#0f7d97", dark: "#0b1118" },
} as const;

export const brandTitle = (page?: string): string => (page ? `${page} | ${brand.name}` : `${brand.name} | ${brand.tagline}`);
