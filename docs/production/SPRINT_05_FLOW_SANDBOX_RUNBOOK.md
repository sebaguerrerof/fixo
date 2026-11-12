# Flow Sandbox — runbook operativo (Sprint 05)

Estado: **nada habilitado**. Flow, la creación de cobros y la recepción de notificaciones están apagados por defecto. Este runbook describe cómo operar el modelo cuando el propietario autorice un destino aislado. Producción, push, deploy, cobros reales y migraciones remotas quedan fuera de alcance. Existen **tres** migraciones de pagos, en este orden: 1) `20261110140000_flow_sandbox_payments.sql`, 2) `20261111120000_payment_rate_limits.sql`, 3) `20261111130000_payment_sensitive_retention.sql` (RPC de purga; sin ella no hay retención de tokens). **Ninguna se ha aplicado en una base remota.**

## 0. Preflight (antes de habilitar nada)

En el destino aislado, con una conexión de administración, **todas** deben devolver `true`:

```sql
select to_regprocedure('public.payment_prepare(uuid,uuid,integer,boolean,uuid)') is not null as base_migration,
       to_regclass('private.payment_rate_limits') is not null                                 as rate_limits_migration,
       to_regprocedure('public.payment_purge_sensitive(integer)') is not null                 as retention_migration,
       has_function_privilege('service_role','public.payment_purge_sensitive(integer)','EXECUTE')
         and not has_function_privilege('authenticated','public.payment_purge_sensitive(integer)','EXECUTE') as retention_privileges,
       exists(select 1 from pg_trigger where tgname='a_job_cancellation_payment_review')      as cancellation_review_trigger;
```

Después, una pasada del worker (`POST /api/payments/worker`, aun con las notificaciones apagadas) debe responder con `"housekeepingFailures":0`; un valor mayor indica una RPC ausente o un fallo de la base y **no** debe ignorarse (el worker no se detiene por ello).

## 1. Interruptores (todos apagados por defecto)

| Variable | Efecto | Valor habilitado |
| --- | --- | --- |
| `FIXO_FLOW_MODE` | Sólo elige el entorno (`disabled` \| `sandbox`). Por sí sola no habilita nada. | `sandbox` |
| `FIXO_PAYMENTS_CREATION_ENABLED` | Permite **nuevos** cobros (`startPayment`). | literal `true` |
| `FIXO_PAYMENTS_NOTIFICATIONS_ENABLED` | Permite recibir/verificar notificaciones y que corra el worker. | literal `true` |

Cualquier otro valor equivale a apagado. Con la creación apagada la acción responde "Los pagos no están disponibles por ahora" y la UI nunca presenta algo parecido a un pago.

**Reversión** (PLAN §11): 1) apagar `FIXO_PAYMENTS_CREATION_ENABLED`; 2) **mantener** `FIXO_PAYMENTS_NOTIFICATIONS_ENABLED=true` y el worker hasta resolver todos los pendientes (intentos `pending`, `creating`, `reconciliation_required`, bandeja `pending`/`processing`/`quarantined`); 3) sólo entonces apagar la recepción. No borrar eventos, no cambiar `paid` a `disabled`, no hacer rollback destructivo del modelo financiero. Para corregir se añade una migración hacia adelante.

## 2. Variables de entorno (sólo servidor, vía secret manager)

| Variable | Notas |
| --- | --- |
| `FLOW_API_KEY`, `FLOW_SECRET_KEY` | Credenciales **Sandbox**. Nunca `NEXT_PUBLIC_*`, nunca en Git ni en logs. API fija `https://sandbox.flow.cl/api`; no se aceptan otros destinos. |
| `FIXO_FLOW_CALLBACK_ORIGIN` | Origen HTTPS sin ruta (se rechaza http, ruta, query, credenciales). Flow llamará a `…/api/payments/flow/confirmation`; el retorno a `…/api/payments/flow/return`. |
| `FIXO_PAYMENTS_SUPABASE_ORIGIN` | Debe coincidir exactamente con `NEXT_PUBLIC_SUPABASE_URL`: protege contra mezcla de entornos (el worker y la creación fallan antes de cualquier efecto si no coincide). |
| `FIXO_PAYMENT_TOKEN_KEY_ID`, `FIXO_PAYMENT_TOKEN_KEY` | AES-256-GCM, 32 bytes en base64. Cifra el token de checkout y de callback en reposo (el AAD es el hash del token). |
| `FIXO_PAYMENTS_WORKER_SECRET` | ≥ 32 caracteres aleatorios; Bearer de `POST /api/payments/worker`. Sin él, o más corto, responde 401. |
| `FIXO_TRUSTED_IP_HEADER` | Cabecera que el proxy sobrescribe (p. ej. `x-vercel-forwarded-for`). Sin ella todos los callbacks comparten el cubo `ip:unknown` (120/min) y podrían limitar a Flow legítimo. Nunca se confía en `X-Forwarded-For`. |

