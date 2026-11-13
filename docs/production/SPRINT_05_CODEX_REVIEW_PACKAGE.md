# Sprint 05 — Paquete para revisión de Codex (PLAN §14)

Corte: 2026-11-13. Rama `codex/sprint-04-job-management` (sin force; `main` intacto). Commits del sprint: 25, desde `f5ee88d` (114 archivos, +10 076/−401; `git diff f5ee88d~1..HEAD`).

## 1. Veredicto declarado
**Sprint 05 cerrado CON LIMITACIONES EXPLÍCITAS** (decisión del propietario, 2026-11-13: cerrar con la opción 1). Lo siguiente NO está acreditado y no se afirma:
- **CI de GitHub:** nunca ha ejecutado (cuenta bloqueada por facturación: "account is locked due to a billing issue"; ver HANDOFF). Toda la evidencia es local o contra producción/Sandbox. `actionlint` 1.7.12 valida `ci.yml`.
- **Cierre financiero:** la orden externa Flow `11657296` sigue `pending/still_payable` (consulta del 2026-11-13). El manifiesto permanece en `retained-closure-pending`; `reconcile-external.mjs close` devuelve 3. Es un asunto externo abierto aceptado por el propietario (Sandbox, sin cobro real), **no** un cierre limpio.
- **Escenarios Sandbox NOT TESTED:** anulado (status 4), pago externo duplicado, respuesta de creación perdida, orden callback/retorno, cuarentenas (b) `provider_mismatch`, (c) consulta fallida de pago existente, (d) observación válida sin correlación local; interrupción real de `recost` contra producción.

## 2. Qué revisar (PLAN §14)
| Tema | Dónde |
| --- | --- |
| Comportamiento final y matriz Sandbox real | `SPRINT_05_REPORT.md` §0, §2b, §3 |
| Migraciones (5, todas aplicadas en producción; no editar) | `supabase/migrations/20261110140000`, `20261111120000`, `20261111130000`, `20261112090000`, `20261112120000` |
| Worker/cron | `supabase/ops/payments-worker-cron.sql` (+ rollback), `src/services/payments/payment-worker-service.ts` |
| Proveedor Flow (firma, longitud 45, coste fee+taxes, pagador sintético) | `src/integrations/payments/flow-client.ts`, `flow-provider.ts` |
| Herramientas de la corrida remota | `scripts/flow-sandbox/*` (`logic.mjs`, `recost-core.mjs`, `reconcile-external.mjs`, `retain.mjs`) |
| Evidencia sanitizada | `docs/production/sprint-05-evidence/` (`flow-sandbox-manifest.json`, `browser-local.json`) |
| Runbook y reversión | `SPRINT_05_FLOW_SANDBOX_RUNBOOK.md` (§11b retención ≠ cierre, §12 coste G) |
| Decisiones y correcciones por revisión | `docs/ai/HANDOFF.md` |

## 3. Pruebas y resultados (locales, última ejecución 2026-11-12)
`npx tsc --noEmit` limpio · `npx eslint .` limpio · `npx vitest run`: 376 PASS, 8 omitidos (integración local) · pgTAP 294 · suite Postgres embebido `scripts/test-payments-postgres.mjs`: 77 comprobaciones · `scripts/test-payments-worker-cron.mjs`: 7 · navegador `scripts/test-payments-browser.mjs`: 11/11 (Chrome headless, `next dev`) · `scripts/test-flow-sandbox-tools.mjs`: 4. **No ejecutado:** `npm run build`/`test:smoke`/`npm audit` en esta pasada (los cubría el CI inexistente).

## 4. Estado de producción (2026-11-13)
Proyecto `rjzyqdhotcshvbdcrgon`, `www.soyfixo.cl`. Interruptores de pagos **apagados**; Supabase Cron `fixo-payments-worker` activo y sano; allowlist revocada; cuentas sintéticas inertes; 0 técnicos públicos sintéticos; `category_requirements` vacía; coste G = 996 (fee 837 + impuestos 159). Sin cobros reales (API fijada a Sandbox). El repositorio está **público** (decisión del propietario para probar CI): revisar secretos del historial o volver a privado.

## 5. Decisiones/riesgos para Codex
1. ¿Aceptar el cierre con la orden `11657296` abierta, o exigir su anulación desde el panel de Flow Sandbox?
2. ¿Exigir evidencia de CI antes de recomendar el siguiente paso, o aceptar la evidencia local?
3. Escenarios NOT TESTED: ¿cuáles son imprescindibles (el simulador no ofrece "anulado")?
4. `FIXO_TRUSTED_IP_HEADER` y alertas del cron sin decidir; purga destructiva (opción 2) no autorizada; rotación de la clave de tokens no soportada; 404 vs 200 para trabajo ajeno (Sprint 04).
5. Revisar los commits posteriores a su última revisión: `e616929`, `c449bee`, `b80e331` y los de documentación.
