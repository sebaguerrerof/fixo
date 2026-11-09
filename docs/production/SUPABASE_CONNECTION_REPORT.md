# Fixo — conexión Supabase

9 de noviembre de 2026, America/Santiago. **PASS: complemento, PostgreSQL, Auth, REST/RPC y Storage reales.** Destino único Fixo, ref `rjzyqdhotcshvbdcrgon`, organización fixo `jmbhjccxstrsgywyxdeq`, ca-central-1, Free, ACTIVE_HEALTHY, PostgreSQL 17.11 (versión administrada 17.11.0.003).

## Identidad y autorización

La conexión usada es la cuenta Fixo del complemento Supabase; no se consultaron ni modificaron Nivo u otras cuentas. NEXT_PUBLIC_SUPABASE_URL de .env.local coincide con el ref. .env.example no incorpora valores de claves. config.toml identifica el stack local fixo, distinto del ref remoto; .vercel/project.json identifica fixo-marketplace. Las credenciales nunca se imprimieron.

Staging separado: creación autorizada fixo-staging a USD 0/mes **falló por cuota global Free**. No se creó proyecto, no hubo upgrade ni cambios de facturación. El propietario indicó usar la base existente porque aún no hay datos comerciales; después aprobó expresamente baseline/hardening/identidad y pruebas sintéticas. Este cambio de alcance está documentado en SUPABASE_EXISTING_DATABASE_EXECUTION_PLAN.md.

## Antes y después

Preflight: SELECT current_database() = postgres, current_schema() = public y version() = PostgreSQL 17.11/aarch64. Nueve tablas public RLS, 66 columnas, seis funciones públicas, doce políticas incluyendo Storage y ocho categorías. Dos usuarios/perfiles superadmin; cero técnicos, solicitudes, documentos, auditoría y objetos. Historial de migraciones ausente. Bucket privado sin límites MIME/tamaño. Esa captura sigue en connection-catalog.json y existing-before.json y representa el estado anterior.

Ahora: baseline registrado SIN repetir su DDL; hardening e identidad aplicados; corrección de invitaciones y dos migraciones profesionales aditivas ejecutadas. Nueve tablas public y ocho private con RLS; bucket privado limitado a PDF/JPEG/PNG y 10 MiB, cuarentena y acceso condicionado a inspección. El historial contiene las seis versiones canónicas locales. El catálogo y las funciones nuevas se verificaron por ejecución real; la secuencia inicial sobre una base completamente vacía sigue NOT TESTED porque no se hizo reset ni se creó otra base.

## Capacidades y límites

El complemento permite listar/consultar proyectos, organización/costo, tablas, extensiones, migraciones, ramas, SQL, aplicar migraciones, advisors y logs. No expone una operación específica para configurar SMTP/redirects/hooks ni para administrar usuarios u objetos por HTTP. Esas pruebas usaron APIs nativas con claves leídas de .env.local dentro del proceso, sin revelar sus valores. La service role solo hace bootstrap/operaciones de servidor; los casos de aislamiento usan JWT propios y clave publicable.

| Capa | Estado | Evidencia |
| --- | --- | --- |
| Complemento → Fixo | PASS | Identidad de proyecto, SELECT, catálogo y migraciones reales. |
| Escrituras autorizadas | PASS | Migraciones transaccionales y fixtures etiquetados; sin reset ni replay del baseline. |
| PostgreSQL/pgTAP | PASS | 105 aserciones con rollback en el esquema final, preservando las 80 heredadas. |
| Auth/JWT/REST/Storage | PASS | 21 escenarios SDK de identidad y 14 profesionales con persistencia real, RLS y ClamAV. |
| Next.js → Fixo | PASS | Ocho recorridos reales con cookies, server actions, documentos, revisión, móvil/teclado y suspensión; browser-integration.json. |
| SMTP/captura | BLOCKED | No existe capturador configurado; no se envió correo ni se modificó Auth/SMTP. |
| Inspección continua en hosting | BLOCKED | Worker local ClamAV probado; no desplegado como servicio continuo. |
| Docker local | BLOCKED histórico | Independiente de la conexión remota. No se arrancaron stacks ni se borraron volúmenes. |

Las dos cuentas anteriores se preservaron; cada limpieza verifica UUID, email sintético y etiqueta de ejecución. Digest final de identidades/roles originales: `6c2936a71f2dff1144d2c7926e16f6f8`, idéntico al inicial. **Limpieza PASS:** dos usuarios/perfiles, dos superadmins activos, cero fixtures y cero objetos Storage. Ver `sprint-02-evidence/final-state.json`.

## Publicación

No hubo push, deploy, DNS, correos externos, cambios Auth/SMTP ni servicios con costo. El frontend Vercel anterior aún no incorpora el nuevo contrato de registro y postulación; no habilitar publicidad ni registros comerciales sin release compatible y aprobación. Los gates pendientes y el siguiente sprint están en SPRINT_01_INTEGRATION_REPORT.md, SPRINT_02_REPORT.md y SPRINT_03_IMPLEMENTATION_PLAN.md.
