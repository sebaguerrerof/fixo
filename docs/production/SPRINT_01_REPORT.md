# Fixo — Sprint 01: usuarios, autenticación y administración

Fecha: **8 de noviembre de 2026**, America/Santiago. Base: `69fa1d5` (Sprint 00.5). Rama: `codex/sprint-01-identity`.

**Estado general: BLOCKED para aceptación funcional real y publicación.** El sistema se implementó localmente con adapters Supabase reales y pruebas unitarias. **Ningún flujo nuevo está acreditado contra una instancia aislada de Supabase**; la migración de identidad no se aplicó a ninguna base. El propietario eligió continuar con esa integración bloqueada.

## 1. Resumen ejecutivo

Se implementaron registro customer/technician, confirmación OTP/PKCE, recuperación, logout, perfil propio, estados globales, administración de usuarios, invitaciones y auditoría. Se conservan Next.js 15, React 19, TypeScript estricto, Supabase y componentes del diseño existente. Los datos administrativos provienen de RPC reales; ante DB/configuración ausente la UI muestra indisponibilidad, nunca filas ficticias.

El código real no depende de identidades demo. El modo demo aislado heredado sigue limitado a desarrollo/pruebas explícitas y no abre infraestructura Supabase. Los nuevos módulos administrativos/perfil/recuperación no implementan un backend mock alternativo.

**174 pruebas en 26 archivos pasan**, frente a 88 de la base estabilizada. Npm audit completo y productivo: **0 vulnerabilidades**. Las pruebas de Auth usan dobles para controlar errores/estados; no representan entrega de correo, aislamiento RLS real ni aprobación de producción.

## 2. Estado U01–U11

PASS en la columna local describe código/pruebas de ese alcance, no aceptación de integración.

| Tarea | Implementación y verificación local | Integración / aceptación |
| --- | --- | --- |
| U01 Entorno aislado | Diagnóstico Docker/WSL y CLI; copia dedicada preparada, no arrancada. | **BLOCKED**: start falló y el propietario rechazó nuevos intentos. |
| U02 Estado de cuenta | **PASS local**: enum active/suspended/blocked separado del rol y de aprobación; migración aditiva, guard y tests de UI/servidor. | **NOT TESTED** ejecución SQL/backfill/políticas. |
| U03 Registro robusto | **PASS local**: nombres, teléfono, contraseña/confirmación, consentimiento, especialidad/comuna; Zod servidor, rol fijo por endpoint, trigger acotado y respuestas neutras. | **NOT TESTED** alta real/trigger/correo. |
| U04 Confirmación | **PASS local**: OTP en servidor con pantalla de confirmación, PKCE de confirmación, destinos fijos, rechazo de errores/reuso simulado. | **NOT TESTED** OTP/PKCE/cookies/segundo navegador reales. |
| U05 Recuperación | **PASS local**: respuesta neutra, límites, prueba privada hash/usuario/sesión/TTL y consumo único, nueva contraseña y logout global. | **NOT TESTED** entrega/token/expiración/revocación real. |
| U06 Sesiones y bloqueo | **PASS local**: middleware/layouts/actions usan acceso DB; SQL comprueba estado actual y auth.sessions con correo confirmado. | **NOT TESTED** JWT previo contra RLS y sesión revocada real. |
| U07 Perfil propio | **PASS local**: formulario y RPC allowlist, contacto privado; edición profesional solo draft/pending/needs_information; sin campos de privilegios. | **NOT TESTED** persistencia/aislamiento reales. |
| U08 RBAC | **PASS local**: matriz servidor + guards SQL/RLS; moderator no cambia roles ni suspende administradores. | **NOT TESTED** RPC/REST directos con JWT de cada rol. |
| U09 Invitaciones | **PASS local**: reserva persistente/idempotente, envío Auth exclusivo servidor, resultados inciertos, reenvío explícito/cooldown, revocación/expiración y aceptación guardada. | **NOT TESTED** envío/captura/Auth y reintentos entre sistemas reales. |
| U10 Roles y estados | **PASS local**: RPC con lock transaccional común, motivo/auditoría, restricción de self-change/último superadmin y UI con confirmación. | **NOT TESTED** transacción/concurrencia real. |
| U11 Integración y abuso | **PASS preparación**: pgTAP, runner aislado y checklist de browser; sintaxis comprobada. | **BLOCKED**: 27 + 53 pgTAP, 24 escenarios SDK y browser sin ejecutar. |

