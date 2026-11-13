# HANDOFF — Sprint 06 (Infraestructura, servicios y preparación para producción)

Última actualización: 2026-11-13. Implementador: Claude Code. Plan: `docs/ai/PLAN.md` (copia en `docs/production/SPRINT_06_IMPLEMENTATION_PLAN.md`).

**Nota sobre este archivo.** Al empezar el Sprint 06, `docs/ai/HANDOFF.md` estaba vacío en el árbol de trabajo (cambio externo: 561 líneas eliminadas respecto a `HEAD`). El plan (§2) indica no restaurar ni sobrescribir cambios ajenos, y no había contenido que sobrescribir; este archivo se reinició con el Sprint 06. El HANDOFF completo del Sprint 05 sigue íntegro en Git: `git show HEAD:docs/ai/HANDOFF.md` (y en `docs/production/SPRINT_05_REPORT.md` y `SPRINT_05_CODEX_REVIEW_PACKAGE.md`). No se hizo `commit`: `PLAN.md` y este archivo figuran modificados por cambios externos y el plan no autoriza push/merge.

## 1. Estado

**Sprint 06 iniciado; Etapa 1 parcial (sólo lo comprobable sin autorización externa).** Nada remoto fue consultado, creado ni modificado. Sin contratación, DNS, correo externo, migraciones, despliegue ni cambios de producción. Pagos reales siguen apagados (sin cambios).

### Por qué no se avanza más (el plan lo exige)
El plan §1 dice que su aprobación **autoriza documentarlo, no implementar recursos remotos**: crear/modificar servicios, DNS/nameservers/Auth/SMTP, correo externo, push/merge, migraciones remotas, workers y despliegues requieren autorización específica. Las etapas 2 a 6 están casi enteramente en ese terreno; la Etapa 1 necesita además "inventario de sólo lectura autorizado" y decisiones del propietario (titulares, presupuesto, RPO/RTO). No hay contradicción entre el plan y el código real que impida seguir; hay **autorizaciones y datos pendientes**.

## 2. Cambios realizados (sólo documentación, sin código)

| Archivo | Contenido |
| --- | --- |
| `docs/production/SPRINT_06_IMPLEMENTATION_PLAN.md` | Copia literal de `docs/ai/PLAN.md` (entregable del plan §6). |
| `docs/production/INFRASTRUCTURE_INVENTORY.md` | Inventario parcial fechado: lo verificado hoy (repositorio local, API pública de GitHub) separado de antecedentes del Sprint 05 y de lo PENDIENTE/NOT TESTED; desviaciones, presupuesto sin importes y decisiones pendientes. |
| `docs/production/ENVIRONMENT_MATRIX.md` | Matriz de variables por destino (producción, validación, preview/fork, CI, workers), sólo nombres; pruebas de aislamiento exigidas (NOT TESTED). |
| `docs/production/LAUNCH_RUNBOOK.md` | Borrador de liberación/reversión: precondiciones con estado actual, mecanismo manual (CLI o enlace Git con producción manual), procedimiento, criterios y pasos de rollback, ensayo previo. Todo NOT TESTED. |
| `docs/production/BACKUP_RESTORE_RUNBOOK.md` | Borrador de respaldo/restauración por 5 capas (datos, Auth, Storage, configuración, claves), restore aislado con cron/envíos apagados, RPO/RTO propuestos (por aprobar). NOT TESTED. |
| `docs/production/MONITORING_RUNBOOK.md` | Borrador de qué vigilar, umbrales propuestos, consulta manual de salud de Flow, monitor externo, pruebas de alertas y guía de respuesta. NOT TESTED. |
| `docs/ai/HANDOFF.md` | Este archivo. |

No se creó `vercel.json`, no se añadieron dependencias, no se tocaron migraciones ni código.

## 2b. Inventario de sólo lectura ejecutado (2026-11-13, tras "autorizo")
Alcance autorizado por el propietario (interpretado como el inventario de sólo lectura que se pidió): Vercel, Supabase de producción y DNS público. Sin escrituras, sin recursos creados. Resultado completo en `docs/production/INFRASTRUCTURE_INVENTORY.md`. Hallazgos principales:
- **Vercel: plan Hobby** (no admisible para lanzamiento comercial según el plan); proyecto sin enlace Git (despliegues por CLI, sin SHA); variables sólo en Production; sin `FIXO_TRUSTED_IP_HEADER` ni `FIXO_INVITATIONS_ENABLED`; despliegue vigente identificado para rollback.
- **Supabase: sin ningún respaldo** (`backups: []`, PITR apagado; plan probablemente Free, sin confirmar). 14/14 migraciones sincronizadas; cron activo; 3 buckets privados, 0 objetos; región `ca-central-1`.
- **DNS:** ya delegado a Cloudflare; apex→www con 308 correcto; TLS válido hasta 2027-02-06; **sin MX, SPF, DKIM ni DMARC**; sin DS (DNSSEC off). CAA no comprobado.
- **GitHub:** CI sigue bloqueado por facturación.
- No consultado: panel Cloudflare, registrador, Zoho, plan/facturación de proveedores, Auth (SMTP/redirects/MFA), salud actual del worker de Flow.
Los runbooks de respaldo y la matriz de entornos se actualizaron con estos hallazgos.

