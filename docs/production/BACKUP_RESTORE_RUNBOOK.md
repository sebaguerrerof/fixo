# Runbook de respaldo y restauración — Sprint 06 (borrador, NOT TESTED)

Fecha: 2026-11-13. Estado: **borrador sin ejecutar**. Amplía `SPRINT_04_BACKUP_AND_RESTORE_PLAN.md`. Evidencia existente: un ensayo **local** del Sprint 04 (PASS local: 37 tablas, 406 filas sintéticas, digests iguales, con Auth y Storage como contratos SQL mínimos) y una restauración SQL sintética del Sprint 05. **Ninguno acredita recuperación integral del proyecto hospedado.** Estado de la recuperación integral de Fixo: **NOT TESTED / BLOCKED** hasta tener destino aislado, accesos y autorización 🔒.

**Hallazgo del inventario (2026-11-13): el proyecto de producción no tiene ningún respaldo restaurable** (`backups: []`, PITR desactivado; plan probablemente Free, sin confirmar). Hoy no hay RPO medible ni punto de restauración en el proveedor; cualquier dato de producción depende de que se haga un respaldo propio (§3) o de contratar un plan con backups. Ver desviación D3 en `INFRASTRUCTURE_INVENTORY.md`.

**Respaldo manual ejecutado el 2026-11-13 (autorizado por el propietario)**: ver §9. Cubre sólo parte de las capas 1 y 2 y **no** sustituye un respaldo programado ni una restauración ensayada.

## 1. Objetivos (propuestos, pendientes de aprobación del propietario)
- RPO 24 h y RTO 8 h como punto de partida (plan §3). **No** se asume que sirvan para cobros reales; se miden en el ensayo y se aprueban o se ajustan.
- Retención de respaldos, retención de logs, retención de documentos y **destino externo** de la copia: decisión del propietario (PENDIENTE).

## 2. Capas a respaldar (una copia de la base no recupera las demás)
| Capa | Qué contiene | Método previsto | Estado |
| --- | --- | --- | --- |
| 1. Esquema y datos | tablas `public` y `private` (jobs, pagos, órdenes, eventos, outbox, inspección) | volcado con la CLI de Supabase fijada (roles, esquema, datos); revisar antes qué excluye | NOT TESTED en el proyecto hospedado |
| 2. Auth | usuarios, identidades, sesiones según alcance soportado | alcance de la exportación de la CLI; documentar lo que **no** se recupera (p. ej. sesiones, contraseñas sólo si el volcado lo cubre) | NOT TESTED |
| 3. Objetos Storage | buckets privados (documentos profesionales, evidencia de trabajos) y metadatos | exportación por API con **manifiesto** (bucket/ruta/hash/tamaño/conteo), independiente del volcado de la base | NOT TESTED |
| 4. Configuración | Auth (redirects, Site URL, plantillas, SMTP), proveedores, cron y Vault, DNS, variables de Vercel | exportar lo exportable; para secretos, sólo **nombres y ubicación** (nunca valores en Git ni en evidencias) | NOT TESTED |
| 5. Claves | clave de tokens Flow (`FIXO_PAYMENT_TOKEN_KEY*`), secreto del worker, claves de cifrado de respaldos | guardadas por un canal **separado** del contenido respaldado; sin ellas, tokens cifrados y respaldos cifrados son irrecuperables | PENDIENTE (responsable y canal por definir) |

Reglas: cifrar todo respaldo; copia **fuera del host y del proveedor** que aloja la base; acceso mínimo y registrado; retención definida; no confundir la copia automática del proveedor con un respaldo independiente.