## 3. Base de datos y seguridad

Migración nueva: **supabase/migrations/20261108234902_identity_and_account_administration.sql**, generada con CLI 3.0.0. La inicial `202608170001_initial_marketplace.sql` permanece intacta y su versión de doce dígitos debe comprobarse en CLI antes del baseline.

- profiles.account_status con default/backfill active; no reasigna roles ni aprueba técnicos existentes.
- Cinco tablas privadas con RLS y sin grants de cliente: account_details (contacto/consentimiento), account_events, user_invitations, auth_flows y auth_rate_limits.
- No se agrega email/teléfono al perfil público. PII solo por RPC propia o administrativa autorizada. No se infieren consentimientos históricos: los perfiles anteriores reciben detalles vacíos, sin consentimiento inventado.
- Alta pública nueva exige nombres/contacto/consentimiento en PostgreSQL; la aplicación valida formato y confirmación de contraseña. Metadata arbitraria nunca selecciona moderator/superadmin ni account_status. Solo la intención no privilegiada technician se admite; invitado comienza customer restringido hasta aceptar la reserva privada.
- Los helpers privados consultan rol/estado actual y sesión vigente en auth.sessions, con not_after y correo confirmado. JWT antiguo no basta para operar. Funciones SECURITY DEFINER tienen search_path fijo y grants explícitos; se conservan donde RLS/operaciones transaccionales requieren acceso interno.
- Requests/documentos/Storage usan políticas restrictivas de cuenta activa; directorio requiere rol technician + cuenta activa + aprobación profesional. Al convertir otro rol a technician se reinicia la revisión a pending_verification. La revisión profesional completa/documental sigue en Sprint 02.
- Cambios sensibles serializados con pg_advisory_xact_lock, lock de fila y auditoría en la misma transacción. Se prohíben cambios propios de acceso y retirar el último superadmin activo. Moderator solo gestiona estado customer/technician; asignar cualquier rol exige superadmin.
- Firma documental existente: JWT del solicitante, dueño/rol, path validado y TTL 60 s. Inspección binaria/antimalware y UI de documentación no se implementan en este sprint.
- Se registran fallos de acciones desde servidor mediante una operación separada y acotada; si DB no está disponible no se fabrica un evento exitoso. Las llamadas RPC rechazadas directamente y revertidas requieren logs de infraestructura para trazabilidad de intentos: la auditoría transaccional acredita cambios confirmados, no todos los intentos posibles.

El parser offline PostgreSQL/PLpgSQL pasó, usando pgsql-parser 18.3.3/libpg-query WASM. **No resuelve catálogos, grants, dependencias, consultas ni RLS contra PostgreSQL 17**. No equivale a db lint/advisors ni al pgTAP no ejecutado.

## 4. Funcionalidades y rutas

| Ruta / operación | Comportamiento implementado |
| --- | --- |
| /registro, /registro/tecnico | Identidad/contacto/consentimiento/contraseñas; técnico mínimo con rubros/comuna y postulación pendiente. Campos complementarios se completan desde perfil/Sprint 02. |
| POST /api/auth | Gateway same-origin: login, registro de rol fijo, recover y logout; JSON acotado a 16 KiB incluso sin Content-Length; errores sin detalles internos. |
| /login | Credenciales reales, destino interno permitido, refresh de navegación, recuperación y mensajes de cuenta restringida. |
| /auth/callback | Confirmación explícita antes de consumir OTP; OTP email/recovery/invite y code PKCE solo para confirmación; next externo ignorado; no-store/no-referrer/noindex. |
| /recuperar-contrasena | Solicitud neutra, sin confirmar existencia o entrega. |
| /auth/update-password | Sesión verificada + prueba privada de 15 min y un solo uso, validación de contraseña, finalización de invitación cuando corresponda y logout global. |
| /cuenta-no-disponible | Estado suspended/blocked obtenido de DB; orienta invitación pendiente/recuperación y permite logout. |
| /perfil | Contacto/nombre propio; edición profesional permitida por estado; cuenta/rol/aprobación no editables por formulario ni UPDATE directo. |
| /admin/usuarios | Lista real de 20 por página, búsqueda literal por nombre/correo, filtros de rol/estado, registro y acceso al detalle. |
| /admin/usuarios/[id] | Datos permitidos, último acceso disponible en Auth, postulación, historial, observación y acciones confirmadas con motivo. |
| /admin/usuarios/invitaciones | Crear/revisar/reenviar/revocar, roles permitidos y estado real; envío deshabilitado por defecto. |
| /admin/usuarios/auditoria | Auditoría paginada de cuentas, filtro de objetivo; superadmin completa y moderator limitada a operación no privilegiada. |
| /terminos, /privacidad | Textos provisionales visibles de desarrollo, versionados; requieren identidad/contactos/retención y aprobación legal antes de registro comercial. |

