# Fixo — Sprint 01: usuarios, autenticación y permisos

Fecha: 8 de noviembre de 2026. **Plan preparado; módulo completo no implementado en Sprint 00.5.**

Base: `SPRINT_00_AUDIT.md`, cambios locales de 00.5 y `SUPABASE_BASELINE_RUNBOOK.md`. Mantener Next.js 15, React 19, Supabase y los cuatro roles existentes.

## Condiciones de entrada

Se puede preparar/desarrollar Sprint 01 en una rama aislada. Antes de acreditar integración real o aplicar cambios remotos: Docker/local Supabase funcional, 27 pruebas pgTAP verdes, revisión de la migración correctiva, baseline reconciliado y staging separado autorizado. No crear usuarios de prueba en el proyecto comercial. Ninguna rama, preview ni migración se publica automáticamente.

## Matriz RBAC propuesta

La base ejecutable está en `src/domain/auth/permissions.ts`. Es una fundación de permisos; **no sustituye controles DB ni implementa invitaciones/administración todavía**. El rol siempre procede de `profiles` con usuario verificado en servidor, nunca de cookies demo, formulario o user_metadata.

| Operación | customer | technician | moderator | superadmin |
| --- | --- | --- | --- | --- |
| Leer/editar campos permitidos del perfil propio | Sí | Sí | Sí | Sí |
| Registrar solicitud propia | Sí | No | No | No |
| Leer documentos propios de verificación | No | Sí | Como administrador | Como administrador |
| Revisar técnicos/documentos y registrar motivos | No | No | Sí | Sí |
| Invitar técnicos/clientes operativos | No | No | Sí, sin privilegios administrativos | Sí |
| Suspender/activar customer o technician | No | No | Sí, sin afectar administradores | Sí |
| Cambiar roles privilegiados/invitar administradores | No | No | No | Sí |
| Gestionar cuentas moderator/superadmin | No | No | No | Sí, con protección del último superadmin |
| Auditoría administrativa | No | No | Lectura operativa autorizada | Lectura completa autorizada |

Todas las filas sensibles necesitan autorización por acción/RPC y RLS. La asignación de técnico a una cuenta y su aprobación profesional son decisiones distintas. Un técnico invitado comienza pendiente; nunca se publica por el solo hecho de haber sido invitado.

## Tareas concretas y aceptación

| ID | Tarea | Criterio de aceptación | Dependencias |
| --- | --- | --- | --- |
| U01 | Entorno Auth aislado y configuración | Site URL, redirect allowlist, SMTP de captura y JWT expiry documentados/probados; nunca usuarios de prueba productivos. | Cerrar gate local DB; staging autorizado. |
| U02 | Estado global de cuenta | Migración aditiva con account_status active/suspended/blocked, timestamps/actor/motivo e historial. Backfill preserva roles/datos; valores no editables por usuarios. | Baseline y hardening revisados. |
| U03 | Registro customer/technician robusto | Alta crea solo esos roles; metadata arbitraria/JSON inválido/enteros enormes no elevan rol ni producen fallos incontrolados; postulación pending; respuestas no enumerables. | U01; trigger auditado. |
| U04 | Confirmación de correo PKCE | Callback intercambia code una vez en servidor, verifica redirect interno permitido, actualiza cookies, rechaza errores/expirados y no acepta open redirect. | U01, configuración SSR existente. |
| U05 | Recuperación de contraseña | Respuesta equivalente con correo existente/inexistente; entrega por captura; callback/session recovery protegido; nueva contraseña validada y expiración/reuso de enlaces probados. | U01/U04; SMTP. |
| U06 | Login/logout/sesiones y estado global | Middleware/layouts/actions/RLS rechazan suspended/blocked, incluso con JWT anterior según política definida. Logout/revocación se prueba; no confundir eliminación de usuario con revocación inmediata. | U02/U04. |
| U07 | Edición de perfil | Allowlist de campos propios, validación servidor/DB, sin edición de rol/account_status/revisión por formulario ni REST directo. | U02/U06. |
| U08 | Permisos centralizados | Matriz aplicada en servidor y operaciones SQL; moderator no crea administradores ni altera superadmins; tests directos RPC/REST entre actores. | U02/U06, fundación RBAC 00.5. |
| U09 | Invitaciones seguras | Operación de servidor con actor verificado, rol objetivo limitado, token de invitación para establecer contraseña y evento auditado/idempotente. No devolver tokens/credenciales al cliente administrativo. | U08, SMTP, flujo de completar cuenta. |
| U10 | Administración de roles/estados | Solo superadmin cambia privilegios; restricciones contra retirar/bloquear el último superadmin, transacción con bloqueo y auditoría. Interfaz consume operación autorizada. | U02/U08/U09. |
| U11 | Suite de integración y abuso | Pruebas de abajo verdes contra Auth/Postgres/Storage reales de staging/local; sin service role para acreditar aislamiento. | U01–U10. |

## Esquema mínimo a diseñar

