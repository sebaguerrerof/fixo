# Sprint 05 — Flow Chile Sandbox: reporte de entrega

**Fecha de corte: 2026-11-12 (actualizado tras las fases A, B y C).** **Estado global: implementación y pruebas locales completas; matriz Flow Sandbox REAL ejecutada (fase C) con resultados PASS y lagunas declaradas (§2b).** La limpieza de los datos sintéticos (fase D) sigue pendiente de decisión del propietario, por lo que el sprint aún no se declara cerrado. Las únicas operaciones remotas realizadas están listadas en «Estado operativo» y ninguna toca Flow ni habilita cobros.

## 0. Estado operativo (corte 2026-11-12)

| Elemento | Estado | Detalle |
| --- | --- | --- |
| Migraciones `20261110140000`, `20261111120000`, `20261111130000` | **APLICADAS en producción** (proyecto Fixo `rjzy…`) | Por decisión expresa del propietario; preflight de sólo lectura previo (2 usuarios originales, sin datos comerciales), `db push` y verificación posterior. Pagos habilitables sólo con interruptores. |
| Migración `20261112090000_payment_sandbox_accounts.sql` (allowlist de cuentas Sandbox + historial) | **APLICADA en producción** (fase A, aprobada por el propietario) | Verificada: RPC con execute sólo para `authenticated`, tablas con RLS, trigger de historial, **0 cuentas autorizadas** (nadie puede pagar), 2 usuarios intactos. Las cuatro migraciones de pagos están aplicadas. |
| Push | **Hecho** hasta el commit del reporte de esta fase en la rama `codex/sprint-04-job-management` | Sin force; `main` intacto. |
| Deploy a `www.soyfixo.cl` | **Hecho** (fase A) con el código completo (allowlist, endpoint con logs, cron preparado) | Variables de Flow y de pagos en Vercel con ambos interruptores en `false`. Smoke de sólo lectura PASS: `/`, `/login`, rutas protegidas 307, worker sin credencial 401, con credencial 200 `housekeepingFailures:0`, callback 503 (recepción apagada). |
| Interruptores de pagos | **Apagados** (`FIXO_PAYMENTS_CREATION_ENABLED=false`, `FIXO_PAYMENTS_NOTIFICATIONS_ENABLED=false`) | Cobros reales: inexistentes (API fijada a Sandbox). |
| Ejecutor del worker | **Supabase Cron ACTIVO** (fase B, aprobada) | `pg_cron` y `pg_net` instalados; secretos `fixo_payments_worker_url/secret` en Vault; job `fixo-payments-worker` (`* * * * *`). Primeros ticks reales: `scheduled=true`, 3 de 3 saludables, `degraded=false`, resumen con todos los contadores en 0. Con las notificaciones apagadas sólo hace mantenimiento (limpieza y retención): **no verifica pagos hasta encender `FIXO_PAYMENTS_NOTIFICATIONS_ENABLED`**. |
| Pruebas Flow Sandbox | **EJECUTADAS (fase C, 2026-11-12)** | Cuentas sintéticas `.invalid`, 7 trabajos, 8 órdenes pagadas; evidencia sanitizada en `docs/production/sprint-05-evidence/flow-sandbox-manifest.json`. Ventana cerrada: creación y recepción de pagos apagadas, autorización Sandbox revocada. **Fase D (limpieza) pendiente de decisión.** |

Leyenda: **PASS local** = ejecutado hoy en base/servicios locales aislados; **PASS integración/Sandbox** = contra Flow real (ninguno); **FAIL**; **NOT TESTED**. Las cifras del Sprint 04 no se reutilizan.

## 1. Qué se entregó