## 3. Procedimiento de respaldo 🔒
1. Aprobar ventana, destino, presupuesto, responsable y acceso mínimo. Obtener la conexión a la base desde un gestor de secretos; **no** en chat, argumentos visibles ni Git. No cambiar la contraseña de la base ni pausar proyectos.
2. Verificar versiones (CLI `supabase@3.1.0` fijada en el CI; los comandos de la CLI 3 son locales por defecto, los cambios hospedados piden consentimiento: no reutilizar comandos de memoria).
3. Capa 1 y 2: volcado y verificación de tamaño/legibilidad. Capa 3: exportar objetos con manifiesto y hash. Capa 4: exportar configuración (sin valores de secretos). Capa 5: confirmar que las claves son recuperables por otro canal.
4. **Instantánea de privilegios (obligatoria; ver §11).** Con el mismo `--remote` de solo lectura: `node scripts/backup/privilege-snapshot.mjs --project <ref> --out <archivo.json>`. Registra, para `anon`, `authenticated`, `service_role` y `PUBLIC`, los privilegios exactos de los esquemas, funciones, tablas, vistas y secuencias de `public` y `private`. No contiene datos, pero describe la postura de seguridad: se cifra y se guarda **junto al respaldo con la misma clave**. Sin ella, un destino restaurado no se puede dar por equivalente a producción.
5. Cifrar, subir a destino externo, registrar fecha/SHA de migraciones/versiones y **hash de cada artefacto** (volcado e instantánea). Retener según la política aprobada.
6. Registrar tiempo total (insumo del RPO) y cualquier paso manual.

## 4. Procedimiento de restauración 🔒 (siempre en destino aislado)
1. Destino: **proyecto o clúster vacío y autorizado, nunca Fixo producción**. Antes de cualquier dato: cron, pg_net, SMTP, webhooks de salida y workers **apagados** (evita correos y cobros involuntarios).
2. Restaurar roles/esquema/datos adaptando extensiones y roles al destino administrado; restaurar objetos de Storage con su manifiesto; restaurar configuración de Auth/SMTP con valores propios del destino; recargar secretos del destino (no los de producción).
3. Verificar, con evidencia:
   - conteos y digests por tabla; constraints; migraciones aplicadas;
   - RPC, RLS y grants (probar con una identidad ajena: debe fallar cerrado);
   - Auth: identidad sintética conocida, JWT/REST/Storage; sesiones según alcance soportado (documentar lo no recuperado);
   - objetos: conteo y hash contra el manifiesto, URLs firmadas nuevas;
   - pagos: órdenes, intentos, eventos y `flow_cost_clp` coinciden; tokens cifrados sólo descifran si la clave recuperada es la correcta; **ninguna** reconciliación automática se activa;
   - la app (versión del SHA respaldado) arranca contra el destino con sus propias claves.
   - **privilegios (obligatorio antes de abrir el destino a cualquier tráfico):** reconciliar y verificar con la instantánea (§11). Si la verificación falla, el destino **no** se considera restaurado.
4. Medir RTO (desde la decisión de restaurar hasta la app verificada) y RPO (antigüedad del dato respaldado frente al evento). Registrar pasos manuales y fallos.
5. Documentar **límites reales**: un restore SQL sintético no equivale a recuperación integral; no declarar éxito sin las capas 2 a 5.

## 5. Datos y privacidad del ensayo
Sin copias de PII productiva en validación (plan §3). El ensayo usa datos y archivos **sintéticos**, incluidos documentos reales sintéticos para validar hashes. Si se necesitara restaurar un respaldo productivo para ensayar, requiere autorización específica y un destino con controles equivalentes a producción.

## 6. Reversión de aplicación vs. base
Revertir Vercel no deshace migraciones. Tras un commit de migración se prefiere reparación hacia adelante. Una restauración sobre producción es el último recurso, con decisión explícita del propietario y nunca automática.

## 7. Criterios de salida (plan, criterio 6) — todos NOT TESTED
Respaldo y restauración por capas ensayados; RPO/RTO medidos y aceptados; claves recuperables; límites documentados.

## 8. Pendientes para ejecutar
Autorización del ensayo, proyecto de validación, destino externo cifrado, presupuesto, responsable de restauración, política de retención, y RPO/RTO aprobados.

## 9. Respaldo manual del 2026-11-13 (primer punto de recuperación existente)
**Qué se hizo** (sólo lectura sobre producción; CLI `supabase@3.1.0` con `db dump --remote`, Docker Desktop local para `pg_dump`): roles (`01`), esquema `public` y `private` (`02`: 43 tablas, 15 políticas, 130 funciones, 21 triggers, RLS y grants), datos de `public` y `private` con `COPY` (`03`) y datos de `auth` y `storage` (`04`). 76 tablas, **1 708 filas**. Verificación: conteo exacto en vivo de las 80 tablas de esos esquemas frente a cada bloque `COPY`; coincide todo salvo `private.payment_worker_ticks` (1 426 frente a 1 427: el cron inserta una fila por minuto). No se volcaron `auth.schema_migrations` ni `storage.migrations` (internas de Supabase). Storage: **0 objetos** (nada que exportar).

