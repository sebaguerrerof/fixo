# Inventario de infraestructura — Sprint 06, Etapa 1

Fecha de corte: 2026-11-13. SHA local: `cc2d56e` (rama `codex/sprint-04-job-management`). Estado: **inventario de sólo lectura ejecutado** con la autorización del propietario ("autorizo", 2026-11-13) para Vercel, Supabase de producción y DNS público. **No se creó, cambió ni desplegó nada.** Cloudflare (panel), registrador y Zoho **no** se consultaron (no hay acceso desde aquí): NOT TESTED. Las cuentas de Vercel y Supabase contienen además proyectos ajenos a Fixo; no se inspeccionaron ni se listan.

Leyenda: **VERIFICADO (hoy)** = comprobado en esta pasada; **ANTECEDENTE** = informado por documentos del Sprint 05 y no repetido; **INFERENCIA** = conclusión no confirmada por el proveedor; **PENDIENTE** = requiere acceso o dato del propietario.

## 1. Código y CI (GitHub)

| Elemento | Estado | Detalle |
| --- | --- | --- |
| Repositorio `sebaguerrerof/fixo` | VERIFICADO | Visibilidad **pública** (cambio del propietario el 2026-11-12; plan Etapa 6: no cambiar visibilidad automáticamente). Rama por defecto remota: `codex/sprint-04-job-management`; `main` sólo existe localmente. |
| Workflow `.github/workflows/ci.yml` | VERIFICADO | Jobs `application` y `database`; acciones fijadas por SHA; `actionlint` 1.7.12 sin errores. Sólo existe en esta rama. |
| Ejecución del CI | VERIFICADO — **PASS** (actualizado 2026-11-13, tras el desbloqueo) | Run `43458718551`, intento 3, SHA `cc2d56e`: `Fixo CI / application` y `Fixo CI / database` **success**, con todos los pasos en verde (secrets:check, lint, typecheck, test, build, test:smoke, ambos `npm audit`; `supabase start`, `db reset`, `test db` pgTAP, suite de Postgres embebido y la integración de pagos contra Supabase local aislado). Es la **primera ejecución verde** en la historia. Antes: los intentos 1 y 2 del mismo run fallaron sin arrancar por *"your account is locked due to a billing issue"*. Alcance: es evidencia del SHA `cc2d56e`; el candidato de liberación futuro necesitará su propio run verde. |
| Protección de rama, PR requeridos, secretos de Actions | PENDIENTE | Requiere permisos de administración. El CI sólo usa valores ficticios de build. |

## 2. Aplicación y despliegue (Vercel)

| Elemento | Estado | Detalle |
| --- | --- | --- |
| Cuenta y plan | VERIFICADO — **Hobby** | Equipo personal único, rol OWNER, plan `hobby`. El plan del Sprint 06 (§4) dice que Hobby **no** es base admisible para lanzamiento comercial. **Desviación D1.** |
| Proyecto de producción | VERIFICADO | `fixo-marketplace`, Next.js, Node 24.x, funciones en `iad1` (Washington), creado hace ~92 días. Sin proyecto de validación. |
| Enlace Git | VERIFICADO — **ninguno** | `link: null`: el proyecto no está conectado a GitHub; los despliegues son por CLI y no registran SHA. No hay riesgo de publicación automática por push hoy. |
| Dominios y alias del despliegue vigente | VERIFICADO | Alias `www.soyfixo.cl`, `soyfixo.cl`, `fixo-marketplace.vercel.app` y el alias del equipo. Despliegue vigente: `fixo-marketplace-b886tj5p3-…vercel.app` (`dpl_6iKVzhNq…`), producción, Ready, creado 2026-11-12 16:54 (hora de Chile). Es el despliegue a anotar como referencia de rollback. Varios despliegues de producción por CLI en las últimas 24 h. |
| Protección de despliegues | VERIFICADO | SSO de Vercel activo para despliegues "todos excepto dominios personalizados"; sin contraseña; protección de forks activa. Implica que las URLs `*.vercel.app` están protegidas y `www.soyfixo.cl` público (relevante para callbacks y para el origen protegido de validación). |
| Variables (sólo nombres) | VERIFICADO | Sólo entorno **Production** (ninguna en Preview/Development): `NEXT_PUBLIC_DEMO_MODE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FIXO_APP_URL`, `FIXO_FLOW_MODE`, `FIXO_PAYMENTS_CREATION_ENABLED`, `FIXO_PAYMENTS_NOTIFICATIONS_ENABLED`, `FIXO_PAYMENTS_WORKER_SECRET`, `FIXO_PAYMENTS_SUPABASE_ORIGIN`, `FIXO_FLOW_CALLBACK_ORIGIN`, `FIXO_PAYMENT_TOKEN_KEY`, `FIXO_PAYMENT_TOKEN_KEY_ID`, `FLOW_API_KEY`, `FLOW_SECRET_KEY`, `FIXO_FLOW_SANDBOX_PAYER_EMAIL`. **No definidas:** `FIXO_TRUSTED_IP_HEADER` (decisión abierta) y `FIXO_INVITATIONS_ENABLED`. Un preview de PR no recibiría hoy ninguna variable (nada marcado como Preview). Valores no leídos. |
| Cron/Automatismos de Vercel | VERIFICADO | No hay `vercel.json` ni Vercel Cron (el ejecutor del worker es Supabase Cron). |

