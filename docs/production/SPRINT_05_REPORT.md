# Sprint 05 — Flow Chile Sandbox: reporte de entrega

**Fecha de corte: 2026-11-12.** **Estado global: implementación y pruebas locales completas; Flow Sandbox real NO PROBADO.** Según PLAN §9, el sprint **no puede declararse completo** sin evidencia Sandbox. Ningún resultado de este reporte proviene de Flow real. Las únicas operaciones remotas realizadas están listadas en «Estado operativo» y ninguna toca Flow ni habilita cobros.

## 0. Estado operativo (corte 2026-11-12)

| Elemento | Estado | Detalle |
| --- | --- | --- |
| Migraciones `20261110140000`, `20261111120000`, `20261111130000` | **APLICADAS en producción** (proyecto Fixo `rjzy…`) | Por decisión expresa del propietario; preflight de sólo lectura previo (2 usuarios originales, sin datos comerciales), `db push` y verificación posterior. Pagos habilitables sólo con interruptores. |
| Migración `20261112090000_payment_sandbox_accounts.sql` (allowlist de cuentas Sandbox + historial) | **PENDIENTE, sólo local** | No aplicada en ningún destino remoto; sigue editándose in situ. Requiere aprobación (fase A). |
| Push | **Hecho** hasta el commit `882c132` de la rama `codex/sprint-04-job-management`; los commits posteriores (cron, allowlist, correcciones) son **locales** | Sin force; `main` intacto. |
| Deploy a `www.soyfixo.cl` | **Hecho** con el código de ese corte (sin allowlist ni endpoint endurecido) | Variables de Flow y de pagos cargadas en Vercel con ambos interruptores en `false`. Smoke de sólo lectura PASS. El código posterior **no está desplegado**. |
| Interruptores de pagos | **Apagados** (`FIXO_PAYMENTS_CREATION_ENABLED=false`, `FIXO_PAYMENTS_NOTIFICATIONS_ENABLED=false`) | Cobros reales: inexistentes (API fijada a Sandbox). |
| Ejecutor del worker | **Decidido: Supabase Cron** (no Vercel Cron). **Preparado, NO activado** | `supabase/ops/payments-worker-cron.sql` no se ha aplicado; no hay secretos en Vault ni extensiones `pg_cron`/`pg_net` instaladas en remoto. Probado sólo en local. Mientras no se active, un pago aprobado en Flow no se reflejaría en Fixo. |
| Pruebas Flow Sandbox | **No ejecutadas** | Requieren aprobaciones A–D (runbook §9). |

Leyenda: **PASS local** = ejecutado hoy en base/servicios locales aislados; **PASS integración/Sandbox** = contra Flow real (ninguno); **FAIL**; **NOT TESTED**. Las cifras del Sprint 04 no se reutilizan.

## 1. Qué se entregó

- **Modelo financiero** (migraciones `20261110140000_flow_sandbox_payments.sql`, `20261111120000_payment_rate_limits.sql` y `20261111130000_payment_sensitive_retention.sql`, **aplicadas en producción**; la cuarta, `20261112090000`, pendiente y sólo local): siete tablas privadas (seis del PLAN §5 + `payment_rate_limits`, desviación aprobada por el propietario), RLS sin privilegios directos, RPC de usuario y de worker, triggers de inmutabilidad (términos de orden, eventos, historial de política), proyección `payment_state`, compuerta de ejecución.
- **Reglas**: F = round-half-up(Q·bp/10000), T = Q + F, Q intacto, coste Flow absorbido dentro de F; política 5 % inicial, versionada, congelada por orden; consentimiento atado al desglose y versión exactos; sólo la consulta autenticada al proveedor acredita pago.
- **Proveedor y creación**: firma, configuración Sandbox con API fija, intento durable previo, creación ambigua resuelta por consulta (sin recreate), checkout cifrado.
- **Confirmación y conciliación**: rutas `confirmation`/`return`, bandeja durable con leases y fencing, worker (`POST /api/payments/worker`), cuarentena, limitador persistente, plazo total de 10 s en el callback.
- **UI por rol**: panel de pagos del cliente, adicionales (propuesta técnico / respuesta cliente), `/tecnico/pagos` con sólo Q, `/admin/configuracion` (moderador sólo lectura, superadmin edita porcentaje y reconsulta), insignias en lista.
- **Operación**: [runbook](SPRINT_05_FLOW_SANDBOX_RUNBOOK.md), `.env.example`, allowlist de avisos de pago.
- **Interruptores**: `FIXO_FLOW_MODE`, `FIXO_PAYMENTS_CREATION_ENABLED`, `FIXO_PAYMENTS_NOTIFICATIONS_ENABLED`; los dos de pagos apagados.
- **Preparado, sin activar (local)**: ejecutor Supabase Cron (`supabase/ops/`), allowlist de cuentas Sandbox con historial inmutable (cuarta migración) y endpoint del worker con logs estructurados.