- `profiles.account_status` con default/backfill active y constraint/enum cerrado; sin eliminar roles actuales.
- Historial de eventos de cuenta/rol: actor, usuario objetivo, acción, valores previos/nuevos, motivo, timestamps y correlación/idempotencia. Acceso administrativo, sin modificaciones por cliente.
- Helpers privados de cuenta activa y permisos: extender RLS/guards para consultar estado actual cuando el requisito sea bloqueo inmediato, sin depender solo de claims JWT antiguos.
- RPC de cambios sensibles con validación de actor y objetivo, bloqueo transaccional y protección del último superadmin. Denegar UPDATE directo de campos privilegiados.
- Invitaciones: relación interna con user/actor/rol permitido y estado; no persistir contraseñas ni tokens de invitación en texto plano en tablas públicas. Revisar API Admin vigente y reservar service role exclusivamente al servidor cuando sea realmente necesaria.

No aplicar esta propuesta de esquema antes de definir la semántica de bloqueo, dependencias RLS y pruebas; no se añade una columna anticipada que el despliegue actual no sepa manejar.

## Confirmación, recuperación y URLs

Rutas propuestas para implementar en Sprint 01: `/auth/callback`, `/recuperar-contrasena` y `/auth/update-password`. Hoy no están implementadas: el registro existente sigue redirigiendo a `/login`. El config local prepara allowlists para login y los callbacks futuros, sin afirmar que esos callbacks ya funcionan.

Confirmación: solicitud de alta con redirect autorizado → correo → callback PKCE del servidor → exchangeCodeForSession → perfil/estado verificados → panel según rol. Manejar enlaces abiertos en otro navegador y enlaces OTP si se elige ese contrato con Supabase; no mezclar ambos sin pruebas.

Recuperación: formulario neutro y rate limit → resetPasswordForEmail con destino permitido → correo → sesión de recuperación/callback → actualización validada → política de sesiones/revocación y redirección interna fija. No confirmar entrega al aceptar un envío y no revelar si el email existe.

La configuración remota completa Site URL/redirect allowlist/SMTP no fue accesible mediante los endpoints utilizados en la auditoría. Requiere inspección del dashboard/Management API autorizado antes de probar el flujo. No inferir valores a partir de los ajustes públicos Auth. Para local, HTTP 127.0.0.1/localhost exactos y servidor de captura; para preview, origen de staging controlado; para producción, dominio verificado y callback exacto. Evitar comodines que admitan un origen ajeno.

## SMTP y correo corporativo

Definir remitente transaccional y reply-to para Fixo; verificar dominio, SPF/DKIM/DMARC y límites/condiciones de la cuenta Zoho o proveedor aprobado. No asumir que una casilla corporativa permite un volumen transaccional comercial. Configurar credenciales solo en el gestor del proveedor/Supabase, nunca variables NEXT_PUBLIC ni Git. Distinguir accepted/sent/delivered/bounced; procesar eventos y reintentos sin duplicados. En local, usar captura SMTP sin mensajes externos.

Plantillas mínimas: confirmación, recuperación e invitación; marca Fixo, enlace expirante y destino correcto. Comprobar los tres en móvil y sus errores/expiración. La auditoría detectó protección de contraseñas filtradas desactivada; revisar disponibilidad y habilitación autorizada junto con política de contraseña y rate limits.

## Pruebas de integración requeridas

1. Dos customers, dos technicians y administradores sintéticos creados solo en el entorno aislado.
2. Registro con metadata de superadmin resulta customer; technician queda pending y fuera del directorio.
3. Confirmación válida/expirada/repetida y callback con next externo o code ajeno rechazados.
4. Recuperación de existente/inexistente responde igual; enlace expira y sesión no se usa para otra cuenta.
5. Cada rol accede únicamente a rutas/actions/RPC/filas autorizadas, incluyendo llamadas directas sin UI.
6. Suspender/bloquear con sesión previa: verificar inmediatamente las operaciones sensibles; probar reactivación con auditoría.
7. Moderator no eleva privilegios ni suspende administradores; dos cambios concurrentes no eliminan el último superadmin.
8. Un cliente/técnico no puede leer documentos ajenos; firmado expira en 60 segundos; size/MIME se prueban por Storage API real.
9. Solicitud propia persiste y es visible; overposting de status/asignación es rechazado, errores/reintentos se diagnostican sin duplicaciones silenciosas. La idempotencia comercial completa sigue en Sprint 03.
10. Invitaciones duplicadas/reintentadas conservan una cuenta y trazabilidad; técnico invitado sigue pendiente de aprobación.

Gate de salida: lint/typecheck/tests/build y audit verdes; pruebas reales Auth/RLS de U11, evidencia sin PII/secretos, migraciones/rollback revisados y release en preview identificable por SHA. No declarar PASS con UI o mocks únicamente.

Fuentes: [Auth passwords](https://supabase.com/docs/guides/auth/passwords), [resetPasswordForEmail](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [checklist de producción](https://supabase.com/docs/guides/deployment/going-into-prod).