## 3. Datos (Supabase, proyecto `rjzyqdhotcshvbdcrgon`)

| Elemento | Estado | Detalle |
| --- | --- | --- |
| Estado y versión | VERIFICADO | "Fixo", `ACTIVE_HEALTHY`, región `ca-central-1` (Canadá), PostgreSQL 17.11, canal GA, creado 2026-08-17. Organización propia de Fixo. Tamaño de la base: 18,1 MB. |
| Plan del proyecto | **INFERENCIA: Free/sin PITR** | La API no devuelve el plan. Ver backups. Debe confirmarlo el propietario. **Desviación D2.** |
| Backups | VERIFICADO — **NINGUNO** | `backups: []`, `pitr_enabled: false` (`walg_enabled: true`). No existe ningún respaldo restaurable en el proveedor. Hoy **no hay RPO medible**. **Desviación D3 (crítica para el criterio 6).** |
| Migraciones | VERIFICADO | 14 locales = 14 remotas, sin diferencias (de `202608170001` a `20261112120000`). Las 5 de pagos están aplicadas y no se editan. |
| Extensiones relevantes | VERIFICADO | `pg_cron`, `pg_net`, `pgcrypto`, `supabase_vault`. (`pgtap` no está instalada en producción: correcto.) |
| Cron | VERIFICADO | Un job: `fixo-payments-worker`, `* * * * *`, activo. |
| Vault (sólo nombres) | VERIFICADO | `fixo_payments_worker_secret`, `fixo_payments_worker_url`. |
| Storage | VERIFICADO | 3 buckets, todos **privados**: `technician-documents` (límite 10 MiB), `service-request-photos` (4 MiB), `job-incident-evidence` (4 MiB). **0 objetos.** |
| Auth | VERIFICADO (parcial) | 5 usuarios (2 originales + 3 sintéticos inertes del Sprint 05). SMTP, Site URL, redirects, MFA y plantillas: PENDIENTE (requieren la API de gestión de Auth, no consultada). |
| Salud del worker de Flow | NO consultado hoy | `payment_worker_health()` sólo es invocable como propietario sin `--read-only`; no se ejecutó. Último valor conocido (Sprint 05): sano. |
| Proyecto de validación | NO EXISTE | Etapa 2. |

## 4. Workers y avisos

| Elemento | Estado | Detalle |
| --- | --- | --- |
| Inspector de documentos | VERIFICADO (archivos) | `scripts/inspection-worker.mjs`, `scripts/lib/inspect-document.mjs`, `ops/inspection-worker.service` (usuario `fixo-inspection`, `PrivateTmp`, `ProtectSystem=strict`, `NoNewPrivileges`, `MemoryMax=3G`). Runbook: `INSPECTION_WORKER_RUNBOOK.md`. **No hay host Linux** (ANTECEDENTE: sin hosting permanente). |
| Notificaciones | VERIFICADO (archivos) | `scripts/notification-worker.mjs`, `scripts/lib/job-notification.mjs`; adaptador `capture` sintético. **No existe** `ops/notification-worker.service` ni adaptador de correo real. |
| Worker de pagos Flow | VERIFICADO (cron activo) | Ejecutor Supabase Cron + pg_net/Vault; sin alertas automáticas. |
| Monitoreo/alertas externos | NO EXISTE | Sin monitor externo, receptor ni responsable. |