## 2. Resultados de pruebas

| Área | Resultado | Evidencia |
| --- | --- | --- |
| pgTAP (`npm run db:test`, CLI 3.1.0) | **PASS local** 7 archivos / 294 tests (134 en `06_flow_payments`, incl. cancelación, retención y allowlist de cuentas Sandbox) | 2026-11-12 |
| Suite PostgreSQL embebida `scripts/test-payments-postgres.mjs` | **PASS local** 76 checks (concurrencia, leases, cancelación por RPC reales, carreras con dos conexiones, allowlist y su carrera, retención, restauración financiera) | 2026-11-12 |
| Ejecutor Supabase Cron `scripts/test-payments-worker-cron.mjs` | **PASS local** 7 checks con pg_cron/pg_net reales (incl. 200 con fallos internos y cron detenido) y servidor HTTP local; **no activado en remoto** | 2026-11-12 |
| Vitest | **PASS local** 52 archivos; 351 PASS y 8 omitidos (la integración PostgREST local, que se ejecutó aparte con el Supabase local: 27/27 en `src/repositories`) | 2026-11-12 |
| Integración PostgREST/JWT local (Supabase local) | **PASS local** (callback→bandeja→worker→`paid`, mismatch, desconocida, RPC admin) | `supabase-payment-repository.local.test.ts` |
| Navegador por rol | **PASS local** 11/11 (incluye cuenta Sandbox no autorizada; corridas previas fallaron por defectos del script o poca memoria) | `docs/production/sprint-05-evidence/browser-local.json` (de la corrida de 10 checks; no regenerado) |
| `tsc --noEmit`, `eslint .`, `secrets:check` (547 archivos) | **PASS local** | |
| Pruebas de que las pgTAP muerden | **PASS local** (mutaciones temporales fallan los tests esperados) | HANDOFF |
| `npm run build`, `npm run test:smoke`, `npm audit`, `npm audit --omit=dev` | **PASS local** (2026-11-12): build OK; smoke de producción PASS; 0 vulnerabilidades en ambos audits | |
| GitHub Actions / CI remoto | **NOT TESTED** (la rama se publicó, pero no se consultó el resultado de ninguna ejecución) | |
| Restauración del modelo financiero en una segunda base aislada (PLAN §10) | **PASS local**: exporta datos financieros representativos (pago inicial, adicional, revisión, coste Flow, varias versiones de política, bandeja), restaura en una base nueva desde las migraciones y compara importes, referencias, estados, huellas de ciphertext, invariantes (T=Q+F, tasa congelada, pago↔evento exacto), RLS, grants, `search_path`, disparadores, inmutabilidad y lecturas por rol | `scripts/lib/payment-restore-checks.mjs`. **Límite:** Auth/Storage administrados y Supabase real no se restauran |
| Flow Sandbox real (aprobado, pendiente, rechazado, anulado, callback antes/después, token falso, caída de worker, tardío/duplicado, inicial + adicional) | **NOT TESTED** | Hay credenciales Sandbox y origen HTTPS (`www.soyfixo.cl`) cargados y el destino fue autorizado, pero no se ha ejecutado ninguna prueba: faltan las aprobaciones A–D (migración 4 + deploy, cron, cuentas sintéticas, limpieza) y el script remoto que conduce el checkout de Flow |

Los casos adversos (callback falso, mismatch, tardío, duplicado, replay, concurrencia) están cubiertos **con dobles de proveedor/SQL controlado**: no acreditan comportamiento real de Flow.

## 3. Criterios de aceptación (PLAN §12)

| Criterio | Estado |
| --- | --- |
| Flujo inicial + adicional extremo a extremo en Flow Sandbox | **NOT TESTED / BLOQUEADO** |
| Cliente paga Q + F, profesional conserva Q, Flow absorbido en F | PASS local (pgTAP, navegador) |
| 5 % inicial, editable por superadmin, congelado por orden | PASS local |
| Consentimiento explícito del total; adicional sólo tras aceptación | PASS local |
| Sólo consulta autenticada acredita pago | PASS local (pgTAP, integración) |
| Inicio bloqueado sin pago inicial; cierre bloqueado con saldo | PASS local (pgTAP: compuerta de inicio; cierre en suite embebida) |
| Historial y saldos coherentes en tres paneles, sin órdenes ajenas | PASS local (navegador, pgTAP) |
| Replay/fallos/concurrencia sin duplicar cobros | PASS local (suite embebida e integración) |
| Inbox y conciliación se recuperan tras interrupciones | PASS local (leases/reinicio); caída real **NOT TESTED** |
| Liquidación sólo simulada, sin afirmar transferencia | PASS local (navegador: "no son transferencias efectuadas") |
| Regresión y restauración aislada con límites | Parcial (ver §2) |
| Sin cobros reales | **Cumplido** (API fijada a Sandbox, interruptores apagados) |
| Sin migraciones productivas, push ni deploy sin autorización | **Cumplido con autorización expresa**: el propietario autorizó el 2026-11-12 tres migraciones, push y deploy (ver §0) |