### Rotación
- **API/secret de Flow:** crear el par nuevo en Sandbox, actualizar el secret manager, reiniciar/redesplegar, comprobar con una pasada del worker (§4) y revocar el anterior. Mientras tanto no crear cobros nuevos.
- **Clave de tokens:** el ciphertext guarda `key_id`. Para rotar, introducir un `FIXO_PAYMENT_TOKEN_KEY_ID` nuevo; **la implementación actual lee una sola clave**, por lo que rotar mientras hay bandeja/intentos con tokens cifrados con la clave anterior los dejaría indescifrables (el worker los pondría en cuarentena `token_undecryptable`). Rotar sólo con la bandeja vacía y sin intentos `pending`, o con autorización para extender el código a varias claves. **Pendiente conocido.**
- **`FIXO_PAYMENTS_WORKER_SECRET`:** actualizar en el secret manager y en el programador a la vez.

## 3. Quién ejecuta el worker (DECISIÓN DEL PROPIETARIO PENDIENTE, PLAN §4)

El procesamiento es `runPaymentWorkerBatch` (lote acotado de 20 por fase). Está expuesto como `POST /api/payments/worker` con Bearer. Opciones:
- **A. Programador externo (Vercel Cron u otro) que invoque la ruta.** No existe `vercel.json` ni cron: no se añadió nada. Requiere que la ruta sea alcanzable y el secreto en el programador.
- **B. Runner `.mjs` supervisado** como `scripts/notification-worker.mjs` (host independiente de Vercel). No existe aún.

Hasta decidir, el worker no corre. Un pago aprobado en Flow **no se reflejará en Fixo** mientras no corra el worker o la conciliación: la verificación autenticada es la única que acredita el pago.

Frecuencia sugerida (no implementada como configuración): cada 30–60 s con trabajo; la propia BD aplica backoff.

## 4. Qué hace una pasada

`POST /api/payments/worker` con `Authorization: Bearer $FIXO_PAYMENTS_WORKER_SECRET` devuelve sólo contadores (nunca datos de proveedor ni PII); error → 503 sanitizado.
1. **Bandeja** (`payment_inbox_claim`): descifra el token del callback, consulta a Flow con firma (`getStatus`) y aplica el hecho verificado. El callback sólo decide qué consultar. Lease 2 min, fencing por token.
2. **Conciliación sin callback** (`payment_attempt_claim_due`): consulta por `flowOrder` o, si no hay identidad persistida, por referencia de comercio. **Nunca recrea una orden.**
3. Limpieza de límites de frecuencia.

Backoff (en BD): bandeja `min(3600, 30·2^min(intentos,7))` s; conciliación 30 s–1 h; pendiente 30–900 s; creación ambigua primer chequeo a 1–2 min; pago sin coste Flow reconsulta a 10 min. Tras 8 intentos de bandeja → cuarentena `retry_exhausted`.

## 5. Monitoreo y alertas (propuestas; sin métricas implementadas)

Fuente: `public.payment_admin_overview()` (superadmin/moderador, también visible en `/admin/configuracion`). Vigilar, sin PII:
- Antigüedad del pendiente más viejo de bandeja (> 5 min con worker activo = alerta) y filas `processing` con lease vencido.
- Intentos `creating`/`reconciliation_required` > 10 min.
- **Cuarentena** (`quarantined_inbox`, órdenes en `payment_review`): toda fila requiere atención humana.
- Pagos con coste Flow pendiente de conciliación; coste Flow > comisión F (margen negativo explícito).
- Respuestas 429/503 en `/api/payments/flow/confirmation`.
No hay alertas automáticas configuradas ni responsable asignado: **pendiente del propietario**.

## 6. Cuarentena y revisión

| Situación | Estado | Acción |
| --- | --- | --- |
| Identidad desconocida / token falso | bandeja `quarantined_unknown_identity` | No hay efecto financiero. Investigar origen; no reprocesar a mano. |
| Monto/moneda/cuenta/referencia distintos | intento `quarantined`, `provider_mismatch`; trabajo `payment_review` | Un humano decide. Nunca queda `paid` ni habilita ejecución. |
| Pago tardío o duplicado | evento `late_payment` / `duplicate_payment` | Conserva evidencia; **no reactiva** el trabajo ni devuelve dinero automáticamente. |
| Trabajo cancelado con pago o con intento aún pagable | orden `job_cancelled` en revisión; el pago verificado sigue `paid`; trabajo `payment_review` | Se marca en la misma transacción que la cancelación (disparador `a_job_cancellation_payment_review`), con un evento interno y un aviso por participante, sin duplicados. Visible en el resumen admin. Sin reembolso ni liberación automáticos: lo resuelve un humano. |
| Pago observado después de la cancelación | `late_payment`, revisión | Igual: se conserva la evidencia y no se reactiva el trabajo. |
Un superadmin puede pedir "Reconsultar coste Flow" (`payment_request_reconciliation`): sólo programa la consulta; no altera el pago.