## 5. DNS, dominio y correo (resolución pública, 2026-11-13)

| Elemento | Estado | Detalle |
| --- | --- | --- |
| Nameservers | VERIFICADO | `soyfixo.cl` delegado a **Cloudflare** (`megan.ns.cloudflare.com`, `melnicoff.ns.cloudflare.com`). Cloudflare ya es autoritativo: el supuesto del plan (§4) coincide con lo desplegado. Registrador: PENDIENTE. |
| Apex `soyfixo.cl` | VERIFICADO | A `216.198.79.1` y `64.29.17.1` (TTL 300; rango de Vercel). HTTP → `308` a HTTPS; HTTPS → `308` a `https://www.soyfixo.cl/`. Redirect apex→www correcto, sin bucle. |
| `www.soyfixo.cl` | VERIFICADO | CNAME `d10b90791fd2bdc8.vercel-dns-017.com` (TTL 300; valor propio emitido por Vercel). `/login` responde `200`, `Strict-Transport-Security: max-age=63072000`, servido por Vercel. TLS: Let's Encrypt, válido del 2026-11-08 al 2027-02-06 (renovación gestionada por Vercel). |
| MX | VERIFICADO — **ninguno** | `soyfixo.cl` no tiene MX: no se puede recibir correo en el dominio. Zoho Mail no está configurado en el DNS. |
| TXT / SPF / DMARC | VERIFICADO — **ninguno** | Sin SPF y sin `_dmarc`. Sin DKIM publicado (selector desconocido; no verificable por resolución pública sin conocerlo). |
| DS / DNSSEC | VERIFICADO — **sin DS** en `.cl` | DNSSEC no está activado en la delegación. Ningún riesgo de SERVFAIL por DS hoy; si se activa, hay que coordinarlo con el registrador. |
| CAA | NOT TESTED | Las herramientas locales no soportan consultar CAA. Pendiente de leer en el panel de Cloudflare. |
| Panel de Cloudflare (zona, proxy, reglas, tokens), registrador, Zoho Mail, Zoho CPaaS | PENDIENTE | Sin acceso desde esta sesión. |
| SMTP de Supabase Auth | ANTECEDENTE | Runbook `SPRINT_01_SMTP_RUNBOOK.md`; estado real no verificado. |

## 6. Desviaciones respecto al plan