Los guards de servidor complementan middleware y RLS. La tabla responsive, mensajes/loading, confirmaciones y componentes reutilizan el design system. **QA visual móvil/contrastes/teclado formal NOT TESTED**; no se certifica por compilar JSX.

## 5. Invitaciones, idempotencia y límites

El administrador se autentica con su JWT. PostgreSQL valida actor/rol objetivo y reserva email normalizado + request_id antes del envío externo. Un duplicado o reintento de reserva incierta no envía automáticamente otro mensaje. Reenvío requiere acción explícita, 60 s de espera y máximo 10 reservas por actor/hora.

Solo servidor usa service role para Admin Auth/resultado de entrega, pruebas de recuperación y rate limits; nunca para leer filas de usuario ni acreditar RLS. No se muestran claves, contraseñas o tokens al administrador. El trigger vincula la identidad invitada a la reserva por email/condición nativa invited_at; la aceptación coteja usuario, correo confirmado, estado/expiración y autorización actual del invitador. Rol privilegiado procede de la reserva, no del correo ni user_metadata.

Estados de invitación: pending, accepted, expired derivado y revoked; delivery separado sending/sent/failed/uncertain. Expiración de reserva una hora, alineada con OTP local. Una revocación es terminal en este flujo: no hay restauración silenciosa de enlaces revocados. La aceptación técnica crea perfil pendiente sin publicación.

Auth y Postgres no forman una transacción distribuida. Si se interrumpe después de confirmar correo/cambiar contraseña, recuperación permite completar la misma invitación pendiente. Reenvío sobre una identidad invitada ya confirmada puede usar recovery OTP si Auth devuelve email_exists/user_already_exists, siempre con user_id previamente vinculado. No se usa ese fallback para cuentas ajenas. Estos casos tienen unit tests y requieren prueba real.

## 6. Correos, entorno y dependencias

Plantillas de confirmación/recuperación/invitación Fixo en supabase/templates y config.toml. Configuración local de confirmación, contraseña 12+ con mayúscula/minúscula/número, OTP de una hora y captura Mailpit. **Ningún correo real ni de captura fue enviado exitosamente en esta sesión.**

Nombres requeridos, sin valores:

| Variable | Ubicación / finalidad |
| --- | --- |
| NEXT_PUBLIC_DEMO_MODE | false en aplicación real; producción rechaza true. |
| NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Proyecto de ese entorno; claves públicas, sin secretos de admin. |
| FIXO_APP_URL | Origen exacto de Next.js/callback por entorno, solo servidor. |
| SUPABASE_SERVICE_ROLE_KEY | Solo servidor, necesaria para límites/flow proofs e invitaciones; nunca NEXT_PUBLIC. .env.local no fue modificado ni versionado. |
| FIXO_INVITATIONS_ENABLED | false por defecto; opt-in independiente tras aprobar proveedor/destino. |
| FIXO_TEST_* | Solo proceso de pruebas aisladas; lista en runbook, nunca valores productivos. |

El [runbook SMTP/Zoho](SPRINT_01_SMTP_RUNBOOK.md) prepara host/plan/datacenter, remitente propuesto notificaciones@soyfixo.cl, secretos, SPF/DKIM/DMARC, URLs y prueba de entrega. No presupone casilla/SMTP/DNS activos. Revisar CAPTCHA, límites nativos, protección de contraseñas filtradas y capacidad por IP del gateway antes de abrir registros públicos.

