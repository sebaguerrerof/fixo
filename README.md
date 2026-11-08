# fixo — Marketplace de técnicos

> Estado comercial: **BLOCKED**. Consulta el [reporte Sprint 00.5](docs/production/SPRINT_00_5_REPORT.md), el [plan Sprint 01](docs/production/SPRINT_01_IMPLEMENTATION_PLAN.md) y la [auditoría Sprint 00](docs/production/SPRINT_00_AUDIT.md). Cotizaciones, trabajos, pagos y urgencias todavía no están habilitados.

Marketplace en desarrollo. Supabase tiene adapters para cuentas, perfiles, directorio, registro de solicitudes y revisión administrativa. Las funciones comerciales sin persistencia se muestran como no disponibles.

## Inicio rápido

Usar **Node 24.22.2**, definido en `.node-version` y `.nvmrc`.

```powershell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm ci
npm run dev
```

Configura URL y clave pública de un entorno autorizado. Sin configuración válida, la aplicación falla cerrada; nunca activa mocks por omisión. Para desarrollo aislado se permite `NEXT_PUBLIC_DEMO_MODE=true` explícito, con indicador de demostración y sin clientes Supabase reales. Producción y previews rechazan ese valor.

No ejecutar el SQL inicial contra la base Fixo existente: ya tiene esquema y carece de historial. Seguir el [runbook de baseline](docs/production/SUPABASE_BASELINE_RUNBOOK.md). Reparación y migraciones remotas requieren aprobación; las pruebas usan exclusivamente local/staging.

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
