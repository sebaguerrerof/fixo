# Supabase

La migración `migrations/202608170001_initial_marketplace.sql` crea el modelo inicial de Fixo:

- perfiles y roles;
- postulación y estados de técnicos;
- categorías, solicitudes y auditoría administrativa;
- políticas RLS y bucket privado para documentos de verificación.

## Proyecto existente y baseline

La base Fixo ya contiene ese esquema, pero su historial de migraciones está vacío. **No repetir el SQL inicial ni editar roles manualmente como flujo normal de operación.** La reconciliación y el hardening están preparados en el [runbook](../docs/production/SUPABASE_BASELINE_RUNBOOK.md) y requieren validación y aprobación antes de cualquier cambio remoto.

La migración `20261108223021_harden_marketplace_access.sql` conserva datos/roles y prepara helpers privados, privilegios mínimos, protección del estado inicial y Storage privado con límites. Todavía no está aplicada remotamente.

## Desarrollo y pruebas aisladas

CLI examinado y fijado: **3.0.0**. Node **24.22.2**, Docker funcional. El CLI v3 apunta a local por defecto; estos comandos no incluyen project link ni flags remotos:

```bash
npx --yes supabase@3.0.0 start --exclude studio,realtime,edge-runtime,imgproxy,logflare,vector,supavisor
npx --yes supabase@3.0.0 db reset --no-seed
npx --yes supabase@3.0.0 test db
npx --yes supabase@3.0.0 stop
```

`db reset` elimina solo los datos del proyecto local: usar exclusivamente un entorno desechable, nunca añadir `--remote`. El config no carga cuentas ni operaciones demo. El baseline carga categorías; las cuentas sintéticas están únicamente en la transacción pgTAP y se revierten.

`tests/00_access_hardening.test.sql` prepara 27 verificaciones de privilegios, trigger de registro, estados manipulados, aislamiento entre usuarios, documentos y RPC administrativo/auditoría. Docker no pudo iniciar durante Sprint 00.5: estas pruebas DB aún no tienen un resultado ejecutado; el job CI está preparado para correrlas en un runner aislado.

## Autenticación y documentos

Auth local requiere confirmación, contraseña mínima de ocho caracteres y captura SMTP local. Los callbacks de confirmación y recuperación se diseñan en el [plan Sprint 01](../docs/production/SPRINT_01_IMPLEMENTATION_PLAN.md); los redirects futuros configurados no significan que sus rutas ya existan.

El bucket privado preparado admite PDF/JPEG/PNG de hasta 10 MiB. El servicio de URLs firmadas usa sesión real del solicitante y TTL fijo de 60 segundos. El flujo de carga/revisión de documentación llegará en Sprint 02; no habilitar permisos de metadatos amplios para suplirlo.