## 2c. CI de GitHub: primera ejecución verde (2026-11-13)
Tras levantarse el bloqueo de facturación, `gh run rerun 43458718551` (intento 3, SHA `cc2d56e`) terminó en **success**: `application` (secrets:check, lint, typecheck, test, build, test:smoke, `npm audit` prod y completo) y `database` (`supabase start`, `db reset`, `test db`, `test-payments-postgres.mjs`, integración de pagos local aislada). Es la primera ejecución real del workflow y confirma de forma independiente la evidencia local del Sprint 05 para ese SHA. No cubre commits posteriores (`c7762af`, `b5b2ce9`, `dc93050`, etc. son sólo de documentación o ya estaban incluidos en `cc2d56e`; cualquier SHA candidato de liberación necesita su run). Resuelve la desviación D4; criterio de aceptación 2 del Sprint 06: CI real verde del candidato, **cumplido para `cc2d56e`**, y sigue pendiente la validación aislada y la protección de rama.

## 2d. Respaldo manual de producción (2026-11-13, autorizado: "si hazlo")
Sólo lectura sobre producción (`db dump`); sin cambios remotos. 76 tablas y 1 708 filas, verificadas contra conteos exactos en vivo (coinciden, salvo 1 fila esperable del cron en `payment_worker_ticks`); esquema con 43 tablas, 15 políticas, 130 funciones y 21 triggers. Cifrado AES-256 con descifrado verificado; **texto plano borrado**; archivo y clave en carpetas locales distintas **fuera del repositorio** (`C:/Users/sebag/fixo-backups/` y `C:/Users/sebag/fixo-backup-keys/`). Evidencia sanitizada en `docs/production/sprint-06-evidence/prod-backup-2026-11-13.json`; detalle y límites en `BACKUP_RESTORE_RUNBOOK.md` §9. **Límites:** mismo equipo (no es copia externa), clave no separada de verdad, **restore no ensayado**, sin Vault ni configuración de Auth, puntual (no programado). Efecto lateral local: arranqué Docker Desktop (estaba apagado) para `pg_dump`; sigue abierto. Mi primer intento con rutas `/c/...` creó archivos vacíos que luego se sobrescribieron.

## 2e. Ensayo de restauración local (2026-11-13, autorizado: "Sí, ensaya la restauración en local")
Destino: contenedor Docker efímero y aislado (loopback, `supabase/postgres:17.11.0.018`), eliminado al terminar junto con el texto plano descifrado; el stack local que ya existía (`supabase_*_fixo`) no se tocó; producción sólo en lectura. **PASS local con hallazgos** (detalle en `BACKUP_RESTORE_RUNBOOK.md` §10 y `sprint-06-evidence/restore-rehearsal-2026-11-13.json`):
- Conteos: 76/76 tablas, 1 708/1 708 filas; digests idénticos en 13 tablas clave; estructura idéntica (43 tablas, 15 políticas, 130 funciones, 21 triggers, RLS).
- **Hallazgo crítico:** la restauración ingenua dejó **79/130 funciones y 11/43 tablas más permisivas que producción** (p. ej. `anon` ejecutaba `payment_prepare`); causa: `pg_dump` + `pg_default_acl` del destino. Remedio probado (reconciliación con instantánea de privilegios de producción → 130/130 y 43/43 idénticas). El respaldo del 2026-11-13 **no incluye** esa instantánea: debe añadirse al procedimiento.
- Auth/Storage exigen que GoTrue/storage-api hayan migrado el esquema antes de cargar datos (apliqué sus migraciones en el destino).
- La copia no tenía jobs de cron ni conexiones salientes.
- **Errores míos durante el ensayo:** mi primer chequeo dio "0 errores" con 0 filas cargadas (filtro sólo de la palabra ERROR y conversión de rutas de Git Bash); lo detecté al comparar conteos y lo rehice; mis primeros conteos de Auth/Storage fallaron por esquemas sin migrar.
- **NOT TESTED:** inicio de sesión con usuario restaurado, la app contra la copia, restauración en proyecto hospedado, Vault/configuración de Auth, RPO/RTO (la sesión tomó ~4 min con 18 MB, no es un RTO). Criterio 6 del plan: **sigue sin cumplirse**.

