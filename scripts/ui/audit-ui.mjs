// Browser audit of the real rendered UI (needs a running app and Playwright's Chromium):
//   node scripts/ui/audit-ui.mjs [baseUrl] [--all]      default http://localhost:3000
// Per route, theme (light/dark) and viewport (mobile/desktop) it checks:
//   - the route is really the page we mean (status, final URL without unexpected redirects, identifying element),
//   - contrast of every visible text against its effective background (WCAG AA),
//   - touch targets: >= 44 px on mobile, >= 24 px on desktop (WCAG 2.5.8), and no overlap between controls,
//   - every control, wherever it sits on the page, is scrolled into view and clicked at its centre and four edges.
// Read-only: it only loads public pages. The checks themselves are proven by scripts/ui/test-audit-ui.mjs.
import { createRequire } from "node:module";
import { auditRoute } from "./audit-lib.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");

const base = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "http://localhost:3000";
const all = process.argv.includes("--all");

// Pages already moved to the design system must pass. Pages still waiting for their redesign phase are reported (PEND) but do
// not fail the audit unless --all is passed.
const routes = [
  { path: "/", migrated: true, identify: { selector: "h1", text: "arreglo del hogar" } },
  { path: "/como-funciona", migrated: true, identify: { selector: "h1, h2", text: "Más claridad para cada servicio" } },
  { path: "/terminos", migrated: true, identify: { selector: "h1", text: "Términos de uso" } },
  { path: "/privacidad", migrated: true, identify: { selector: "h1", text: "Privacidad" } },
  { path: "/tecnicos", migrated: true, identify: { selector: "h1, h2", text: "Encuentra al técnico indicado" } },
  { path: "/login", migrated: true, identify: { selector: "h1", text: "siempre bajo control|Bienvenido de vuelta" } },
  { path: "/registro", migrated: true, identify: { selector: "h1", text: "Resuelve lo que necesitas" } },
  { path: "/registro/tecnico", migrated: true, identify: { selector: "h1", text: "Haz crecer tu trabajo" } },
  { path: "/recuperar-contrasena", migrated: true, identify: { selector: "h1", text: "Recupera tu acceso" } },
];
// Touch minimum: 44 px on mobile (our own target); 24 px on desktop (WCAG 2.5.8 AA).
const viewports = [{ name: "movil", width: 390, height: 844, min: 44 }, { name: "escritorio", width: 1280, height: 800, min: 24 }];

const browser = await chromium.launch();
let total = 0;
for (const scheme of ["light", "dark"]) {
  for (const viewport of viewports) {
    for (const route of routes) {
      const { failures, checked, controls, notes } = await auditRoute({ browser, base, route, scheme, viewport });
      const counts = all || route.migrated;
      if (counts) total += failures.length;
      console.log(`${failures.length === 0 ? "OK  " : counts ? "FAIL" : "PEND"} ${scheme}/${viewport.name} ${route.path}  (${checked} textos, ${controls} controles)`);
      for (const line of failures.slice(0, 8)) console.log("      " + line);
      for (const note of notes) console.log(`      (nota: ${note})`);
    }
  }
}
await browser.close();
console.log(total === 0 ? "\nAUDITORIA OK" : `\nAUDITORIA CON ${total} HALLAZGOS`);
process.exit(total === 0 ? 0 : 1);
