# Sprint 05 — Flow Chile Sandbox: reporte de entrega

Fecha: 2026-11-11. **Estado global: implementación y pruebas locales completas; Sandbox real NO PROBADO (BLOQUEADO por credenciales y entorno).** Según PLAN §9, el sprint **no puede declararse completo** sin evidencia Sandbox: este reporte identifica ese bloqueo explícitamente. Ningún dato de este reporte proviene de Flow real ni del Supabase remoto.

Leyenda: **PASS local** = ejecutado hoy en base/servicios locales aislados; **PASS integración/Sandbox** = contra Flow real (ninguno); **FAIL**; **NOT TESTED**. Las cifras del Sprint 04 no se reutilizan.

## 1. Qué se entregó

- **Modelo financiero** (migraciones `20261110140000_flow_sandbox_payments.sql`, `20261111120000_payment_rate_limits.sql` y `20261111130000_payment_sensitive_retention.sql`, no aplicadas en remoto): siete tablas privadas (seis del PLAN §5 + `payment_rate_limits`, desviación aprobada por el propietario), RLS sin privilegios directos, RPC de usuario y de worker, triggers de inmutabilidad (términos de orden, eventos, historial de política), proyección `payment_state`, compuerta de ejecución.
- **Reglas**: F = round-half-up(Q·bp/10000), T = Q + F, Q intacto, coste Flow absorbido dentro de F; política 5 % inicial, versionada, congelada por orden; consentimiento atado al desglose y versión exactos; sólo la consulta autenticada al proveedor acredita pago.
- **Proveedor y creación**: firma, configuración Sandbox con API fija, intento durable previo, creación ambigua resuelta por consulta (sin recreate), checkout cifrado.
- **Confirmación y conciliación**: rutas `confirmation`/`return`, bandeja durable con leases y fencing, worker (`POST /api/payments/worker`), cuarentena, limitador persistente, plazo total de 10 s en el callback.
- **UI por rol**: panel de pagos del cliente, adicionales (propuesta técnico / respuesta cliente), `/tecnico/pagos` con sólo Q, `/admin/configuracion` (moderador sólo lectura, superadmin edita porcentaje y reconsulta), insignias en lista.
- **Operación**: [runbook](SPRINT_05_FLOW_SANDBOX_RUNBOOK.md), `.env.example`, allowlist de avisos de pago.
- **Interruptores**: `FIXO_FLOW_MODE`, `FIXO_PAYMENTS_CREATION_ENABLED`, `FIXO_PAYMENTS_NOTIFICATIONS_ENABLED`; todos apagados.

## 2. Resultados de pruebas

| Área | Resultado | Evidencia |
| --- | --- | --- |
| pgTAP (`npm run db:test`, CLI 3.1.0) | **PASS local** 7 archivos / 282 tests (122 en `06_flow_payments`, incl. cancelación, retención y allowlist de cuentas Sandbox) | 2026-11-12 |
| Suite PostgreSQL embebida `scripts/test-payments-postgres.mjs` | **PASS local** 75 checks (concurrencia, leases, cancelación por RPC reales, carreras con dos conexiones, allowlist, retención, restauración financiera) | 2026-11-12 |
| Ejecutor Supabase Cron `scripts/test-payments-worker-cron.mjs` | **PASS local** 5 checks con pg_cron/pg_net reales y servidor HTTP local; **no activado en remoto** | 2026-11-12 |
| Vitest | **PASS local** 52 archivos / 355 PASS con la integración PostgREST local activa | 2026-11-12 |
| Integración PostgREST/JWT local (Supabase local) | **PASS local** (callback→bandeja→worker→`paid`, mismatch, desconocida, RPC admin) | `supabase-payment-repository.local.test.ts` |
| Navegador por rol | **PASS local** 10/10 (corrida 10; 1–9 fallaron por defectos del script) | `docs/production/sprint-05-evidence/browser-local.json` |
| `tsc --noEmit`, `eslint .`, `secrets:check` (547 archivos) | **PASS local** | |
| Pruebas de que las pgTAP muerden | **PASS local** (mutaciones temporales fallan los tests esperados) | HANDOFF |
| `npm run build`, `npm run test:smoke`, `npm audit`, `npm audit --omit=dev` | **PASS local** (2026-11-12): build OK; smoke de producción PASS; 0 vulnerabilidades en ambos audits | |
| GitHub Actions / CI remoto | **NOT TESTED** (sin push) | |
| Restauración del modelo financiero en una segunda base aislada (PLAN §10) | **PASS local**: exporta datos financieros representativos (pago inicial, adicional, revisión, coste Flow, varias versiones de política, bandeja), restaura en una base nueva desde las migraciones y compara importes, referencias, estados, huellas de ciphertext, invariantes (T=Q+F, tasa congelada, pago↔evento exacto), RLS, grants, `search_path`, disparadores, inmutabilidad y lecturas por rol | `scripts/lib/payment-restore-checks.mjs`. **Límite:** Auth/Storage administrados y Supabase real no se restauran |
| Flow Sandbox real (aprobado, pendiente, rechazado, anulado, callback antes/después, token falso, caída de worker, tardío/duplicado, inicial + adicional) | **NOT TESTED — BLOQUEADO** | sin credenciales Sandbox, origen HTTPS alcanzable ni destino Supabase aislado autorizado |

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
| Sin cobros reales, migraciones productivas, push ni deploy | **Cumplido** |

