# Flow Sandbox — runbook operativo (Sprint 05)

Estado: **cobros no habilitados**. La creación de cobros y la recepción de notificaciones están apagadas (el cron corre sólo en modo mantenimiento). Este runbook describe cómo operar el modelo. El propietario autorizó el 2026-11-12 usar el proyecto Fixo `rjzy…` y `www.soyfixo.cl` (migraciones, push, deploy y cron, con los pagos apagados); **cada fase posterior (pruebas remotas con cuentas sintéticas y su limpieza) exige una aprobación propia**; las cuatro migraciones, el despliegue y el cron fueron aprobados y aplicados el 2026-11-12. Los cobros reales no existen: Flow está fijado a Sandbox. Existen **cuatro** migraciones de pagos, en este orden: 1) `20261110140000_flow_sandbox_payments.sql`, 2) `20261111120000_payment_rate_limits.sql`, 3) `20261111130000_payment_sensitive_retention.sql` (RPC de purga), 4) `20261112090000_payment_sandbox_accounts.sql` (allowlist de cuentas Sandbox; **aplicada en producción**). **Las cuatro están aplicadas en `rjzy…` y no deben editarse: cualquier cambio posterior exige una migración nueva.**

## 0. Preflight (antes de habilitar nada)

En el destino aislado, con una conexión de administración, **todas** deben devolver `true`:

```sql
select to_regprocedure('public.payment_prepare(uuid,uuid,integer,boolean,uuid)') is not null as base_migration,
       to_regclass('private.payment_rate_limits') is not null                                 as rate_limits_migration,
       to_regprocedure('public.payment_purge_sensitive(integer)') is not null                 as retention_migration,
       has_function_privilege('service_role','public.payment_purge_sensitive(integer)','EXECUTE')
         and not has_function_privilege('authenticated','public.payment_purge_sensitive(integer)','EXECUTE') as retention_privileges,
       exists(select 1 from pg_trigger where tgname='a_job_cancellation_payment_review')      as cancellation_review_trigger,
       to_regprocedure('public.payment_sandbox_account_set(uuid,boolean,text)') is not null   as sandbox_allowlist_migration;
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

## 3. Ejecutor del worker: Supabase Cron (decisión del propietario, 2026-11-12)

**Decisión:** `pg_cron` de Supabase (cada minuto) llama con `pg_net` al endpoint protegido `POST /api/payments/worker` de Vercel, que ejecuta el worker existente (`runPaymentWorkerBatch`, lote acotado de 20 por fase). **No** se usa Vercel Cron Hobby y no existe `vercel.json`.

**Disponibilidad:** en el proyecto Fixo (`rjzy…`) `pg_cron 1.6.4` y `pg_net 0.20.4` estaban disponibles sin instalar y `supabase_vault 0.3.1` ya estaba instalada (consulta de catálogo, sólo lectura); **desde la fase B (2026-11-12) `pg_cron` y `pg_net` están instaladas**, los secretos están en Vault y el job está activo. Los límites exactos del plan Free no se pueden consultar por CLI; el intervalo de un minuto es el mínimo de la sintaxis estándar y la carga es de una petición HTTP por minuto.

**Piezas (todo fuera de `supabase/migrations`, porque habilita extensiones y un calendario por entorno):**
- `supabase/ops/payments-worker-cron.sql` (idempotente): extensiones, tabla `private.payment_worker_ticks`, `private.payment_worker_tick()`, `private.payment_worker_health()` (consulta SQL por un administrador de la base) resume los últimos 15 min. Una respuesta es *saludable* sólo si es HTTP 200 **y** sus contadores no informan fallos internos (`failures=0` y `housekeepingFailures=0`; contadores ausentes o ilegibles ⇒ no saludable). Campos: `ok_15m`, `failed_15m` (no-200), `internal_failures_15m` (200 con fallos), `unanswered_15m`, `last_status`, `last_summary`, `last_request_age_seconds`, `last_healthy_age_seconds`, `stale` y `degraded`. `degraded` es verdadero si no hay peticiones en los últimos 3 minutos (cron detenido o nunca ejecutado), si no hubo una ejecución saludable en los últimos 5 minutos, o si alguna de las 5 últimas peticiones fue no saludable (no-200, 200 con fallos internos, timeout o sin respuesta tras 2 minutos).
- **Prueba local:** `node scripts/test-payments-worker-cron.mjs` (pg_cron/pg_net reales del Supabase local contra un servidor HTTP local; 7 checks).

**Activación (ya realizada el 2026-11-12, fases A y B aprobadas por el propietario; el mismo procedimiento sirve para reactivar o replicar en otro entorno y siempre requiere aprobación explícita):** (1) desplegar el código con el endpoint endurecido; (2) crear los dos secretos en Vault; (3) aplicar `payments-worker-cron.sql`; (4) comprobar `private.payment_worker_health()` (`ok_15m ≥ 1`, `degraded=false`). **Nota operativa:** la función está revocada para todos los roles de la API; se ejecuta con el rol propietario (`supabase db query --remote=<ref> --yes "select private.payment_worker_health()::text"`; la variante `--read-only` responde 42501). Con las notificaciones apagadas el tick sólo hace mantenimiento (limpieza de límites y retención). Un pago aprobado en Flow **no se refleja** en Fixo sin el worker: la verificación autenticada es la única que acredita el pago.

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

### Cuentas autorizadas para pagos Sandbox (migración `20261112090000_payment_sandbox_accounts.sql`)
**Requisito descubierto en Sandbox real:** Flow valida que el correo del pagador sea entregable (error 1620). Las cuentas sintéticas (`.invalid`) se envían con la dirección configurada en `FIXO_FLOW_SANDBOX_PAYER_EMAIL`; sin ella no se envía nada. La referencia de comercio no puede superar 45 caracteres (error 1622) y el coste llega como cadena decimal (`"837.00"`).

Los pagos Sandbox sólo existen para **cuentas sintéticas autorizadas**, además de los interruptores globales y de la ventana por trabajo:
- Autoriza/revoca únicamente un **superadmin** con `payment_sandbox_account_set(usuario, habilitar, motivo)`. La fila de `payment_sandbox_accounts` es sólo el **estado vigente** (incluye el motivo de la revocación vigente); cada autorización, reautorización y revocación (que cambie el estado) queda además en `payment_sandbox_account_events`, **inmutable** (PT409 a update/delete), con actor, fecha y motivo. Sólo se acepta una cuenta cuyo correo de Auth termina en `.invalid` (TLD reservado, sin buzón real); un correo enrutable se rechaza (PT409) y una cuenta autorizada cuyo correo deja de ser `.invalid` pierde el acceso.
- **Backend (fuente de verdad):** `payment_prepare` (antes de crear orden), `payment_attempt_begin_create` (antes de cualquier llamada a Flow) y `payment_attempt_checkout` (reapertura) exigen la cuenta autorizada y vigente (42501/PT409). Un cliente real no puede preparar, reservar ni reabrir un pago aunque forje la petición y aunque los interruptores estén encendidos.
- **Frontend (espejo):** `job_payments` devuelve `sandbox_enabled`; quien no está autorizado y no tiene órdenes **no ve el panel de pagos ni el botón** (si ya existe una orden conserva su historial sin botón). Falla cerrado (`!== true` ⇒ no autorizado). `/admin/configuracion` lista las cuentas autorizadas (sólo lectura).
- Sin cuentas autorizadas, los pagos Sandbox no están disponibles para nadie. Los cobros reales no existen: la API de Flow está fijada a Sandbox.

## 9. Protocolo de pruebas Sandbox en el proyecto de producción (con aprobaciones por fase)

Contexto autorizado por el propietario: se usa el proyecto Fixo `rjzy…` y `www.soyfixo.cl`, **sin exponer la función a clientes reales** (allowlist de cuentas `.invalid`), sin cobros reales y sin tocar usuarios existentes. Cada fase remota pide aprobación expresa antes de ejecutarse:

0. **Preflight de sólo lectura** (§0) y estado de usuarios (`auth.users` con sólo los originales).
1. **Aprobación A — migración + despliegue (HECHO 2026-11-12):** aplicada `20261112090000` y desplegado el código (allowlist + endpoint con logs); allowlist verificada vacía.
2. **Aprobación B — cron (HECHO 2026-11-12):** secretos en Vault y `payments-worker-cron.sql` aplicado; salud verificada (§3).
3. **Aprobación C — pruebas remotas (HECHO 2026-11-12; resultados en `SPRINT_05_REPORT.md` §2b):** crear con la Admin API **cuentas sintéticas nuevas** (`s05-flow-<run>-*@sandbox.fixo.invalid`: superadmin, cliente, técnico) y escribir el **manifiesto** (`docs/production/sprint-05-evidence/flow-sandbox-manifest.json`: UUID de usuarios, solicitudes, cotizaciones, trabajos, órdenes, intentos, eventos y objetos, con la hora de cada creación). Autorizar sólo al cliente sintético, habilitar el trabajo con ventana de 2 h y encender **temporalmente** `FIXO_PAYMENTS_CREATION_ENABLED` y `FIXO_PAYMENTS_NOTIFICATIONS_ENABLED` (el allowlist impide que un cliente real vea o use la función). Matriz, registrando evidencia sanitizada (estados e identificadores truncados, nunca tokens ni PII):
   1. Pago inicial aprobado, con callback y **sin** callback (sólo conciliación).
   2. Pendiente, rechazado y anulado.
   3. Callback antes y después del retorno; retorno sin sesión y actualización posterior.
   4. Token falso/desconocido, repetición, cambio de estado para el mismo token.
   5. Pérdida de respuesta y caída del worker (apagar el cron un minuto y reanudar).
   6. Pago tardío y posible duplicado.
   7. Adicional aceptado: saldo pendiente visible antes del cierre y pago posterior.
   8. **Cuarentena en el cierre:** provocar (con integración controlada si Sandbox no permite generarlos) cuatro casos: (a) un token falso fabricado por la prueba y anotado en el manifiesto; (b) una discrepancia (`provider_mismatch`); (c) una **consulta fallida de un pago existente** (la API de Flow responde error para una operación real ⇒ fila `flow_http_error_*`); (d) una **observación válida sin correlación local** (`quarantined_unknown_identity` con una identidad Flow real). Comprobar que los cuatro aparecen en el resumen administrativo y que **ninguno permite cerrar** hasta aclararse: (a) sólo se clasifica «sin obligación» con la evidencia del manifiesto; (b)–(d) exigen acreditar por referencia comercial, identidad Flow o panel Sandbox que ningún intento asociado sigue pagable (o que el pago quedó verificado), y mientras tanto la recepción y el cron siguen activos.
   En cada caso verificar **una sola orden, un solo intento pagado y una sola ejecución del efecto** (sin cobros ni transacciones duplicadas). Los casos que Sandbox no permita provocar se prueban con integración controlada y se declaran como tales.
4. **Cierre, en este orden (PLAN §11; con las notificaciones apagadas el worker sólo hace mantenimiento y **no verifica pagos**):**
   1. Apagar **sólo** `FIXO_PAYMENTS_CREATION_ENABLED` (no se crean cobros nuevos).
   2. **Mantener** `FIXO_PAYMENTS_NOTIFICATIONS_ENABLED=true` y el cron activos hasta cumplir **todas** estas condiciones (la salud del cron correcta **no** las acredita; una cuarentena puede conservar un cobro externo aún pagable):
      - Ningún intento en `creating`/`pending`/`reconciliation_required`; ninguna fila de bandeja `pending`/`processing`; ningún coste Flow pendiente.
      - **Cuarentenas revisadas una a una y por una persona** (evidencia sanitizada en el manifiesto):
        - *Bandeja* (`select quarantine_reason,count(*) from private.payment_inbox where state='quarantined' group by 1`): **ningún motivo permite descartar una cuarentena por sí solo.** Un `quarantined_unknown_identity` puede ser un pago externo real sin correlación local (una observación válida de Flow cuya referencia no conocemos), y un `flow_http_error_*` no demuestra que la operación no exista (Flow documenta errores de API y de negocio en `getStatus`; una consulta fallida de un pago existente queda igual en cuarentena). Antes de clasificar una fila como «sin obligación» hay que aportar **evidencia individual**: la referencia comercial (`commerceOrder`), la identidad Flow (`flowOrder`) o la búsqueda en el panel Sandbox de Flow que demuestre que el token **no** corresponde a ninguna operación (p. ej. un token fabricado por la prueba, anotado en el manifiesto). Con `retry_exhausted`, `token_undecryptable`, `quarantined_mismatch`, `ignored_incomplete`, `ignored_unknown_status`… la exigencia es la misma y además hay que acreditar que el intento asociado quedó resuelto (por conciliación por referencia, no por el token). Sin evidencia, la fila cuenta como «pago posible sin aclarar» y **bloquea el cierre**.
        - *Intentos en `quarantined` y órdenes con `review_reason`* (resumen administrativo, «Discrepancias y revisiones»): para cada uno, acreditar que **ningún intento asociado sigue pagable** (estado final en Flow Sandbox y en `payment_attempts`) y registrar la decisión humana; un `provider_mismatch`, `duplicate_payment` o `late_payment` no se resuelve solo.
      - **Órdenes externas de diagnóstico** (`externalOrders` del manifiesto): cada una debe reconciliarse (`reconcile-external.mjs external <commerceOrder>`) con HTTP, estructura e identidad validadas y quedar en un estado final no pagable (`rejected`/`cancelled`) o ser resuelta por una persona; `pending`, `paid`, `unknown` y toda consulta fallida son asuntos **abiertos** (`reconcile-external.mjs issues`) y bloquean el cierre. `diagnose-create.mjs` sólo acepta la dirección configurada o una `.invalid` y clasifica como `ambiguous` (no `refused`) todo lo que no sea un rechazo 400/401 documentado.
      - Resultado: lista de cuarentenas con su clasificación («sin obligación, con evidencia» / «revisada: sin pago pendiente» / «pago verificado»). Si alguna no se puede clasificar, **el cierre no procede** y los interruptores de recepción y el cron siguen activos.
   3. Sólo entonces apagar `FIXO_PAYMENTS_NOTIFICATIONS_ENABLED`, desactivar el cron (`payments-worker-cron-rollback.sql`), revocar las autorizaciones Sandbox y limpiar (§10).

## 10. Limpieza de fixtures por manifiesto (ejecutada por la opción 1 el 2026-11-12)

Sólo por manifiesto exacto de IDs (nada por prefijo ni por patrón de correo). Hay una tensión de diseño que debe decidir el propietario antes de la fase C: **los eventos, intentos y órdenes financieros son append-only a propósito** (triggers `PT409` de no-borrado), de modo que una limpieza total en la base de producción requiere deshabilitar esos triggers dentro de una transacción, acotada al manifiesto, con respaldo previo de las filas.
- **Opción 1 (EJECUTADA):** *retención etiquetada.* `scripts/flow-sandbox/retain.mjs` suspende los perfiles sintéticos, veta sus usuarios de Auth, elimina sus sesiones y saca al técnico sintético del directorio público (un técnico `verified`/`active` es público: hay que apartarlo **siempre** al terminar). Verifica 0 técnicos públicos, 0 perfiles sintéticos activos, 3 vetados, 0 sesiones y 0 autorizaciones Sandbox. Se conservan órdenes, intentos y eventos sintéticos (marcados por el manifiesto), se revoca la autorización, se suspenden las cuentas sintéticas y se retiran blobs/sesiones. Cero riesgo para la integridad financiera; deja filas sintéticas identificables.
- **Opción 2:** *purga transaccional por manifiesto* (`session_replication_role=replica` o `ALTER TABLE … DISABLE TRIGGER` dentro de una transacción, borrando sólo los UUID del manifiesto en orden inverso de dependencias, con exportación previa y verificación de cero residuos y del estado de los usuarios originales). Es una operación destructiva sobre producción: requiere aprobación separada y se ensaya primero en local contra la misma base de datos del harness.
Los usuarios originales no se modifican en ningún caso.

## 11. Pruebas locales de referencia

| Comando | Qué cubre |
| --- | --- |
| `npm run db:test` | pgTAP (incluye `06_flow_payments`, 134 aserciones; 294 en total). |
| `node scripts/test-payments-postgres.mjs` | 75 checks en PostgreSQL embebido (concurrencia, leases, allowlist, retención, restauración). |
| `node scripts/test-payments-worker-cron.mjs` | Ejecutor Supabase Cron contra pg_cron/pg_net locales (7 checks, incl. HTTP 200 con fallos internos y ausencia prolongada de ticks; exige `FIXO_PAYMENTS_LOCAL_SUPABASE=isolated-local` y `FIXO_TEST_DB_URL`). |
| `npm run test` | Vitest (integración PostgREST local con variables `FIXO_PAYMENTS_LOCAL_SUPABASE=isolated-local`, `FIXO_TEST_*`). |
| `node scripts/test-payments-browser.mjs` | Navegador por rol, sólo local; deja una versión nueva de política → ejecutar `supabase db reset` después. |

## 11b. Retención ≠ cierre financiero

`retain.mjs` deja las cuentas sintéticas inertes y registra `retainedAt`, pero **no cierra**: el estado del manifiesto es `retained-closure-pending` mientras exista algún asunto externo abierto (orden externa pendiente, pagada fuera de Fixo, desconocida, ambigua o sin conciliar). Sólo `reconcile-external.mjs close` puede dejarlo en `closed-retained`, y únicamente si no queda ninguno. Los estados de Flow se interpretan de forma estricta: sólo enteros canónicos o cadenas decimales planas (`3`, `"3"`); arrays, booleanos, notación exponencial, hexadecimales, signos y ceros a la izquierda dejan la conciliación en `unknown` y **abierta**.

La corrección única del coste (`recost.mjs`) es durable e idempotente: escribe en el manifiesto (`costCorrectionLog`) una intención con el valor anterior y el nuevo **antes** de cada `UPDATE`, confirma con `RETURNING`, recupera una interrupción (si la base ya tiene el valor nuevo cierra la intención como `applied/recovered`, conservando el valor anterior) y registra como `conflict` cualquier cambio ajeno sin sobrescribirlo.

## 12. Coste Flow G (decisión del propietario, 2026-11-12)

G = `fee` + `taxes` que informa Flow (equivale a monto − `balance`). Se acepta sólo si ambos son enteros (Flow envía `fee` como cadena decimal, p. ej. `"837.00"`) y, si viene `balance`, monto − `balance` = fee + impuestos; en otro caso el coste queda desconocido («pendiente de conciliación»). Ejemplo real de Sandbox: monto 26.250, fee 837, impuestos 159, saldo 25.254 ⇒ G = 996.