**Cifrado y custodia:** `tar` de los 4 archivos cifrado con AES-256-CBC, PBKDF2 con 600 000 iteraciones y sal aleatoria; descifrado de prueba con hash idéntico; texto plano **borrado**. El archivo cifrado y su SHA-256 están en `C:/Users/sebag/fixo-backups/` y la clave (aleatoria, 48 bytes) en `C:/Users/sebag/fixo-backup-keys/`, ambas **fuera del repositorio**. Evidencia sanitizada (sin datos): `docs/production/sprint-06-evidence/prod-backup-2026-11-13.json`.

**Limitaciones (NOT TESTED / incumplido):**
- **No es independiente del equipo:** archivo y clave están en el **mismo equipo**; el plan exige copia **fuera del host** y clave por un canal separado. Falta mover la clave a un gestor de contraseñas y subir el archivo cifrado a un destino externo (decisión del propietario).
- **Restauración NO ensayada:** no se restauró en ningún destino. No hay RPO/RTO medidos.
- **No incluye:** Vault (sólo existen los nombres `fixo_payments_worker_secret` y `fixo_payments_worker_url`), configuración de Auth/SMTP/redirects, variables de Vercel, DNS (documentado en el inventario), ni la definición del cron (está en `supabase/ops/payments-worker-cron.sql`). `roles` contiene sólo ajustes de rol.
- Contiene datos personales (5 usuarios de Auth). Retención y destrucción: política por definir.
- Es un respaldo **puntual**: no hay programación; el siguiente depende de repetir el procedimiento o de un plan con backups.
- **Instantánea de privilegios (formato v2, con `WITH GRANT OPTION`, conteos y digest):** se tomó **después** del volcado, el mismo día (175 objetos, digest `67968b49…`), y se guardó cifrada aparte: `fixo-prod-privileges-2026-11-13.json.enc` (+ `.sha256`) en `C:/Users/sebag/fixo-backups/`, con la misma clave. Sustituye a una primera instantánea v1 que la herramienta endurecida ya no acepta. Como producción no cambió de privilegios entre ambos momentos (no hubo migraciones), es válida para este respaldo; en respaldos futuros debe tomarse en la misma ventana que el volcado.

## 10. Ensayo de restauración local del 2026-11-13 (PASS local con hallazgos)
Evidencia sanitizada: `docs/production/sprint-06-evidence/restore-rehearsal-2026-11-13.json`. Destino: contenedor Docker efímero y aislado (`127.0.0.1`, imagen `supabase/postgres:17.11.0.018`), eliminado al terminar junto con el texto plano descifrado. Producción sólo se leyó (`--read-only`) para comparar.

**Resultado:** 76 de 76 tablas con el mismo conteo (1 708 de 1 708 filas); digests de contenido idénticos en 13 tablas clave (pagos, trabajos, perfiles, avisos); estructura idéntica (43 tablas, 15 políticas, 130 funciones, 21 triggers, 43 con RLS); tras reconciliar privilegios, 130/130 funciones y 43/43 relaciones con los mismos permisos que producción. Con identidades ajenas: `anon` denegado, un usuario autenticado ajeno ve 0 trabajos y no accede a `private.payment_*`. La copia no tenía **ningún job de cron** ni conexiones salientes (no puede enviar nada ni llamar al worker de producción).

