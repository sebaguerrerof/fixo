# Runbook de liberación y reversión — Sprint 06 (borrador, NOT TESTED)

Fecha: 2026-11-13. Estado: **borrador sin ejecutar**. Ningún paso se ha corrido, ningún servicio remoto se consultó para escribirlo. Se apoya en `CI_VERCEL_RELEASE_PLAN.md` (Sprint 00.5/01) y lo actualiza. Describe preparación y validación; **no autoriza apertura comercial ni Flow productivo** (plan §1). Toda acción marcada 🔒 exige autorización específica del propietario antes de ejecutarse.

## 0. Principios
1. Nada se publica por un push o merge: la publicación a producción es un acto explícito y aprobado.
2. El artefacto de producción se construye con las variables de producción (`NEXT_PUBLIC_*` entra en el build). Un artefacto construido contra el backend de validación **nunca** se promueve a producción.
3. Revertir la aplicación no revierte migraciones ni invalida URLs firmadas ya emitidas. Las migraciones aplicadas no se editan; se corrige hacia adelante con una migración nueva compatible con la versión anterior de la app.
4. Pagos reales siguen apagados: `FIXO_PAYMENTS_CREATION_ENABLED=false` y `FIXO_PAYMENTS_NOTIFICATIONS_ENABLED=false` antes y después de cada liberación; Flow fijado a Sandbox.

## 1. Precondiciones (todas deben cumplirse; si una falla, no se libera)
| # | Condición | Evidencia requerida | Estado hoy |
| --- | --- | --- | --- |
| 1 | CI real **verde** del SHA candidato (`Fixo CI / application` y `Fixo CI / database`) | URL del run y SHA Mecanismo **operativo**: run `43458718551` verde para `cc2d56e` (2026-11-13). Cada SHA candidato necesita su propio run verde |
| 2 | PR aprobado hacia la rama de liberación acordada, con checks requeridos | PR y protección de rama | **Cumplida en lo estructural (2026-11-13):** `main` es la rama de liberación y por defecto, protegida (PR obligatorio, checks `application` y `database`, sin force-push/borrado, incluye administradores); PR #1 mergeado con CI verde (`155ca18`). Pendiente: probar el flujo con un segundo PR y la decisión de visibilidad (la protección exige repositorio público o plan de pago) |
| 3 | Despliegue de validación trazable del mismo SHA y pruebas de aislamiento | Matriz PASS/FAIL en el reporte | NOT TESTED: el entorno de validación no existe |
| 4 | Migraciones nuevas revisadas: compatibles hacia atrás con la app actual, sin editar historia | Lista de archivos y revisión de Codex | n/a (sin migraciones nuevas en este sprint hasta hoy) |
| 5 | Despliegue de producción anterior identificado para rollback | ID/alias de Vercel y SHA previo anotados **antes** de empezar | PENDIENTE (requiere inventario de lectura de Vercel) |
| 6 | Interruptores de pagos apagados y worker de Flow sano | `payment_worker_health()` con `degraded=false` | NOT TESTED hoy (último valor conocido, Sprint 05: sano) |
| 7 | Ventana, responsable y canal de comunicación acordados | Nombre y hora | PENDIENTE |

Discrepancia a resolver antes de depender del CI: `CI_VERCEL_RELEASE_PLAN.md` dice "CLI Supabase 3.0.0" y `ci.yml` usa `supabase@3.1.0`; la documentación debe alinearse con el workflow (no se cambió el workflow).

## 2. Mecanismo manual de liberación (a decidir y ensayar primero en validación 🔒)
Opciones permitidas por el plan; se elige una tras inventariar el plan de Vercel y probar que **ningún** push publica solo:
- **A. Despliegue CLI explícito** desde un SHA limpio: `vercel deploy --prod --archive=tgz` con las variables del proyecto productivo (es lo que se usó en el Sprint 05, sin SHA enlazado; el enlace Git no existía).
- **B. Enlace Git con producción manual**: sólo si la UI de Vercel permite garantizar que ramas y pushes no despliegan a producción; si no se puede garantizar, usar A.
Orden de enlace: primero el proyecto de **validación**; el proyecto productivo se enlaza al final y sólo tras inventariar sus automatismos (rama de producción, despliegues automáticos, hooks).

## 3. Procedimiento (por liberación)
1. 🔒 Anunciar la ventana y congelar cambios. Registrar: SHA candidato (`git rev-parse HEAD`), SHA y despliegue de producción vigente, migraciones aplicadas (`supabase migration list` sólo lectura contra producción), estado del cron y switches.
2. Verificar el árbol: `git status` limpio, sin cambios ajenos mezclados; el SHA es el del run de CI verde.
3. Comprobar que las migraciones pendientes (si las hay) son compatibles con la versión de la app **anterior** (para poder revertir sólo la app). Si no lo son, la liberación es de dos fases y requiere plan propio.
4. 🔒 Aplicar migraciones (si las hay) con la CLI fijada y confirmación explícita; verificar después con consultas de lectura. Nunca `db reset`, `drop` ni restauración sobre producción.
5. 🔒 Construir y desplegar con el mecanismo elegido en §2, con las variables de **producción**. Guardar log de build y URL del despliegue.
6. Smoke de producción sin escrituras: `/login` responde, rutas privadas rechazan cookies falsificadas (mismo criterio de `scripts/smoke-production.mjs`), `www.soyfixo.cl` sirve TLS válido y el apex redirige a `www` sin bucles.
7. Verificar el trayecto de callbacks si el cambio los toca: `POST /api/payments/flow/confirmation` y `/return` sobre el origen canónico (con switches apagados deben responder 503 controlado, no error de plataforma).
8. Registrar el resultado (PASS/FAIL por paso) y el SHA desplegado en `docs/production/` (evidencia sanitizada, sin secretos).

## 4. Criterios de reversión de la aplicación
Revertir si: el smoke falla; error de build o de arranque; Auth o callbacks fallan; el worker de Flow deja de estar sano tras el despliegue; aparece PII en logs.

**Rollback de app 🔒:** reasignar el alias de producción al despliegue anterior registrado en el paso 1 (promoción/rollback de Vercel). No requiere tocar la base si las migraciones eran compatibles hacia atrás. Después: repetir el smoke del §3.6, confirmar worker sano y registrar el incidente. Rollback de base de datos: **no automático**; se planifica aparte (reparación hacia adelante con migración nueva); sin DROP/reset/restauración sobre producción (ver `BACKUP_RESTORE_RUNBOOK.md`).

## 5. Ensayo previo (requerido para el criterio de aceptación 7) — NOT TESTED
En el proyecto de validación: desplegar el SHA A, desplegar el SHA B, revertir a A por el mecanismo elegido, y comprobar (a) que la app A funciona contra el esquema de B, (b) que ningún push a la rama de trabajo publica a producción, (c) que el SHA de cada despliegue es trazable. Registrar tiempos.

## 6. Fuera de alcance de este runbook
Apertura a usuarios reales, Flow productivo, reembolsos ejecutables, transferencias a profesionales y cambios de política comercial (Q/F/T). Requieren un gate posterior y autorización separada.