### Retención de material sensible
`public.payment_purge_sensitive(retention_days)` (sólo service_role; el worker la llama en cada pasada con **30 días**, `SENSITIVE_RETENTION_DAYS`) elimina únicamente el **material cifrado** (token de checkout y de callback y su `key_id`) de registros resueltos: intentos `paid`/`failed`/`cancelled` y filas de bandeja `done` con todas las generaciones procesadas, ambos sin actividad durante el plazo. Se conservan hashes, identidades Flow, referencias, montos y eventos. **Nunca** se purgan intentos `prepared`/`creating`/`pending`/`reconciliation_required` (el cliente aún puede reabrir el checkout), ni filas de bandeja pendientes, en proceso o en cuarentena. Un reenvío posterior del mismo token restablece su material. La purga corre en **cada pasada del worker aunque `FIXO_PAYMENTS_NOTIFICATIONS_ENABLED` esté apagado** (estado de reversión): sólo exige destino válido y credenciales de servidor, no Flow ni la clave de tokens. Si la RPC no existe, la respuesta del worker informa `housekeepingFailures>0`. Esto también reduce el impacto de rotar la clave de tokens (§2): sólo el material no resuelto depende de la clave anterior.

## 7. Porcentaje de comisión

`payment_pricing_policies` es append-only (trigger `payment_policy_append_only`): un cambio es siempre una versión nueva (superadmin, 0–20 %, motivo, versión esperada). Cada orden congela la versión; los cambios no son retroactivos y un consentimiento de otro desglose no reutiliza una orden congelada. Inicial: 5 % (500 pb).

## 8. Habilitar un trabajo en Sandbox

`payment_enable_sandbox_job(job, window_hours, reason)` (superadmin) abre una ventana acotada en la que el trabajo exige pago inicial verificado para iniciar y los importes aceptados pagados para cerrar. Sin ella la compuerta está deshabilitada aunque haya pagos.

## 9. Procedimiento de pruebas Sandbox (cuando se autorice)

Prerrequisitos: proyecto Supabase **aislado y autorizado**, las tres migraciones aplicadas por el propietario en orden (§0 Preflight), credenciales Sandbox, origen HTTPS alcanzable por Flow, cuentas sintéticas. Pasos mínimos, registrando para cada uno evidencia sanitizada (estados e identificadores truncados, nunca tokens ni PII):
1. Pago inicial aprobado; con callback y **sin** callback (sólo conciliación).
2. Pendiente, rechazado y anulado.
3. Callback antes y después del retorno; retorno sin sesión y actualización posterior.
4. Token falso/desconocido, repetición, cambio de estado para el mismo token.
5. Pérdida de respuesta y caída del worker (reinicio y recuperación por referencia).
6. Pago tardío y posible duplicado.
7. Adicional aceptado: saldo pendiente visible antes del cierre y pago posterior.
Casos adversos que Sandbox no permita provocar se prueban con integración controlada y se declaran como tales (no acreditan escenarios reales).

## 10. Limpieza de fixtures

Sólo por manifiesto exacto de IDs creados por la prueba (usuarios `s05-*@local.invalid` o los designados). No borrar por prefijo general. Las órdenes/eventos financieros **no se borran** en una base con datos reales; en bases aisladas descartables se prefiere recrear el proyecto/`db reset` local. Antes de eliminar un destino aislado, exportar la evidencia sanitizada.

## 11. Pruebas locales de referencia

| Comando | Qué cubre |
| --- | --- |
| `npm run db:test` | pgTAP (incluye `06_flow_payments`, 94 aserciones; 254 en total). |
| `node scripts/test-payments-postgres.mjs` | 66 checks en PostgreSQL embebido (concurrencia, leases, restauración). |
| `npm run test` | Vitest (integración PostgREST local con variables `FIXO_PAYMENTS_LOCAL_SUPABASE=isolated-local`, `FIXO_TEST_*`). |
| `node scripts/test-payments-browser.mjs` | Navegador por rol, sólo local; deja una versión nueva de política → ejecutar `supabase db reset` después. |