## 2f. Instantánea de privilegios incorporada al procedimiento de respaldo (2026-11-13, autorizado: "Añade la instantánea de privilegios...")
- **Herramientas nuevas** (sin dependencias, sin cambios de esquema ni de producción): `scripts/backup/privilege-snapshot.mjs` (solo lectura, `--read-only`), `scripts/backup/privilege-reconcile.mjs` (genera SQL; no se conecta a nada; falla con `RAISE` si queda cualquier diferencia), `scripts/backup/privileges-lib.mjs` (+ `.d.mts`) y `src/integrations/backup/privileges.test.ts` (5 tests). Procedimiento en `BACKUP_RESTORE_RUNBOOK.md` §3 (paso 4), §4 (verificación obligatoria) y §11.
- **Instantánea real tomada** de producción (175 objetos), **cifrada con la clave del respaldo** y con descifrado verificado: `fixo-prod-privileges-2026-11-13.json.enc`; texto plano borrado. Evidencia sin datos en `sprint-06-evidence/prod-backup-2026-11-13.json`.
- **Validación en una restauración efímera nueva** (contenedor eliminado): verificación falla antes (90 objetos distintos = el hallazgo), reconciliación pasa, verificación posterior pasa, una manipulación (EXECUTE a `anon`, TRUNCATE a `authenticated`) y un objeto ausente se detectan, y la reconciliación repara la manipulación.
- **Errores míos corregidos durante la construcción:** identidades truncadas a 63 bytes por una columna `name` en un `UNION`, y dependencia del `search_path`; los detectó la propia verificación. Un parche mío de Python falló sin aplicar nada y lo rehice con ediciones directas.
- Verificado: `tsc` y `eslint .` limpios; vitest completo 389 PASS / 8 omitidos (incluye los 5 tests nuevos). NOT TESTED: secuencias, privilegios por columna, ejecución en un proyecto Supabase hospedado.
- Nada subido: sin commit ni push (el plan no los autoriza); archivos nuevos sin versionar.

## 3. Comprobaciones hechas hoy (VERIFICADO)
- Repositorio local: scripts de `package.json`, `.node-version` (24.22.2), 14 migraciones, `ops/inspection-worker.service`, `scripts/*worker*.mjs`, `.env.example`, ausencia de `vercel.json` y de `ops/notification-worker.service`.
- GitHub (API pública, sólo lectura): repositorio **público**, rama por defecto `codex/sprint-04-job-management`; el run de CI `43458718551` (SHA `cc2d56e`) falló sin arrancar por el bloqueo de facturación en los intentos 1 y 2 y **pasó en verde en el intento 3** (ver §2c).

## 4. Pruebas
No aplican: no hubo cambios de código. No se ejecutaron `lint`/`typecheck`/`test` en esta pasada (sin cambios que validar). La evidencia de pruebas del Sprint 05 no se reutiliza como evidencia nueva (plan Etapa 1).

## 5. Riesgos y pendientes (para el propietario / Codex)

**Autorizaciones que necesito, por separado y con alcance explícito** (cada una desbloquea trabajo concreto):
1. ~~Inventario de sólo lectura~~ **hecho** para Vercel, Supabase y DNS público; falta Cloudflare (panel), registrador y Zoho (sin acceso desde aquí: lo aporta el propietario).
2. Crear el proyecto Supabase y el proyecto Vercel de **validación** y su presupuesto (Etapa 2).
3. ~~Bloqueo de facturación de GitHub~~ **resuelto**; CI verde para `cc2d56e`. Pendiente: proteger la rama y decidir la rama de liberación.
4. Cualquier cambio de DNS/NS/DS/MX, Auth/SMTP, correo externo, workers y despliegue: autorización específica y ventana, ya preparado su paquete (Etapa 4 y 5).

**Datos que sólo el propietario puede dar** (plan §3, puntos 1–5): titulares/administradores/planes/regiones/recuperación de cada servicio y si existe un servidor Linux; casillas y remitente transaccional; presupuesto, volumen y canal de alertas; RPO/RTO y destino de respaldo; procedimiento de liberación Vercel/GitHub.

**Riesgos abiertos visibles**: repositorio público con identificadores de producción en manifiestos (decisión de visibilidad y escaneo del historial pendiente, Etapa 6); rama por defecto remota = rama de trabajo; plan de Vercel (¿Hobby?) y de Supabase sin inventariar; no hay monitor externo, host de workers ni adaptador de correo real; `FIXO_TRUSTED_IP_HEADER` sin definir; clave de tokens Flow única (rotación sin drenar rompe tokens pendientes).