## 4. Limitaciones y riesgos pendientes

1. **Sandbox real sin ejecutar.** Todo el comportamiento frente a Flow (formato real de respuestas, `fee`, tiempos, callbacks reales) está validado sólo contra especificación y dobles.
2. **Ejecutor del worker sin decidir** (PLAN §4): sin `vercel.json` ni runner; sin worker no se reflejan los pagos aprobados.
3. **Rotación de clave de tokens**: la implementación lee una sola clave; rotar con tokens en vuelo los vuelve indescifrables.
4. **Trigger `payment_policy_append_only`**: cambio de esquema dentro del alcance del PLAN (§5 "historial inmutable") pero sin revisión de Codex.
5. **Limitador**: sin `FIXO_TRUSTED_IP_HEADER` todos los callbacks comparten un cubo de 120/min; `payment_rate_limit_cleanup` se ejecuta en cada pasada del worker; umbrales no configurables.
6. **Navegador**: sólo Chrome headless, `next dev`; sin lector de pantalla, build de producción, logs de servidor ni retorno real de Flow.
7. **Trabajo ajeno → HTTP 200** con pantalla de no encontrado (comportamiento del Sprint 04, sin fuga de datos). Decisión pendiente si se quiere 404 real.
8. Sin alertas ni responsable operativo definidos; sin auditoría específica de cambios de comisión más allá del historial versionado.
9. pgTAP cubre la cancelación tras pago y la retención, pero no cubre adicionales/cierre/cancelación/suspensión/pago tardío y duplicado (están en la suite embebida).
10. La migración se **editó in situ** durante el sprint (no aplicada en ninguna base remota); si algún entorno la hubiera aplicado, debería reemplazarse por una migración hacia adelante.

## 4b. Revisión de Codex del 2026-11-12 (3 hallazgos)

1. **ALTO, cancelación con pago aplicado**: corregido. Disparador `a_job_cancellation_payment_review` (BEFORE UPDATE en `jobs`): al pasar a `cancelled` marca `job_cancelled` en las órdenes pagadas o con intento aún pagable, conserva `paid`, registra un evento interno único y un aviso por participante. **Discrepancia PLAN ↔ código resuelta por mí, a validar:** `job_command` de Sprint 04 bloqueaba aprobar cualquier cancelación con `payment_state<>'not_enabled'` (los adicionales exigen pago inicial, así que con pagos esa rama era siempre inalcanzable); PLAN §7.5 exige que esas cancelaciones queden en revisión, por lo que se retiró sólo esa condición (un trabajo ya iniciado sigue necesitando política comercial). Si el propietario prefiere mantener el bloqueo, basta revertir esa sustitución y el disparador queda como defensa.
2. **MEDIO, retención de tokens**: corregido. `payment_purge_sensitive(retention_days)` (service_role; 30 días desde el worker). Sólo material cifrado de registros resueltos; los pendientes siguen recuperables (probado).
3. **MEDIO, restauración**: corregido con el ensayo local descrito en §2. No sustituye una restauración de Auth/Storage administrados.

## 5. Para desbloquear la etapa 6 (decisiones/insumos del propietario)

- Proyecto Supabase aislado autorizado y autorización explícita para aplicar en él las **cuatro** migraciones de pagos (tres ya aplicadas en `rjzy…` por decisión del propietario del 2026-11-12; la cuarta, `20261112090000`, pendiente), en este orden: 1) `20261110140000_flow_sandbox_payments.sql`, 2) `20261111120000_payment_rate_limits.sql`, 3) `20261111130000_payment_sensitive_retention.sql` (RPC de purga; sin ella no hay retención de tokens), y comprobar el preflight del runbook (§0) antes de habilitar nada.
- Cuenta y credenciales Flow **Sandbox**, y un origen HTTPS accesible por Flow (túnel o preview aislado; nunca preview público con DB comercial).
- Decisión del ejecutor del worker y de la cabecera de IP confiable.
- Luego: ejecutar la matriz del runbook §9, adjuntar evidencia sanitizada, `npm run build`/`test:smoke`/audits y el ensayo de restauración, y actualizar este reporte.

## 6. Archivos y evidencia

Ver `docs/ai/HANDOFF.md` (detalle por etapa y por corrección de revisión). Evidencia sanitizada: `docs/production/sprint-05-evidence/browser-local.json`. No incluye tokens, claves ni PII.
