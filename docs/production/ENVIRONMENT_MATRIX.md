# Matriz de entornos y variables — Sprint 06 (borrador)

Fecha: 2026-11-13. Estado: **borrador de diseño**. Origen de los nombres: `.env.example` y el recuento de `process.env.*` en `src/` y `scripts/` (comprobado hoy). Sólo nombres: ningún valor, ni real ni de ejemplo. El entorno de validación **no existe todavía** (Etapa 2, requiere autorización); las columnas de destino son requisitos de diseño, no estado verificado. Las reglas de "requerida/opcional" por entorno deben confirmarse contra `src/config/server-environment.ts` al implementar la Etapa 2.

Estado verificado el 2026-11-13: en Vercel sólo existen variables del entorno **Production** (ninguna en Preview/Development) y no están definidas `FIXO_TRUSTED_IP_HEADER` ni `FIXO_INVITATIONS_ENABLED` (ver `INFRASTRUCTURE_INVENTORY.md`).

Regla general (plan Etapa 2): cada destino tiene su propio proyecto Supabase, claves, Vault, buckets, correo y workers; los previews de PR no reciben claves productivas; los forks no reciben secretos; `NEXT_PUBLIC_*` se incorpora al build, por lo que un artefacto construido con el backend de validación **no se promueve** a producción.

## 1. Aplicación web (Vercel)

| Variable | Tipo | Producción | Validación | Preview PR / fork | CI |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_DEMO_MODE` | pública | `false` (el código rechaza `true` en producción y previews) | `false` | `false` | `false` |
| `NEXT_PUBLIC_SUPABASE_URL` | pública | proyecto de producción | proyecto de validación | proyecto de validación o ficticia; nunca producción | ficticia `*.invalid` (build) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | pública | de producción | de validación | de validación o ficticia | ficticia |
| `SUPABASE_SERVICE_ROLE_KEY` | secreto, sólo servidor | de producción | de validación | **no** definida en forks; en previews, sólo la de validación | no definida (las pruebas locales usan la pila aislada) |
| `FIXO_APP_URL` | servidor | `https://www.soyfixo.cl` | origen estable protegido de validación | URL del preview | no aplica |
| `FIXO_INVITATIONS_ENABLED` | servidor | **no definida hoy en Vercel** (inventario 2026-11-13); mantener apagada hasta comprobar entrega de correo | apagada/controlada | apagada | no aplica |
| `FIXO_TRUSTED_IP_HEADER` | servidor | **sin definir** (decisión abierta: verificar el trayecto real; no elevar límites desde cabeceras falsificables) | a medir en validación | sin definir | no aplica |

## 2. Pagos Flow (servidor)

| Variable | Producción | Validación |
| --- | --- | --- |
| `FIXO_FLOW_MODE` | Sandbox fijado; sin Flow productivo en este sprint | Sandbox |
| `FIXO_PAYMENTS_CREATION_ENABLED`, `FIXO_PAYMENTS_NOTIFICATIONS_ENABLED` | **apagadas** (estado al cierre del Sprint 05) | encendidas sólo durante pruebas Sandbox |
| `FLOW_API_KEY`, `FLOW_SECRET_KEY` | credenciales Sandbox actuales (sin Flow productivo) | credenciales Sandbox propias de validación |
| `FIXO_FLOW_CALLBACK_ORIGIN`, `FIXO_PAYMENTS_SUPABASE_ORIGIN` | origen canónico de producción | origen de validación |
| `FIXO_PAYMENTS_WORKER_SECRET` | secreto propio; coincide con el de Vault `fixo_payments_worker_secret` | **independiente** del de producción |
| `FIXO_PAYMENT_TOKEN_KEY_ID`, `FIXO_PAYMENT_TOKEN_KEY` | clave única (rotarla con pendientes deja los tokens indescifrables: no rotar sin drenar) | independiente |
| `FIXO_FLOW_SANDBOX_PAYER_EMAIL` | dirección del propietario (sólo sustituye pagadores sintéticos `.invalid`) | destinatario autorizado de validación |

## 3. Workers fuera de Vercel (host Linux, aún inexistente)

| Variable | Proceso | Nota |
| --- | --- | --- |
| `FIXO_INSPECTION_PROJECT`, `FIXO_CLAMSCAN_PATH`, `FIXO_CLAMAV_DATABASE_DIR`, `FIXO_INSPECTION_LOAD_LOCAL` | inspector (`ops/inspection-worker.service`, `/etc/fixo/inspection.env`) | usuario `fixo-inspection`; no son variables del navegador ni valores por defecto de Vercel |
| `FIXO_NOTIFICATION_ADAPTER`, `FIXO_NOTIFICATION_PROJECT`, `FIXO_NOTIFICATION_SYNTHETIC_RECIPIENTS`, `FIXO_NOTIFICATION_CAPTURE_DIR`, `FIXO_NOTIFICATION_LOAD_LOCAL` | worker de avisos | hoy sólo `capture` sintético; el adaptador CPaaS (Etapa 5) añadirá credenciales propias, sin reutilizar el SMTP de Zoho Mail |
| Credenciales de worker (service role / RPC estrechas) | ambos | usuarios y secretos separados por proceso; mínimo acceso; rotación documentada |

## 4. Variables sólo de pruebas y operación puntual (no van a Vercel ni a producción)

`FIXO_FLOW_SANDBOX_REMOTE`, `FIXO_FLOW_SANDBOX_MANIFEST`, `FIXO_FLOW_SECRETS_FILE`, `FIXO_FLOW_SHOTS`, `FIXO_SPRINT03_AUTHORIZED`/`_RUN`, `FIXO_SPRINT04_AUTHORIZED`/`_RUN`/`_BROWSER_FINISH_ONLY`, `FIXO_EXISTING_PROJECT_AUTHORIZED`, `FIXO_CLEANUP_SQL_CONFIRMED`, `FIXO_TEST_*` (`DB_URL`, `SUPABASE_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `DATABASE_PASSWORD`, `ALLOW_WRITES`, `WAIT_FOR_EXPIRY`), `FIXO_PAYMENTS_LOCAL_SUPABASE`, `FIXO_PAYMENT_TESTS`, `FIXO_JOB_TEST_MODULE`, `FIXO_BROWSER_REUSE_RUN`, `FIXO_BROWSER_TEST_URL`. Son guardas o parámetros de las suites; deben permanecer fuera de los entornos desplegados.

## 5. Pruebas de aislamiento exigidas (Etapa 2) — todas NOT TESTED

Positivas: la validación usa su proyecto, claves, Vault, buckets y remitentes. Negativas (deben fallar cerradas): usar el proyecto equivocado; preview o fork con secretos de producción; callback no autorizado; acceso a datos ajenos; allowlists de Auth apuntando a producción. Un preview visual con claves ficticias no acredita integración.
