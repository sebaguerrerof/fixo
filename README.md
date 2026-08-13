# fixo — Marketplace de técnicos

Plataforma para encontrar, contratar y gestionar servicios de técnicos y especialistas. Parte con información de ejemplo para explorar el producto sin depender todavía de Supabase, pagos, IA ni mapas.

## Inicio rápido

```bash
copy .env.example .env.local
npm install
npm run dev
```

La aplicación mantiene la información local de ejemplo mientras `NEXT_PUBLIC_USE_SAMPLE_DATA=true`.

## Accesos de ejemplo

Contraseña compartida: `fixo2026`

- Cliente: `cliente@fixo.cl`
- Técnico: `tecnico@fixo.cl`
- Administración: `admin@fixo.cl`

## Arquitectura

```text
App Router / componentes
        ↓
Servicios de aplicación
        ↓
Contratos de repositorio y proveedores
        ↓
Datos locales de ejemplo / adapters Supabase y externos
```

La interfaz no usa SDKs de infraestructura directamente. La autenticación, los repositorios y proveedores externos se mantienen detrás de servicios y contratos intercambiables.

## Comandos de calidad

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Consulta [docs/integrations.md](docs/integrations.md) para conectar los proveedores reales y [marketplace_tecnicos_master.md](marketplace_tecnicos_master.md) para la especificación de producto.