### Hallazgos (importantes para una restauración real)
1. **Una restauración ingenua ensancha los privilegios (crítico de seguridad).** El volcado emite `REVOKE … FROM PUBLIC` y `GRANT … TO authenticated`, pero no revoca a `anon` ni a `service_role`: `pg_dump` supone los privilegios por defecto del origen y el destino aplica otros (`pg_default_acl`). En la copia, **79 de 130 funciones y 11 de 43 tablas quedaron más permisivas** (p. ej. `anon` podía ejecutar `payment_prepare` y `payment_sandbox_account_set`, `anon`/`authenticated` tenían `TRUNCATE`/`REFERENCES` sobre tablas con RLS). El mismo riesgo existe en un proyecto Supabase nuevo. **Remedio probado:** tomar una instantánea de privilegios de producción (funciones, tablas, vistas y secuencias de `public` y `private`, para `anon`, `authenticated`, `service_role` y `PUBLIC`) y, tras cargar el esquema, hacer `REVOKE ALL … FROM public, anon, authenticated, service_role` por objeto y volver a conceder exactamente lo de la instantánea; después comparar de nuevo (0 diferencias). **Regla:** no abrir ningún destino restaurado a tráfico sin esta verificación; y el respaldo debe incluir la instantánea de privilegios (ya incorporada al procedimiento de respaldo en §3 y §11; el respaldo del 2026-11-13 original no la incluía, por lo que se tomó una instantánea de producción el mismo día y se guardó cifrada aparte: §9).
2. **Auth y Storage requieren que sus servicios hayan migrado antes de cargar los datos.** En una base sin las migraciones de GoTrue/storage-api, `auth.users` y `refresh_tokens` fallan por columnas inexistentes y `storage.*` no existe. Orden correcto: destino con los servicios al día → cargar datos de `auth` y `storage`. Versiones: GoTrue v2.197.0 dejó `auth.schema_migrations` en 82 (igual que producción); storage-api v1.90.1 en 81 frente a 80 (desfase menor; en un destino real, usar las versiones que ejecute el proyecto).
3. **Los mensajes de éxito engañan.** `psql` devolvió "0 errores" cuando no cargó nada (ruta inexistente). Verificación obligatoria tras cada carga: conteos por tabla, digests y estructura contra el manifiesto; nunca confiar en la ausencia de errores.
4. El cron no viaja en el respaldo: el job `fixo-payments-worker` se recrea a mano (`supabase/ops/payments-worker-cron.sql`) **sólo** cuando se decida reactivar, con los secretos del destino. Por defecto la restauración queda con cron y envíos apagados.

### Límites (NOT TESTED)
Inicio de sesión con un usuario restaurado; la aplicación contra la copia; objetos de Storage (producción tiene 0); Vault y configuración de Auth/SMTP (fuera del respaldo); restauración en un proyecto Supabase hospedado; **RPO/RTO**: la sesión completa tomó unos 4 minutos con base de 18 MB en local, incluidos diagnóstico y correcciones; no es un RTO utilizable. El criterio de aceptación 6 sigue **sin cumplirse** (falta copia externa, restore hospedado y objetivos medidos y aprobados).

## 11. Instantánea de privilegios: herramientas y uso (añadido el 2026-11-13; endurecido tras la revisión de Codex)
**Por qué:** ver el hallazgo 1 del §10. `pg_dump` + los privilegios por defecto del destino dejan permisos de más; la restauración debe reconciliarlos y **demostrar** que quedaron idénticos **en ambas direcciones**.

**Herramientas** (solo lectura sobre el origen; sin dependencias nuevas):
- `scripts/backup/privilege-snapshot.mjs --project <ref> --out <archivo.json>`: consulta con `--read-only` mediante la CLI fijada (`supabase@3.1.0`); no sobrescribe un archivo existente. Alcance: esquemas `public` y `private` (funciones, tablas, vistas, vistas materializadas, secuencias y los propios esquemas), para `PUBLIC`, `anon`, `authenticated` y `service_role`, **incluida la opción `WITH GRANT OPTION`** (`rol:PRIV:GRANT`). Los objetos que pertenecen a una extensión se excluyen en origen y destino (los gestiona la extensión). El documento es **versión 2** y trae tipo, proyecto, fecha, esquemas, roles, **conteos por tipo y un digest SHA-256 de las filas**. (Al 2026-11-13: 175 objetos = 2 esquemas + 130 funciones + 43 tablas, 0 secuencias.)
- `scripts/backup/privilege-reconcile.mjs --snapshot <archivo.json> --out <archivo.sql> [--verify-only] [--allow-extra <lista.json>]`: **no se conecta a nada**; genera un SQL que se revisa y se ejecuta a mano en el destino con su rol propietario (`supabase_admin`/`postgres`). Una sola transacción que **falla con `RAISE` y revierte todo** si:
  1. falta en el destino algún objeto de la instantánea;
  2. el destino tiene un objeto **extra** en `public`/`private` que el origen no tenía (aunque no conceda nada: se investiga). Excepciones solo explícitas con `--allow-extra` (lista JSON de `"<tipo> <identidad>"`; un objeto extra permitido no se corrige ni se compara);
  3. tras reconciliar, cualquier privilegio **o opción de delegación** de los cuatro roles difiere de la instantánea.
  En modo normal revoca `ALL` a `PUBLIC`, `anon`, `authenticated` y `service_role` por objeto y concede exactamente lo de la instantánea (con `WITH GRANT OPTION` donde corresponde); `--verify-only` solo comprueba. Éxito: `OK: N objetos con privilegios idénticos a la instantánea (incluida la opción de delegación)`.