- **Modelo financiero** (migraciones `20261110140000_flow_sandbox_payments.sql`, `20261111120000_payment_rate_limits.sql` y `20261111130000_payment_sensitive_retention.sql`, **aplicadas en producción** el 2026-11-12 junto con la cuarta, `20261112090000_payment_sandbox_accounts.sql` (allowlist de cuentas Sandbox e historial inmutable; también **aplicada**; las cuatro son ya historial inmutable de producción): siete tablas privadas (seis del PLAN §5 + `payment_rate_limits`, desviación aprobada por el propietario), RLS sin privilegios directos, RPC de usuario y de worker, triggers de inmutabilidad (términos de orden, eventos, historial de política), proyección `payment_state`, compuerta de ejecución.
- **Reglas**: F = round-half-up(Q·bp/10000), T = Q + F, Q intacto, coste Flow absorbido dentro de F; política 5 % inicial, versionada, congelada por orden; consentimiento atado al desglose y versión exactos; sólo la consulta autenticada al proveedor acredita pago.
- **Proveedor y creación**: firma, configuración Sandbox con API fija, intento durable previo, creación ambigua resuelta por consulta (sin recreate), checkout cifrado.
- **Confirmación y conciliación**: rutas `confirmation`/`return`, bandeja durable con leases y fencing, worker (`POST /api/payments/worker`), cuarentena, limitador persistente, plazo total de 10 s en el callback.
- **UI por rol**: panel de pagos del cliente, adicionales (propuesta técnico / respuesta cliente), `/tecnico/pagos` con sólo Q, `/admin/configuracion` (moderador sólo lectura, superadmin edita porcentaje y reconsulta), insignias en lista.
- **Operación**: [runbook](SPRINT_05_FLOW_SANDBOX_RUNBOOK.md), `.env.example`, allowlist de avisos de pago.
- **Interruptores**: `FIXO_FLOW_MODE`, `FIXO_PAYMENTS_CREATION_ENABLED`, `FIXO_PAYMENTS_NOTIFICATIONS_ENABLED`; los dos de pagos apagados.
- **Aplicado en producción (2026-11-12, fases A y B)**: ejecutor Supabase Cron (`supabase/ops/`, job activo), allowlist de cuentas Sandbox con historial inmutable (cuarta migración; sin cuentas autorizadas) y endpoint del worker con logs estructurados. Interruptores de pagos apagados.

## 2. Resultados de pruebas

| Área | Resultado | Evidencia |
| --- | --- | --- |
| pgTAP (`npm run db:test`, CLI 3.1.0) | **PASS local** 7 archivos / 294 tests (134 en `06_flow_payments`, incl. cancelación, retención y allowlist de cuentas Sandbox) | 2026-11-12 |
| Suite PostgreSQL embebida `scripts/test-payments-postgres.mjs` | **PASS local** 76 checks (concurrencia, leases, cancelación por RPC reales, carreras con dos conexiones, allowlist y su carrera, retención, restauración financiera) | 2026-11-12 |
| Ejecutor Supabase Cron `scripts/test-payments-worker-cron.mjs` | **PASS local** 7 checks con pg_cron/pg_net reales (incl. 200 con fallos internos y cron detenido) y servidor HTTP local. **Activo en producción desde la fase B** (primeros ticks reales sanos, ver §0) | 2026-11-12 |
| Vitest | **PASS local** 52 archivos; 351 PASS y 8 omitidos (la integración PostgREST local, que se ejecutó aparte con el Supabase local: 27/27 en `src/repositories`) | 2026-11-12 |
| Integración PostgREST/JWT local (Supabase local) | **PASS local** (callback→bandeja→worker→`paid`, mismatch, desconocida, RPC admin) | `supabase-payment-repository.local.test.ts` |
| Navegador por rol | **PASS local** 11/11 (incluye cuenta Sandbox no autorizada; corridas previas fallaron por defectos del script o poca memoria) | `docs/production/sprint-05-evidence/browser-local.json` (de la corrida de 10 checks; no regenerado) |
| `tsc --noEmit`, `eslint .`, `secrets:check` (547 archivos) | **PASS local** | |
| Pruebas de que las pgTAP muerden | **PASS local** (mutaciones temporales fallan los tests esperados) | HANDOFF |
| `npm run build`, `npm run test:smoke`, `npm audit`, `npm audit --omit=dev` | **PASS local** (2026-11-12): build OK; smoke de producción PASS; 0 vulnerabilidades en ambos audits | |
| GitHub Actions / CI remoto | **NOT TESTED** (la rama se publicó, pero no se consultó el resultado de ninguna ejecución) | |
| Restauración del modelo financiero en una segunda base aislada (PLAN §10) | **PASS local**: exporta datos financieros representativos (pago inicial, adicional, revisión, coste Flow, varias versiones de política, bandeja), restaura en una base nueva desde las migraciones y compara importes, referencias, estados, huellas de ciphertext, invariantes (T=Q+F, tasa congelada, pago↔evento exacto), RLS, grants, `search_path`, disparadores, inmutabilidad y lecturas por rol | `scripts/lib/payment-restore-checks.mjs`. **Límite:** Auth/Storage administrados y Supabase real no se restauran |
| Flow Sandbox real (matriz del runbook §9) | **PASS integración/Sandbox parcial** — ver §2b | Pagos aprobados/rechazados/pendientes, callbacks duplicados y falsos, conciliación sin callback, worker caído, pago tardío y adicional, contra `sandbox.flow.cl` real. **Anulado (status 4), pago duplicado externo, pérdida de respuesta de creación y tres de los cuatro casos de cuarentena: NOT TESTED** |

Los casos adversos (callback falso, mismatch, tardío, duplicado, replay, concurrencia) están cubiertos **con dobles de proveedor/SQL controlado**: no acreditan comportamiento real de Flow.

## 2b. Matriz Flow Sandbox real (fase C) — resultados

Entorno: `sandbox.flow.cl` real, `www.soyfixo.cl` y proyecto Fixo de producción, sólo con cuentas sintéticas autorizadas (allowlist). Navegador Chrome headless conduciendo el «Simulador de Pagos» de Flow (opciones: pagar / rechazar). Evidencia por escenario en el manifiesto (estados, identificadores truncados y contadores; sin tokens ni PII).

| # | Escenario | Resultado | Evidencia clave |
| --- | --- | --- | --- |
| 1 | Pago aprobado con callback | **PASS** | intento `paid`, 1 evento `applied` por T=26.250, bandeja `done`, trabajo `paid`, coste Flow completado |
| 2 | Pendiente (checkout abierto y reabierto) | **PASS** | un solo intento y una sola orden Flow; la conciliación del worker registra `pending` sin acreditar |
| 3 | Rechazado + reintento | **PASS** | intento 1 `failed` (status 3), orden aún pagable; intento 2 `paid`: 1 orden, 1 intento pagado |
| 4 | Callbacks duplicados, token falso, cuerpo inválido, GET; cambio de estado del mismo token | **PASS** | 3 reenvíos reales (generación de bandeja 1→7), sin eventos ni avisos nuevos; `pending`→`paid` con el mismo token se acredita una sola vez; token falso ⇒ 200 y cuarentena `flow_http_error_400`; cuerpo inválido 400; GET 405 |
| 5 | Notificación perdida (worker pausado, fila borrada por hash exacto) | **PASS** | sin notificación el pago no consta; al reanudar el cron el worker concilia por referencia y acredita (1 evento, coste 837) |
| 6 | Worker caído mientras se paga | **PASS** | con el cron detenido la orden sigue `awaiting_payment` y la notificación queda pendiente; tras reanudar se procesa una sola vez |
| 7 | Pago tardío tras cancelación | **PASS** | orden `paid` con revisión `job_cancelled`; trabajo sigue `cancelled`; eventos `job_cancelled` + `late_payment` |
| 8 | Adicional: aceptación, saldo visible, pago | **PASS** | `unpaid_extras` verdadero antes del pago y falso después; 2 órdenes pagadas, 2 intentos pagados |
| 9 | Retorno sin sesión | **PASS** | `POST /api/payments/flow/return` ⇒ 303 a `/cliente/trabajos`, sin eco del token; GET 405 |
| 10 | Cuarentena en el cierre (token fabricado) | **PASS parcial** | (a) token falso clasificado «sin obligación, con evidencia»; (b) `provider_mismatch`, (c) consulta fallida de un pago existente, (d) observación válida sin correlación: **NOT TESTED** en Sandbox real (cubiertos sólo con dobles/SQL local) |
| — | Pago **anulado** (status 4) | **NOT TESTED** | el simulador de Flow sólo ofrece pagar o rechazar |
| — | Pago duplicado externo; pérdida de la respuesta de creación; callback antes/después del retorno (orden exacto) | **NOT TESTED** | requieren inyección de fallos o temporización que Sandbox no permite |

**Defectos encontrados sólo por la prueba real (no por las pruebas locales con dobles):**
1. **Referencia de comercio de 49 caracteres** (`fixo-sandbox-<uuid>`): Flow admite 45 (error 1622). Corregido con la migración `20261112120000` (referencia `fixo-sbx-<32 hex>`, 41 caracteres) y una guarda previa al envío.
2. **El correo del pagador debe ser entregable** (error 1620 para `*.invalid`, `example.com` y dominios sin MX). Las cuentas sintéticas deben ser `.invalid`, así que se añadió `FIXO_FLOW_SANDBOX_PAYER_EMAIL`, que sustituye **sólo** a un pagador `.invalid` (el propietario indicó su dirección; está en Vercel y `.env.local`, no en Git).
3. **El coste Flow llega como cadena decimal** (`"837.00"`), no como entero: el parser lo descartaba y el coste quedaba «pendiente de conciliación». Corregido (sólo valores de valor entero; fracciones siguen desconocidas).

**Observaciones para el propietario:**
- Flow informa además `taxes` (159) y `balance` (25.254) en `paymentData`. Fixo registra como coste G únicamente el `fee` (837), sin inventar un desglose tributario (PLAN §3). Si G debe incluir los impuestos (996 = monto − saldo), es una decisión comercial y un cambio de código pequeño.
- El checkout de Sandbox muestra un distintivo reCAPTCHA que no impidió la automatización.
- Estado final tras la matriz: 8 órdenes pagadas (1 en revisión por la cancelación), 8 intentos pagados y 5 fallidos, 0 intentos abiertos, bandeja `done` 6 + 1 en cuarentena (el token fabricado), 14 eventos financieros, 5 usuarios (2 originales + 3 sintéticos).

## 3. Criterios de aceptación (PLAN §12)

| Criterio | Estado |
| --- | --- |
| Flujo inicial + adicional extremo a extremo en Flow Sandbox | **PASS integración/Sandbox** (trabajo `aprobado`: pago inicial y adicional aceptado, saldo visible antes del pago, ambos verificados por consulta autenticada) |
| Cliente paga Q + F, profesional conserva Q, Flow absorbido en F | PASS local (pgTAP, navegador) |
| 5 % inicial, editable por superadmin, congelado por orden | PASS local |
| Consentimiento explícito del total; adicional sólo tras aceptación | PASS local |
| Sólo consulta autenticada acredita pago | PASS local (pgTAP, integración) |
| Inicio bloqueado sin pago inicial; cierre bloqueado con saldo | PASS local (pgTAP: compuerta de inicio; cierre en suite embebida) |
| Historial y saldos coherentes en tres paneles, sin órdenes ajenas | PASS local (navegador, pgTAP) |
| Replay/fallos/concurrencia sin duplicar cobros | PASS local (suite embebida e integración) |
| Inbox y conciliación se recuperan tras interrupciones | **PASS integración/Sandbox** (worker detenido y reanudado; notificación perdida con conciliación independiente) |
| Liquidación sólo simulada, sin afirmar transferencia | PASS local (navegador: "no son transferencias efectuadas") |
| Regresión y restauración aislada con límites | Parcial (ver §2) |
| Sin cobros reales | **Cumplido** (API fijada a Sandbox, interruptores apagados) |
| Sin migraciones productivas, push ni deploy sin autorización | **Cumplido con autorización expresa**: el propietario autorizó el 2026-11-12 las cuatro migraciones, push, deploy y cron (ver §0) |

## 4. Limitaciones y riesgos pendientes

1. **Sandbox real sin ejecutar.** Todo el comportamiento frente a Flow (formato real de respuestas, `fee`, tiempos, callbacks reales) está validado sólo contra especificación y dobles.
2. **Ejecutor del worker: Supabase Cron activo** desde la fase B (no hay `vercel.json` ni Vercel Cron). Con las notificaciones apagadas no concilia pagos; no hay alertas automáticas (la salud se consulta por SQL con rol propietario).
3. **Rotación de clave de tokens**: la implementación lee una sola clave; rotar con tokens en vuelo los vuelve indescifrables.
4. **Trigger `payment_policy_append_only`**: cambio de esquema dentro del alcance del PLAN (§5 "historial inmutable"), **ya aplicado en producción** junto a la primera migración, sin revisión específica de Codex.
5. **Limitador**: sin `FIXO_TRUSTED_IP_HEADER` todos los callbacks comparten un cubo de 120/min; `payment_rate_limit_cleanup` se ejecuta en cada pasada del worker; umbrales no configurables.
6. **Navegador**: sólo Chrome headless, `next dev`; sin lector de pantalla, build de producción, logs de servidor ni retorno real de Flow.
7. **Trabajo ajeno → HTTP 200** con pantalla de no encontrado (comportamiento del Sprint 04, sin fuga de datos). Decisión pendiente si se quiere 404 real.
8. Sin alertas ni responsable operativo definidos; sin auditoría específica de cambios de comisión más allá del historial versionado.
9. pgTAP cubre la cancelación tras pago y la retención, pero no cubre adicionales/cierre/cancelación/suspensión/pago tardío y duplicado (están en la suite embebida).
10. **Las cuatro migraciones de pagos (`20261110140000`, `20261111120000`, `20261111130000`, `20261112090000`) están aplicadas en producción y no deben editarse.** Editar un archivo ya ejecutado no cambia la base de producción y haría divergir las instalaciones nuevas de ella: **cualquier cambio posterior exige una migración nueva** (parcheando con `pg_get_functiondef` o `create or replace`, como en las anteriores). Las ediciones in situ del sprint se hicieron antes de aplicar cada archivo.

## 4b. Revisión de Codex del 2026-11-12 (3 hallazgos)

1. **ALTO, cancelación con pago aplicado**: corregido. Disparador `a_job_cancellation_payment_review` (BEFORE UPDATE en `jobs`): al pasar a `cancelled` marca `job_cancelled` en las órdenes pagadas o con intento aún pagable, conserva `paid`, registra un evento interno único y un aviso por participante. **Discrepancia PLAN ↔ código resuelta por mí, a validar:** `job_command` de Sprint 04 bloqueaba aprobar cualquier cancelación con `payment_state<>'not_enabled'` (los adicionales exigen pago inicial, así que con pagos esa rama era siempre inalcanzable); PLAN §7.5 exige que esas cancelaciones queden en revisión, por lo que se retiró sólo esa condición (un trabajo ya iniciado sigue necesitando política comercial). Si el propietario prefiere mantener el bloqueo, basta revertir esa sustitución y el disparador queda como defensa.
2. **MEDIO, retención de tokens**: corregido. `payment_purge_sensitive(retention_days)` (service_role; 30 días desde el worker). Sólo material cifrado de registros resueltos; los pendientes siguen recuperables (probado).
3. **MEDIO, restauración**: corregido con el ensayo local descrito en §2. No sustituye una restauración de Auth/Storage administrados.

## 5. Qué falta (aprobaciones e insumos)

- ~~A. Cuarta migración y deploy~~ **hecho**. ~~B. Cron~~ **hecho y sano**.
- **C.** Cuentas sintéticas `.invalid`, manifiesto y la matriz del runbook §9 con los interruptores encendidos sólo durante la ventana de prueba (más el script remoto que conduce el checkout de Flow Sandbox, aún por escribir).
- **D.** Elección de limpieza (retención etiquetada o purga transaccional por manifiesto; los registros financieros son append-only).
- Decisión sobre la cabecera de IP confiable (`FIXO_TRUSTED_IP_HEADER`) y sobre alertas operativas del cron.
- Después: evidencia sanitizada, consulta del resultado de GitHub Actions y actualización de este reporte.

## 6. Archivos y evidencia

Ver `docs/ai/HANDOFF.md` (detalle por etapa y por corrección de revisión). Evidencia sanitizada: `docs/production/sprint-05-evidence/browser-local.json`. No incluye tokens, claves ni PII.
