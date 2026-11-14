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
  { path: "/como-funciona", migrated: true, identify: { selector: "h1", text: "Cómo funciona SoyFixo" } },
  { path: "/terminos", migrated: true, identify: { selector: "h1", text: "Términos de uso" } },
  { path: "/privacidad", migrated: true, identify: { selector: "h1", text: "Privacidad" } },
  { path: "/tecnicos", migrated: true, identify: { selector: "h1", text: "Encuentra al técnico indicado" } },
  { path: "/login", migrated: true, identify: { selector: "h1", text: "en un solo lugar|Bienvenido de vuelta" } },
  { path: "/registro", migrated: true, identify: { selector: "h1", text: "Crea tu cuenta de cliente" } },
  { path: "/registro/tecnico", migrated: true, identify: { selector: "h1", text: "Haz crecer tu trabajo" } },
  { path: "/recuperar-contrasena", migrated: true, identify: { selector: "h1", text: "Recupera tu acceso" } },
  // Pages behind a session (demo accounts; the app must run with NEXT_PUBLIC_DEMO_MODE=true). Views that need real persistence
  // (jobs, applications, several admin lists) render their error state in demo mode, so that state is what gets audited there;
  // their real content needs the local Supabase stack and is NOT covered by this audit.
  { path: "/cliente", as: "customer", migrated: true, identify: { selector: "h1", text: "Mis solicitudes" } },
  { path: "/cliente/trabajos", as: "customer", migrated: true, identify: { selector: "h1", text: "No pudimos cargar la información" } },
  { path: "/solicitar", as: "customer", migrated: true, identify: { selector: "h1", text: "Solicitud de servicio" } },
  { path: "/perfil", as: "customer", migrated: true, identify: { selector: "h1", text: "Mi perfil" } },
  { path: "/urgencia", as: "customer", migrated: true, identify: { selector: "h1", text: "Necesito ayuda urgente" } },
  { path: "/tecnico", as: "technician", migrated: true, identify: { selector: "h1", text: "Hola, Camila" } },
  { path: "/tecnico/oportunidades", as: "technician", migrated: true, identify: { selector: "h1", text: "Nuevas solicitudes" } },
  { path: "/tecnico/trabajos", as: "technician", migrated: true, identify: { selector: "h1", text: "No pudimos cargar la información" } },
  { path: "/tecnico/postulacion", as: "technician", migrated: true, identify: { selector: "h1", text: "No pudimos cargar la postulación" } },
  { path: "/tecnico/agenda", as: "technician", migrated: true, identify: { selector: "h1", text: "Agenda" } },
  { path: "/tecnico/perfil", as: "technician", migrated: true, identify: { selector: "h1", text: "Mi perfil profesional" } },
  { path: "/tecnico/pagos", as: "technician", migrated: true, identify: { selector: "h1", text: "Pagos e importes asignados" } },
  { path: "/tecnicos/camila-rojas", migrated: true, identify: { selector: "h1", text: "Camila Rojas" } },
  { path: "/admin", as: "admin", migrated: true, identify: { selector: "h1", text: "Vista general de la plataforma" } },
  { path: "/admin/usuarios", as: "admin", migrated: true, identify: { selector: "h1", text: "Usuarios" } },
  { path: "/admin/solicitudes", as: "admin", migrated: true, identify: { selector: "h1", text: "No pudimos cargar la información" } },
  { path: "/admin/trabajos", as: "admin", migrated: true, identify: { selector: "h1", text: "No pudimos cargar la información" } },
  { path: "/admin/tecnicos", as: "admin", migrated: true, identify: { selector: "h1", text: "Gestionar técnicos" } },
  { path: "/admin/tecnicos/camila-rojas", as: "admin", migrated: true, identify: { selector: "h1", text: "Camila Rojas" } },
  { path: "/admin/verificaciones", as: "admin", migrated: true, identify: { selector: "h1", text: "Verificaciones pendientes" } },
  { path: "/admin/reportes", as: "admin", migrated: true, identify: { selector: "h1", text: "Reportes y reclamos" } },
  { path: "/admin/configuracion", as: "admin", migrated: true, identify: { selector: "h1", text: "Configuración operativa" } },
  { path: "/admin/audit-log", as: "admin", migrated: true, identify: { selector: "h1", text: "Audit log" } },
  { path: "/admin/usuarios/auditoria", as: "admin", migrated: true, identify: { selector: "h1", text: "Auditoría de cuentas" } },
  { path: "/admin/usuarios/invitaciones", as: "admin", migrated: true, identify: { selector: "h1", text: "Invitaciones" } },
];
// Touch minimum: 44 px on mobile (our own target); 24 px on desktop (WCAG 2.5.8 AA).
const viewports = [{ name: "movil", width: 390, height: 844, min: 44 }, { name: "escritorio", width: 1280, height: 800, min: 24 }];

// --only=/admin,/tecnico audits just the routes whose path starts with one of the given prefixes (handy while iterating).
const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const only = onlyArg ? onlyArg.slice("--only=".length).split(",").filter(Boolean) : null;
const selected = only ? routes.filter((route) => only.some((prefix) => route.path === prefix || route.path.startsWith(prefix + "/") || (prefix.endsWith("*") && route.path.startsWith(prefix.slice(0, -1))))) : routes;
// A prefix that matches nothing must never be skipped silently (Git Bash rewrites "--only=/cliente" into a Windows path unless
// MSYS_NO_PATHCONV=1 is set, which would otherwise turn into a green audit that measured less than you asked for).
if (only) {
  const unmatched = only.filter((prefix) => !routes.some((route) => route.path === prefix || route.path.startsWith(prefix + "/") || (prefix.endsWith("*") && route.path.startsWith(prefix.slice(0, -1)))));
  if (unmatched.length > 0) {
    console.log(`Prefijo(s) de --only sin rutas: ${unmatched.join(", ")}. Rutas disponibles: ${routes.map((route) => route.path).join(" ")}`);
    console.log("En Git Bash anteponga MSYS_NO_PATHCONV=1: la shell reescribe los argumentos que empiezan por /.");
    process.exit(2);
  }
}
if (selected.length === 0) { console.log("Ninguna ruta coincide con --only"); process.exit(1); }

const browser = await chromium.launch();
let total = 0;
for (const scheme of ["light", "dark"]) {
  for (const viewport of viewports) {
    for (const route of selected) {
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