- **Validación estricta** (`parseSnapshot`): rechaza versión distinta, proyecto que no sea una ref de 20 caracteres, fecha no ISO, esquemas/roles distintos, filas malformadas o con caracteres de control, privilegios fuera de los cuatro roles, falta de alguno de los dos esquemas, conteos que no coinciden y digest alterado: una instantánea recortada o editada **no genera SQL**. Los metadatos se validan y, además, se fuerzan a una línea antes de ir al comentario inicial, así que no pueden introducir sentencias fuera de la transacción.
- **El DDL no usa el texto de la instantánea:** los identificadores se resuelven en el catálogo del destino (por OID: `regprocedure`/`regclass`, quoteados por PostgreSQL); un nombre de objeto manipulado como SQL solo produce "objeto ausente".
- Lógica: `scripts/backup/privileges-lib.mjs`. Pruebas: `src/integrations/backup/privileges.test.ts` (9 tests unitarios) y `scripts/test-privilege-reconcile.mjs` (**9 comprobaciones contra PostgreSQL real**, también en el job `database` del CI).

**Uso en una restauración:** (1) descifrar la instantánea; (2) cargar esquema y datos y migrar Auth/Storage (§10); (3) generar el SQL sin `--verify-only`, revisarlo y ejecutarlo; (4) generar y ejecutar `--verify-only` como comprobación independiente; (5) solo entonces probar con identidades ajenas y abrir el destino. Si falla por objetos extra o ausentes, **no** se fuerza: se investiga la causa.

**Probado (PASS local, 2026-11-13):**
- *PostgreSQL embebido* (9 comprobaciones): la instantánea de una fuente verifica contra sí misma; un destino más permisivo por defecto se detecta, se reconcilia y verifica; una **función extra ejecutable por `anon`** se rechaza en ambos modos y el intento fallido **no cambia nada**; una tabla o secuencia extra se rechaza y la excepción explícita deja pasar solo lo declarado; una diferencia **únicamente en `WITH GRANT OPTION`** se detecta y se restaura en las dos direcciones (falta la opción / sobra la opción); un objeto ausente falla; instantáneas recortadas, editadas o de versión antigua no generan SQL; metadatos con saltos de línea se rechazan en todos los modos; un nombre de objeto con SQL no se ejecuta.
- *Pruebas de mutación:* quitar la comprobación de extras hace fallar el test de la función extra; quitar la opción de delegación de la instantánea hace fallar el test de `WITH GRANT OPTION`.
- *Datos reales* (restauración efímera, ya eliminada): la verificación falla antes con 90 objetos distintos, la reconciliación y la verificación posterior dan OK con 175 objetos, una función extra y una diferencia solo en la opción de delegación se detectan.

**Fallos corregidos durante la construcción:** (a) identidades truncadas a 63 bytes por una columna `name` en un `UNION`; (b) dependencia del `search_path` en la identidad de funciones; (c) la primera versión **no** detectaba objetos extra, ignoraba `WITH GRANT OPTION`, aceptaba una instantánea de una sola fila, interpolaba metadatos sin validar y construía DDL con el texto de la instantánea (hallazgos de la revisión de Codex y uno adicional por mi parte), todo corregido con pruebas.

**Límites (NOT TESTED):** privilegios por columna; privilegios de roles distintos de los cuatro; privilegios de lectura de `pg_default_acl` del destino (los objetos creados después heredan los del destino); objetos de extensiones (excluidos a propósito, también como "extra"); esquemas `auth` y `storage` (los gestiona Supabase); ejecución en un proyecto Supabase hospedado; el job de CI con la nueva suite (no se ha ejecutado en GitHub: sin push).
