# Supabase

Estado: **migraciones locales preparadas; aceptación aislada BLOCKED**. No aplicar SQL a producción ni reintentar arranques locales sin autorización. El propietario eligió mantener la integración bloqueada tras los fallos de arranque.

## Migraciones

| Archivo | Alcance | Ejecución en este sprint |
| --- | --- | --- |
| 202608170001_initial_marketplace.sql | Modelo original de nueve tablas; archivo intacto. | No reejecutado. |
| 20261108223021_harden_marketplace_access.sql | Helpers privados, ACL, RLS comercial y Storage 10 MiB/MIME. | NOT TESTED en DB; no aplicado remoto. |
| 20261108234902_identity_and_account_administration.sql | Estado global, contactos/consentimiento privados, sesiones vigentes, auditoría, invitaciones, RPC y autorización. | Parser SQL/PLpgSQL PASS sintáctico; ejecución DB NOT TESTED. |

La base Fixo existente ya tiene el esquema inicial y carece de historial. **No repetir baseline ni editar roles manualmente como operación normal.** Seguir el [runbook de baseline](../docs/production/SUPABASE_BASELINE_RUNBOOK.md), con drift, backup/restore y aprobaciones independientes.

## Pruebas

- CLI examinado: 3.0.0; v2.122.1 instalado únicamente para contraste de diagnóstico, sin start ejecutado.
- Docker 29.9.2 y WSL2 respondieron fuera del sandbox; Supabase falló por DNS interno de Realtime y healthcheck PostgreSQL. El CLI limpió recursos de sus intentos fallidos. No ejecutar prune/rm/reset sobre datos existentes.
- pgTAP preparado: 27 aserciones en 00_access_hardening.test.sql y 53 en 01_identity.test.sql. Los fixtures de 00 se adaptaron a los requisitos nuevos de identidad/consentimiento/sesión conservando sus 27 comprobaciones.
- El runner `npm run test:integration` prepara 24 escenarios Auth/RPC/RLS/Storage/Mailpit/concurrencia; exige instancia vacía y consentimiento explícito, no carga .env.local y no acepta un destino remoto. No se ejecutó.
- Secuencia, puertos, variables de pruebas y gates de navegador en [SPRINT_01_INTEGRATION_RUNBOOK.md](../docs/production/SPRINT_01_INTEGRATION_RUNBOOK.md). No sustituir pruebas reales por un parser o mocks.

## Identidad y documentos

Auth local: confirmación requerida; mínimo 12 caracteres, mayúscula/minúscula/número; templates confirmation/recovery/invite en config.toml y captura Mailpit, sin SMTP externo. Las rutas /auth/callback, /recuperar-contrasena y /auth/update-password están implementadas y su integración real no está acreditada.

PII de contacto y consentimiento viven en private.account_details; no se añaden email/teléfono al perfil público. Los roles y estados se consultan desde PostgreSQL y las operaciones sensibles verifican auth.sessions actual. Invitaciones no asignan privilegios desde metadata: aceptación coteja la reserva privada y el estado del administrador.

Bucket privado PDF/JPEG/PNG, 10 MiB; URLs firmadas por 60 segundos usando JWT propio. Suspensión global bloquea operaciones privadas, incluso con JWT anterior. Carga/revisión de documentos, inspección binaria y aprobación profesional completa se terminan en Sprint 02.

Ver [reporte Sprint 01](../docs/production/SPRINT_01_REPORT.md), [SMTP/Zoho](../docs/production/SPRINT_01_SMTP_RUNBOOK.md) y [plan Sprint 02](../docs/production/SPRINT_02_IMPLEMENTATION_PLAN.md).
