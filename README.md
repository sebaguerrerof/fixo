# fixo — Marketplace de técnicos

> Estado comercial y aceptación de identidad: **BLOCKED** por integración aislada pendiente. Consulta el [reporte Sprint 01](docs/production/SPRINT_01_REPORT.md), el [runbook de pruebas](docs/production/SPRINT_01_INTEGRATION_RUNBOOK.md) y el [plan Sprint 02](docs/production/SPRINT_02_IMPLEMENTATION_PLAN.md). Cotizaciones, trabajos, pagos y urgencias todavía no están habilitados.

Marketplace en desarrollo. Supabase tiene adapters para cuentas, perfiles, directorio, registro de solicitudes y revisión administrativa. Las funciones comerciales sin persistencia se muestran como no disponibles.

## Inicio rápido

Usar **Node 24.22.2**, definido en `.node-version` y `.nvmrc`.

```powershell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm ci
npm run dev
```

Configura URL y clave pública de un entorno autorizado. Sin configuración válida, la aplicación falla cerrada; nunca activa mocks por omisión. Para desarrollo aislado se permite `NEXT_PUBLIC_DEMO_MODE=true` explícito, con indicador de demostración y sin clientes Supabase reales. Producción y previews rechazan ese valor.

Auth real requiere las tres migraciones revisadas, `FIXO_APP_URL` exacto y `SUPABASE_SERVICE_ROLE_KEY` solo en servidor para límites, pruebas de recuperación e invitaciones. No copiar claves productivas a pruebas. `FIXO_INVITATIONS_ENABLED=false` por defecto. Las rutas nuevas incluyen confirmación, recuperación, perfil y administración real por RPC; no funcionan contra el esquema remoto antiguo hasta una migración autorizada. Las plantillas y activación de correo están en el [runbook SMTP](docs/production/SPRINT_01_SMTP_RUNBOOK.md). Los textos legales son provisionales y requieren aprobación antes de registros comerciales.

No ejecutar el SQL inicial contra la base Fixo existente: ya tiene esquema y carece de historial. Seguir el [runbook de baseline](docs/production/SUPABASE_BASELINE_RUNBOOK.md). Reparación y migraciones remotas requieren aprobación; las pruebas usan exclusivamente local/staging.

## Pagos (Sprint 05, Flow Sandbox)

Implementado y probado sólo en local; **deshabilitado por defecto** y sin evidencia de Sandbox real. Ver [reporte](docs/production/SPRINT_05_REPORT.md) y [runbook](docs/production/SPRINT_05_FLOW_SANDBOX_RUNBOOK.md). Variables en `.env.example`. No hay cobros reales.

## Arquitectura

```text
App Router / componentes
        ↓
Servicios de aplicación
        ↓
Contratos de repositorio y proveedores
        ↓
Adapters Supabase y proveedores externos
```

La interfaz no usa SDKs de infraestructura directamente. La autenticación, los repositorios y proveedores externos se mantienen detrás de servicios y contratos intercambiables.

## Comandos de calidad

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:smoke
npm run secrets:check
npm audit
npm audit --omit=dev
```

El workflow [CI](.github/workflows/ci.yml) incluye checks de aplicación y pruebas pgTAP locales. No contiene despliegues. Ver [ramas y previews](docs/production/CI_VERCEL_RELEASE_PLAN.md) antes de cualquier push o integración Git–Vercel.

Consulta [supabase/README.md](supabase/README.md) para la configuración de producción y [marketplace_tecnicos_master.md](marketplace_tecnicos_master.md) para la especificación de producto.