## 4. Limitaciones y riesgos pendientes

1. **Sandbox real sin ejecutar.** Todo el comportamiento frente a Flow (formato real de respuestas, `fee`, tiempos, callbacks reales) está validado sólo contra especificación y dobles.
2. **Ejecutor del worker decidido (Supabase Cron) pero NO activado**: hasta aplicar `payments-worker-cron.sql` (aprobación B) no hay worker en producción y un pago aprobado en Flow no se reflejaría. No existe `vercel.json` ni se usará Vercel Cron.
3. **Rotación de clave de tokens**: la implementación lee una sola clave; rotar con tokens en vuelo los vuelve indescifrables.
4. **Trigger `payment_policy_append_only`**: cambio de esquema dentro del alcance del PLAN (§5 "historial inmutable"), **ya aplicado en producción** junto a la primera migración, sin revisión específica de Codex.
5. **Limitador**: sin `FIXO_TRUSTED_IP_HEADER` todos los callbacks comparten un cubo de 120/min; `payment_rate_limit_cleanup` se ejecuta en cada pasada del worker; umbrales no configurables.
6. **Navegador**: sólo Chrome headless, `next dev`; sin lector de pantalla, build de producción, logs de servidor ni retorno real de Flow.
7. **Trabajo ajeno → HTTP 200** con pantalla de no encontrado (comportamiento del Sprint 04, sin fuga de datos). Decisión pendiente si se quiere 404 real.
8. Sin alertas ni responsable operativo definidos; sin auditoría específica de cambios de comisión más allá del historial versionado.
9. pgTAP cubre la cancelación tras pago y la retención, pero no cubre adicionales/cierre/cancelación/suspensión/pago tardío y duplicado (están en la suite embebida).
10. Las tres primeras migraciones se editaron in situ **antes** de aplicarse y ya están en producción: desde ahora cualquier cambio debe ir en una migración nueva. La cuarta (`20261112090000`) aún no se aplicó, por lo que sigue siendo editable.

## 4b. Revisión de Codex del 2026-11-12 (3 hallazgos)

1. **ALTO, cancelación con pago aplicado**: corregido. Disparador `a_job_cancellation_payment_review` (BEFORE UPDATE en `jobs`): al pasar a `cancelled` marca `job_cancelled` en las órdenes pagadas o con intento aún pagable, conserva `paid`, registra un evento interno único y un aviso por participante. **Discrepancia PLAN ↔ código resuelta por mí, a validar:** `job_command` de Sprint 04 bloqueaba aprobar cualquier cancelación con `payment_state<>'not_enabled'` (los adicionales exigen pago inicial, así que con pagos esa rama era siempre inalcanzable); PLAN §7.5 exige que esas cancelaciones queden en revisión, por lo que se retiró sólo esa condición (un trabajo ya iniciado sigue necesitando política comercial). Si el propietario prefiere mantener el bloqueo, basta revertir esa sustitución y el disparador queda como defensa.
2. **MEDIO, retención de tokens**: corregido. `payment_purge_sensitive(retention_days)` (service_role; 30 días desde el worker). Sólo material cifrado de registros resueltos; los pendientes siguen recuperables (probado).
3. **MEDIO, restauración**: corregido con el ensayo local descrito en §2. No sustituye una restauración de Auth/Storage administrados.

## 5. Qué falta (aprobaciones e insumos)

- **A.** Aplicar la cuarta migración en producción y desplegar el código posterior (allowlist, endpoint con logs).
- **B.** Cron: crear `fixo_payments_worker_url`/`fixo_payments_worker_secret` en Vault y aplicar `payments-worker-cron.sql`; comprobar `private.payment_worker_health()`.
- **C.** Cuentas sintéticas `.invalid`, manifiesto y la matriz del runbook §9 con los interruptores encendidos sólo durante la ventana de prueba (más el script remoto que conduce el checkout de Flow Sandbox, aún por escribir).
- **D.** Elección de limpieza (retención etiquetada o purga transaccional por manifiesto; los registros financieros son append-only).
- Decisión sobre la cabecera de IP confiable (`FIXO_TRUSTED_IP_HEADER`).
- Después: evidencia sanitizada, consulta del resultado de GitHub Actions y actualización de este reporte.

## 6. Archivos y evidencia

Ver `docs/ai/HANDOFF.md` (detalle por etapa y por corrección de revisión). Evidencia sanitizada: `docs/production/sprint-05-evidence/browser-local.json`. No incluye tokens, claves ni PII.