1. **D1 — Vercel Hobby.** Incompatible con lanzamiento comercial según el plan; requiere decidir plan (Pro u otro) y presupuestarlo antes de la Etapa 3.
2. **D2 — Supabase sin plan confirmado.** Probablemente Free (INFERENCIA): sin PITR ni backups.
3. **D3 — Sin respaldos en Supabase** (mitigada parcialmente: respaldo manual cifrado del 2026-11-13, ver `BACKUP_RESTORE_RUNBOOK.md` §9; sigue sin haber respaldos del proveedor ni programados y el respaldo está en el mismo equipo; el 2026-11-13 se ensayó una restauración **local** con PASS y un hallazgo crítico de privilegios, ver `BACKUP_RESTORE_RUNBOOK.md` §10). No hay copia restaurable; el criterio 6 (backups y restore por capas, RPO/RTO medidos) no puede cumplirse sin plan con backups o un respaldo propio y programado (`BACKUP_RESTORE_RUNBOOK.md`). Riesgo CRÍTICO del plan ("backup incompleto") ya materializado como ausencia total.
4. **D4 — RESUELTA el 2026-11-13:** el bloqueo de facturación de GitHub se levantó y el CI pasó en verde (SHA `cc2d56e`). Quedan pendientes la protección de rama y la rama de liberación (D5).
5. **D5 — RESUELTA el 2026-11-13 (con autorización expresa del propietario, por pasos):** se subió `main` (`58ba08a`), se abrió el PR #1 (rama de trabajo → `main`) con el CI verde, se fijó `main` como rama por defecto, se protegió (checks `application` y `database` obligatorios y al día, PR obligatorio con 0 aprobaciones, sin force-push ni borrado, incluye administradores, conversaciones resueltas) y se mergeó el PR con commit de merge (`155ca18`, 38 commits; la rama de trabajo se conserva). **Pendiente:** visibilidad del repositorio (el propietario eligió volver a privado, pero la protección de ramas en repositorios privados exige plan de pago de GitHub: decisión aplazada). Estado previo que originó la desviación (verificado antes de actuar, lectura): en GitHub **solo existe** `codex/sprint-04-job-management`, que es además la rama por defecto; sin protección (`protected=false`, 404 en la API), sin rulesets y sin PR en toda la historia. `main` existe **solo en el equipo local** (`58ba08a`, 2026-11-08, corte de auditoría documental) y, igual que las ramas `codex/sprint-00-5-stabilization`, `sprint-01-identity`, `sprint-02-5-service-marketplace` y `supabase-integration-sprint-02`, **está contenida íntegra** en la rama de trabajo (0 commits propios; la rama de trabajo tiene 38 por delante de `main`): historia lineal, un `main` fast-forward es posible y no se pierde trabajo. Falta decidir la rama de liberación y su protección (PR obligatorio y checks `Fixo CI / application` y `Fixo CI / database`). Nota: la protección de ramas en repositorios **privados** requiere un plan de pago de GitHub; con el repositorio público está disponible.
6. **D6 — Dominio sin correo:** sin MX/SPF/DKIM/DMARC; ni Zoho Mail ni CPaaS están enlazados al DNS. Auth/avisos no pueden enviar con el dominio propio hasta configurarlos (Etapa 4, con autorización de DNS).
7. **D7 — Región:** datos en Canadá (`ca-central-1`) y funciones en `iad1`; usuarios en Chile. Posible latencia y consideración de residencia de datos: decisión del propietario, no se cambió nada.
8. **D8 — Repositorio público** con identificadores de producción (ref de Supabase, UUID y `flowOrder` de Sandbox en manifiestos). Decisión de visibilidad y escaneo del historial: Etapa 6.
9. **D9 — Sin variables Preview/Development** en Vercel: favorable para aislamiento (los previews no heredan claves productivas), pero el proyecto de validación aún debe definirlas.
10. **D10 — `docs/ai/HANDOFF.md` aparecía vacío** por cambio externo (ver HANDOFF); no se restauró.

## 7. Presupuesto

**PENDIENTE.** No se fijan importes (plan §4: sin cotización vigente). Con lo verificado hoy, las partidas relevantes son: Vercel **Pro o equivalente** (hoy Hobby; asientos y uso), Supabase producción con **backups/PITR** y un segundo proyecto de validación (compute, almacenamiento, egreso), host Linux ≥ 4 GiB para ClamAV (no existe), Zoho Mail (casillas) y CPaaS (volumen), Cloudflare (hoy ya en uso; plan sin confirmar), monitor externo, almacenamiento externo cifrado de respaldos, impuestos y sobreconsumo, más alertas/límites de gasto de cada proveedor. Cotizar con precios vigentes antes de contratar.

## 8. Responsables y decisiones pendientes

Del propietario (plan §3): (1) titulares/administradores/recuperación de cada cuenta (registrador, Cloudflare, Vercel, GitHub, Supabase, Zoho) y confirmación de planes; ¿existe servidor Linux?; (2) casillas, remitente transaccional, soporte y destinatarios de prueba; (3) presupuesto, volumen, responsable operativo, canal de alertas y cobertura; (4) RPO/RTO, retención y destino externo de respaldo; (5) plan comercial de Vercel y procedimiento de liberación. Nuevas decisiones surgidas del inventario: plan de Supabase con backups (D3), plan de Vercel (D1), región (D7) y resolución del bloqueo de facturación de GitHub (D4).

## 9. Qué quedó sin consultar (NOT TESTED)
CAA; panel de Cloudflare (registros completos, proxy, reglas, tokens, DNSSEC); registrador; Zoho; plan y facturación de Supabase y Vercel; configuración de Auth (SMTP, Site URL, redirects, MFA); salud actual del worker de Flow; protección de rama de GitHub; límites de gasto de los proveedores.