**Heredados del Sprint 05 (limitaciones, no resueltas aquí):** orden externa Sandbox `11657296` pendiente (aceptada); escenarios Sandbox sin evidencia real (anulado, duplicado, respuesta de creación perdida, mismatch, consulta fallida, orden callback/retorno); notificaciones sólo `capture`; inspector sin hosting permanente; restauración integral y staging sin acreditar.

## 6. Siguiente paso recomendado
Con las autorizaciones 1 y 3 (y los datos de §5), completar el inventario de lectura y el presupuesto (cierra Etapa 1). Los tres runbooks (LAUNCH, BACKUP_RESTORE, MONITORING) quedaron redactados como borradores NOT TESTED. **No** se hizo el diseño del adaptador CPaaS (depende de verificar contrato, región y capacidad de la cuenta, que requieren acceso a Zoho). Discrepancia detectada: `CI_VERCEL_RELEASE_PLAN.md` menciona la CLI Supabase 3.0.0 y `ci.yml` usa 3.1.0 (no se cambió nada; anotada en el LAUNCH_RUNBOOK).

## Corrección de la revisión de Codex (1 ALTO, 2 MEDIOS) — instantánea de privilegios — 2026-11-13
Sólo herramientas y documentación de respaldo; sin cambios de esquema ni de producción (sólo lecturas `--read-only` para volver a tomar la instantánea).
1. **ALTO, objetos extra y snapshot incompleta.** La verificación compara ahora **en ambas direcciones**: falla si el destino tiene en `public`/`private` un objeto que el origen no tenía (excepciones sólo explícitas, `--allow-extra`), si falta alguno, o si difiere un privilegio. La instantánea (versión 2) lleva tipo, proyecto, fecha, esquemas, roles, **conteos y digest**; `parseSnapshot` rechaza versión distinta, falta de un esquema, conteos o digest incorrectos: una fila sola o un recorte no generan SQL. Los objetos de extensiones se excluyen a propósito en ambos lados. Pruebas con PostgreSQL real: función extra ejecutable por `anon` (ambos modos; el reconcile fallido no cambia nada), tabla/secuencia extra, excepción explícita y parcial, instantáneas recortadas/editadas/antiguas.
2. **MEDIO, WITH GRANT OPTION.** Se registra (`rol:PRIV:GRANT`, con `bool_or` entre otorgantes), se compara, se concede con `with grant option` y se revoca si sobra. Pruebas PostgreSQL con diferencia **únicamente** en esa opción, en las dos direcciones, y mutación que lo confirma.
3. **MEDIO, metadatos como SQL.** `project` (ref de 20 caracteres), `takenAt` (ISO), `kind` y `version` se validan estrictamente y además se fuerzan a una línea antes del comentario; ni en modo normal ni en `--verify-only` puede aparecer una sentencia antes de `BEGIN`. Pruebas con saltos de línea en ambos campos (unitarias y PostgreSQL).
4. **Adicional mío (no estaba en la revisión):** la reconciliación ejecutaba `format('revoke ... %s', r.o)` con el texto de la instantánea: una instantánea manipulada podía inyectar SQL por el nombre del objeto. Ahora el DDL usa identificadores resueltos del catálogo del destino por OID; prueba PostgreSQL con un nombre `…; create table pwned…` (no se crea nada).
- **Reemplazo del archivo cifrado:** la instantánea v1 ya no la acepta la herramienta; se volvió a tomar de producción (v2, 175 objetos, digest `67968b49…`), se cifró con la misma clave (descifrado verificado) y reemplazó a la v1; texto plano borrado.
- **Validación real:** en una restauración efímera con el esquema real: verificación falla antes (90 objetos distintos), reconcilia OK, verificación OK (175), una función extra y una diferencia sólo en la delegación se detectan. Pruebas de mutación: sin la comprobación de extras y sin la opción de delegación los tests fallan.
- **Resultados:** `tsc` y `eslint .` limpios; vitest 393 PASS / 8 omitidos; `scripts/test-privilege-reconcile.mjs` 9/9 PASS (PostgreSQL 17.11 embebido); `actionlint` OK tras añadir el paso al job `database` de `ci.yml`.
- **Errores míos durante la corrección:** la herramienta de escritura convirtió `\u2028` en un carácter real y rompió una expresión regular (detectado por `node --check`); dos parches de Python abortaron sin aplicar nada y se rehicieron con ediciones directas.
- **NOT TESTED:** el nuevo paso en GitHub Actions (sin push); privilegios por columna; roles distintos de los cuatro; ejecución en un proyecto Supabase hospedado. Sin commit ni push.

