# fixo — Marketplace de técnicos

> Estado de producción: **BLOCKED**. Consulta la [auditoría Sprint 00](docs/production/SPRINT_00_AUDIT.md) y su [reporte](docs/production/SPRINT_00_REPORT.md). Cotizaciones, trabajos y urgencias aún no tienen persistencia Supabase implementada. No activar demo para recibir clientes reales ni repetir la migración inicial en una base existente sin revisar su estado.

Plataforma para encontrar, contratar y gestionar servicios de técnicos y especialistas. Usa Supabase como fuente de verdad para cuentas, perfiles, técnicos, solicitudes y acciones administrativas.

## Inicio rápido

```bash
copy .env.example .env.local
npm install
npm run dev
```

Antes de iniciar, ejecuta la migración [202608170001_initial_marketplace.sql](supabase/migrations/202608170001_initial_marketplace.sql) en el SQL Editor de tu proyecto Supabase y configura las tres variables de `.env.example`.

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
```

Consulta [supabase/README.md](supabase/README.md) para la configuración de producción y [marketplace_tecnicos_master.md](marketplace_tecnicos_master.md) para la especificación de producto.