Dependencias: versiones Supabase existentes fijadas exactamente a SSR 0.12.4 y JS 2.112.3; server-only 0.0.1 agregado para impedir imports cliente de privilegios; pg 8.23.1 solo dev para bootstrap/concurrencia del runner futuro. No se sustituyó el stack. Lockfile actualizado; npm ci reproducible instaló 415 paquetes en Node 24.22.2. Npm 11 omitió el postinstall no aprobado de unrs-resolver; no se habilitó por conveniencia y los checks se ejecutaron después.

## 7. Verificación

| Check | Estado | Alcance |
| --- | --- | --- |
| npm ci | PASS | Node 24.22.2, lockfile final, sin force/legacy-peer-deps. |
| lint | PASS | Exit 0. |
| typecheck | PASS | Exit 0, strict conservado. |
| unit tests | PASS | **26 archivos / 174 pruebas**; originales conservadas/adaptadas y casos nuevos. |
| build | PASS | Next 15.5.29, build final con Middleware y rutas nuevas; sin deploy. |
| production HTTP smoke | PASS acotado | Seis rutas protegidas, páginas Auth/enlaces inválidos, no-store/no-referrer y rechazo de origen ajeno; sin sesiones reales/escrituras Auth. |
| npm audit | PASS | 0 vulnerabilidades. |
| npm audit --omit=dev | PASS | 0 vulnerabilidades productivas. |
| SQL + PLpgSQL offline | PASS limitado | Sintaxis, no ejecución ni autorización real. |
| Secret scan | PASS acotado | Cero hallazgos de patrones y valores locales en candidatos; no certifica ausencia universal de secretos. |
| pgTAP | NOT TESTED / BLOCKED | 27 + 53 aserciones preparadas. |
| Integration runner | NOT TESTED / BLOCKED | 24 escenarios preparados, incluye uno opt-in de espera de expiración; no arrancado. |
| SMTP capture / Auth / Storage / concurrency real | NOT TESTED | Sin instancia funcional autorizada. |
| Browser E2E / QA visual formal | NOT TESTED | Checklist preparado; entorno ausente. |
| GitHub Actions / preview | NOT TESTED | Sin push, enlace Git ni deploy. |

La suite local cubre overposting de roles/estados, validaciones/consentimiento, origen y tamaño de requests, respuesta neutra, middleware, cuentas restringidas, destinos, callbacks y pruebas de contraseña/reintento con dobles de Auth; permisos de invitación, persistencia de resultados inciertos y fallback seguro. pgTAP y runner son la comprobación pendiente de lo que no pueden acreditar esos dobles.

## 8. Docker, errores y medidas

En sandbox, Docker/WSL/telemetría CLI devolvían permisos denegados; fuera del sandbox respondieron Docker Server **29.9.2**, WSL2 docker-desktop activo y CLI **3.0.0**. No se reiniciaron procesos del usuario.

Supabase start falló en inicialización Realtime con DB_HOST nxdomain; repetir con debug identificó esa causa. Un intento con red dedicada falló por healthcheck/ECONNREFUSED a PostgreSQL. CLI informó limpieza de contenedores/volumen supabase_db_fixo creados durante esos intentos; no se ejecutaron comandos manuales rm/prune ni se operó la instancia ajena existente.

La revisión automática **rechazó un intento posterior** por riesgo de poda de volúmenes. Se preparó una copia nueva desechable con puertos 54331–54334 y se pidió aprobación concreta; el propietario respondió **“No, continuar con la integración bloqueada”**. No se arrancó esa copia, no se reintentó start ni se ejecutó el runner. Queda una red local creada para el diagnóstico y la copia ignorada; no se borraron para forzar una prueba.

## 9. Git, archivos y entrega

