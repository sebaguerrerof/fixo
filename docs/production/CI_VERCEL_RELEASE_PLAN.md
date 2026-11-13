# Fixo — CI, ramas y previews

Estado: **preparado localmente**, sin push, integración Git, preview ni despliegue ejecutados.

Runtime definido: **Node 24.22.2**, `.node-version`, `.nvmrc` y engines `24.x`. Mantiene la versión mayor configurada en Vercel. La verificación local usa una distribución portable oficial con SHA256 comprobado; no se cambió el Node global del equipo.

## Ramas

- `main` conserva el corte auditado `58ba08a`; no es una release lista para publicar.
- Sprint 00.5 quedó en `codex/sprint-00-5-stabilization`; identidad en `codex/sprint-01-identity`. La integración real y Sprint 02 están en `codex/supabase-integration-sprint-02`. Ver los informes de cada corte y el log local para commits exactos.
- Las próximas tareas usan ramas `codex/...`, PRs y checks antes de incorporar cambios. No crear ni usar una rama de producción automática sin acordarla.
- La aprobación de lectura de servicios no autoriza un push. Un push inicial también puede activar integraciones de hosting y debe aprobarse explícitamente.

## Workflow preparado

`.github/workflows/ci.yml` se ejecuta en push, PR y manualmente, con permisos contents:read. Checkout/setup-node están fijados a SHA resueltos desde los repositorios oficiales v6. No usa pull_request_target, secretos productivos ni credenciales Supabase/Vercel.

Job application: npm ci, escaneo de secretos, lint, typecheck, tests, build, smoke HTTP de producción y ambas auditorías npm. Para compilar usa URL/key ficticias no funcionales que **no** representan datos de usuarios ni un backend demo. Demo está desactivado. El smoke no usa login ni escrituras y verifica cookies falsificadas contra rutas privadas.

Job database: CLI Supabase 3.0.0 fijado, servicios locales en el runner, reset exclusivamente local y pgTAP. Los fixtures de pruebas se revierten. No hay `--remote`, project link ni pasos de despliegue. La sintaxis del workflow se validó con actionlint 1.7.12. **No se afirma PASS de GitHub Actions ni del job DB** hasta que se ejecuten realmente.

Los checks obligatorios propuestos son `Fixo CI / application` y `Fixo CI / database`. Activar protección de la rama que se acuerde, revisión de PR y bloqueo de merges con checks fallidos. Validar los nombres exactos que GitHub publique antes de configurar reglas externas.

## Vinculación segura con Vercel, pendiente de aprobación

La inspección remota mostró gitLink null y despliegues CLI sin SHA. No conectar GitHub a `fixo-marketplace` a ciegas: el enlace o el primer push puede crear un despliegue productivo con defaults de Vercel.

1. Aprobar primero el código/commit a enviar y el destino de rama. Conservar el despliegue actual y registrar su ID/alias como referencia de rollback.
2. Usar preferentemente **un proyecto Vercel de preview separado**, con base Supabase de staging separada y correo de captura. No conectarlo a la base comercial para pruebas de usuarios/documentos.
3. Antes de cualquier enlace al proyecto productivo, revisar en UI las opciones vigentes de despliegue automático/production branch. Mantener sin automatismo productivo hasta validar el plan. Si Vercel no permite garantizarlo durante el enlace, continuar solo con el proyecto separado de preview.
4. Configurar variables por target y proyecto; URL/key públicas de staging para preview/development. La service role se limita a rate limits/proofs/invitaciones de Auth y al worker de inspección, nunca navegador ni pruebas de RLS. Las consultas normales usan la sesión del actor. El worker requiere ClamAV y firmas mantenidas fuera del frontend Vercel.
5. Demo siempre false. Acordar URLs exactas de Auth callback/recovery del preview, sin allowlists amplias hacia producción. No copiar SMTP productivo a pruebas.
6. Ejecutar checks y pruebas DB/API/correo en staging. Registrar SHA, lockfile, runtime y migraciones del preview; revisar la versión visual y permisos.
7. Solo con aprobación de release y gates verdes decidir cómo promover o desplegar a producción. No promover un artefacto construido con URL/key de staging como si fuera productivo: las variables NEXT_PUBLIC se incorporan al build. Verificar la documentación y el comportamiento vigente de Vercel al decidir el método.

Rollback de aplicación: conservar el despliegue productivo anterior y la referencia de código; cualquier reasignación de alias/promoción requiere aprobación. Rollback DB se planifica aparte: volver un deploy no deshace migraciones ni invalida URLs firmadas emitidas.

No hay herramientas de deploy ni tokens de acceso añadidos al workflow. La estrategia es verificable por commit/checks/evidencia de preview, pero sus operaciones externas siguen pendientes.