Base estabilizada preservada; main permanece en 58ba08a. Rama nueva desde 69fa1d5, sin cambios previos sin confirmar. Código, SQL y tests guardados en **66deee1**; validación final de teléfono y prueba DB en **9d4946e** (8–15 dígitos, además de formato). Reporte/evidencias en un commit documental posterior. Consultar git log; los hashes se informan al entregar. Respaldo Git verificado en .audit-backups/sprint01-20261108/pre-sprint01.bundle, SHA256 A93641D00E3AEF2E68C30824546B5E4AE26F327370E5E576B66E45CF62DBBFB1. No se ejecutó push, deploy ni cambios de infraestructura remota.

Inventario completo: [CHANGED_FILES.md](sprint-01-evidence/CHANGED_FILES.md). Grupos: dominio/validación/auth providers, middleware/guards, gateway y flujos, perfil y administración UI/servicios, SQL/config/templates/tests, runner/script smoke, package/lock y documentación. Se conserva el baseline inicial y se excluyen .env.local, .vercel, herramientas, logs temporales y respaldos ignorados.

## 10. Riesgos, aceptación y pendientes remotos

1. **BLOCKED:** aceptación de U01/U11. Sin SQL ejecutado no se puede afirmar que grants, helpers, trigger, último superadmin, Storage o transacciones funcionan en Supabase.
2. **BLOCKED:** el proyecto productivo conserva su historial vacío y esquema anterior; los RPC nuevos no existen allí. El código nuevo falla cerrado contra esa versión. No publicar solo el frontend.
3. El contrato de alta cambia: trigger nuevo exige nombres/teléfono/consentimiento. Es aditivo en datos pero **no totalmente compatible con el registro de la app 00.5**. Preparar ventana con registro cerrado y combinación exacta de SQL/aplicación; baseline → hardening → identidad solo después de gates y aprobación.
4. SMTP, casilla/plan Zoho, dominio/URLs, SPF/DKIM/DMARC, textos legales definitivos, captura y entrega siguen pendientes. La marca y archivos HTML no equivalen a correo funcional.
5. Rate limits de gateway/nativos están preparados, pero CAPTCHA, carga/volumen desde servidor y controles del proveedor requieren validación antes de exposición pública. No confiar en headers IP arbitrarios.
6. La auditoría confirmada es transaccional; fallos de red, entrega incierta y llamadas directas rechazadas necesitan observabilidad y revisión operativa. No hay promesa de exactamente-un-correo ante una partición de red.
7. Invitaciones revocadas no se reactivan silenciosamente. La recuperación de una cuenta revocada exige un procedimiento administrativo explícito futuro, con revisión/auditoría.
8. Operaciones que requieren nueva aprobación: baseline/SQL remoto, configurar Auth/SMTP o enviar mensajes reales, DNS/casilla, push/protecciones, enlace Git–Vercel y deploy/preview. No hay ninguna ejecutada.

La [secuencia aislada](SPRINT_01_INTEGRATION_RUNBOOK.md) define las pruebas de aceptación por rol, suspensión, invitaciones, documentación y concurrencia; el [runbook de baseline](SUPABASE_BASELINE_RUNBOOK.md) distingue metadata de migración SQL y ahora advierte que el HEAD contiene dos correcciones pendientes.

## 11. Rollback y siguiente sprint

Local: conservar los commits y usar revert revisado en la rama para retirar cambios, sin reset --hard ni borrar trabajo/respaldos. No hay cambios remotos de este sprint que revertir.

Tras una aplicación futura: mantener el sitio/registro cerrado y preferir corrección hacia delante. Revertir solo el frontend puede romper registro/callback; revertir solo el historial no deshace SQL. Una compensación de políticas/funciones/trigger requiere aprobación, snapshot de ACL/DDL y compatibilidad con la app. No borrar columnas/tablas privadas ni auditorías con datos para “volver atrás”; preservar estados y sesiones restringidas hasta reparar. Probar restore antes de publicar.

**¿Listos para Sprint 02?** Sí para desarrollo/preparación local aislada según [SPRINT_02_IMPLEMENTATION_PLAN.md](SPRINT_02_IMPLEMENTATION_PLAN.md). **No** para incorporar técnicos reales, dar por aceptado Sprint 01 o abrir operación comercial: primero se necesita una instancia aislada autorizada y las pruebas reales satisfactorias. La decisión actual del propietario mantiene ese gate bloqueado.
