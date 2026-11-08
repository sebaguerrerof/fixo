# Fixo — Baseline y hardening de Supabase

Estado: **PREPARADO; NO EJECUTADO REMOTAMENTE**. CLI examinado: **3.0.0**. Fecha: 8 de noviembre de 2026.

Este procedimiento requiere aprobación explícita antes de reparar historial o aplicar SQL. No forma parte de la automatización CI. No usar `db reset --remote`, no repetir la migración inicial y no pegarla en SQL Editor.

## Situación comprobada

El catálogo remoto conserva nueve tablas, doce políticas entre tablas y Storage, seis funciones y 48 constraints. La nueva lectura compara las definiciones completas de funciones y constraints con Sprint 00 sin diferencias. El historial sigue vacío. El inventario anterior también compara los 66 nombres de columna sin faltantes/extras. No existe todavía un esquema private ni funciones que colisionen con los helpers propuestos. No aparecieron overrides de pgrst.db_schemas en los catálogos de rol/base inspeccionados; esto no acredita los schemas expuestos por configuración externa de Data API, que deben revisarse antes de aplicar. No se afirma un diff exhaustivo de todas las características del DDL.

Archivos:

- `supabase/migrations/202608170001_initial_marketplace.sql`: baseline existente; se conserva intacto, incluido su identificador de doce dígitos.
- `supabase/migrations/20261108223021_harden_marketplace_access.sql`: corrección nueva generada con `supabase migration new`, pendiente de prueba DB y aprobación remota.
- `supabase/tests/00_access_hardening.test.sql`: 27 aserciones pgTAP con fixtures locales y rollback.

## Precondiciones antes de cualquier escritura remota

1. Ejecutar ambos archivos en una base Supabase local vacía y pasar pgTAP. Comprobar que migration list local reconoce también la versión histórica de doce dígitos; no renombrarla ni registrarla remotamente por suposición. El intento de esta sesión quedó **BLOCKED** porque Docker Desktop no inicia y la conexión 127.0.0.1:54322 fue rechazada; no saltar esta condición.
2. Registrar versión CLI y revisar `migration repair --help`, `migration list --help` y `db push --help`. Los comandos v3 son locales por defecto; un destino remoto exige `--remote` y confirmación con `--yes`. No reutilizar sintaxis v2 sin comprobarla.
3. Confirmar nuevamente identidad del proyecto y catálogo. Capturar esquema, grants, políticas, RPC, índices, triggers, bucket y el contenido de `supabase_migrations.schema_migrations` por un canal privado. Verificar backup de DB/Storage y un procedimiento de restauración; los JSON del repositorio no son un backup de datos.
4. Comparar un entorno local reconstruido desde el baseline con el esquema remoto, excluyendo objetos internos gestionados por Supabase. Si hay diferencias funcionales no explicadas, **STOP**: corregir el plan antes de registrar un baseline que no representa la base.
5. Acordar ventana, responsable, exclusión de otros despliegues DB y aprobación específica de la reparación de historial. Las credenciales CLI se gestionan fuera de Git y logs. La conexión del complemento no configura automáticamente autenticación del CLI.

## Reparación de historial, después de aprobación

Ejemplos PowerShell; sustituir el ref por el proyecto verificado y no incluir contraseñas en el comando:

```powershell
$fixoProjectRef = '<ref-verificado-de-Fixo>'
npx --yes supabase@3.0.0 migration list --remote=$fixoProjectRef
npx --yes supabase@3.0.0 migration repair 202608170001 --status applied --remote=$fixoProjectRef --yes
npx --yes supabase@3.0.0 migration list --remote=$fixoProjectRef
npx --yes supabase@3.0.0 db push --dry-run --skip-vault --remote=$fixoProjectRef
```

`migration repair --status applied` modifica solo la tabla de historial: **no ejecuta el SQL inicial ni vuelve a insertar categorías/usuarios**. Su uso es correcto solo cuando ya se verificó que el esquema está aplicado. El dry-run debe mostrar únicamente la migración correctiva esperada como pendiente; si muestra el baseline o cualquier archivo inesperado, detenerse. No ejecutar `db pull` como si fuera una lectura inocua: puede ofrecer actualizar historial y necesita revisión separada.

## Hardening, con aprobación independiente y pruebas verdes

Después del dry-run revisado, una segunda aprobación habilita aplicar únicamente los cambios correctivos pendientes. No hay un comando de despliegue automático en este repositorio. Si se autoriza `db push --skip-vault --remote=... --yes`, primero confirmar que su lista contiene exactamente el archivo revisado. No incluir seeds/roles; usar skip-vault también en el dry-run para excluir la sincronización adicional de secretos Vault mencionada por la ayuda del CLI.

El cambio es aditivo/restrictivo y transaccional: crea helpers privados, conserva las firmas públicas y los roles, altera políticas/grants y limita el bucket. No elimina tablas, columnas, filas, documentos ni estados existentes. No concede UPDATE comercial genérico. Preserva el bloqueo de fila y la auditoría del RPC administrativo. Tiene lock_timeout de 5 segundos y statement_timeout de 30 segundos.

Aspectos que se deben revisar explícitamente:

- `private` debe permanecer fuera de los schemas expuestos por Data API. Sus helpers SECURITY DEFINER necesitan EXECUTE para RLS; no convertirlos a invoker porque consultan perfiles bajo reglas que provocarían recursión o negarían accesos.
- Se retira EXECUTE público de helpers/funciones trigger y de la función de transiciones. Solo el RPC administrativo conserva EXECUTE para authenticated, con guard interno contra escalación.
- El INSERT de solicitudes exige dueño customer, estado submitted y ausencia de asignación. UPDATE/DELETE siguen denegados hasta las operaciones transaccionales del Sprint 03/04.
- Documentos: bucket privado, máximo 10 MiB, MIME PDF/JPEG/PNG; carga propia solo technician en estado permitido, lectura propia técnica o administrativa. No se habilita edición de metadatos por el usuario.
- El servicio de URLs firmadas usa JWT del solicitante, metadatos autorizados, validación de path y TTL fijo de 60 segundos. No usa service role ni acepta un TTL del cliente. No está conectado aún a una UI de carga/revisión.
- La comprobación MIME del bucket no prueba el contenido binario ni reemplaza inspección de archivos/antimalware. Esa revisión corresponde al flujo documental del Sprint 02.

## Verificación posterior

Repetir inventario/grants/advisors y registrar historial con los dos identificadores. Probar anónimo, dos clientes, dos técnicos y moderator/superadmin en staging con JWT propios. Nunca usar service role para acreditar RLS. Comprobar que el directorio público sigue funcionando, que una cuenta no lee documentos de otra, que el RPC administrativo audita y que inserciones con estado/asignación manipulados se rechazan. Verificar tamaño/MIME por Storage API y expiración real de URLs firmadas; pgTAP solo comprueba catálogo/RLS/metadata, no el servicio HTTP Storage.

## Rollback

- Antes del commit SQL, cualquier fallo revierte la transacción completa. Timeouts no deben dejar una combinación parcial de grants/políticas.
- Reparación del baseline equivocada: después de nueva revisión y aprobación, `migration repair 202608170001 --status reverted --remote=... --yes` retira únicamente el registro. No revierte esquema ni datos; después no ejecutar db push, porque intentaría reaplicar el baseline.
- Hardening ya confirmado: preferir una migración compensatoria revisada. Restaurar ACL/políticas/RPC/bucket desde la captura previa, en una sola transacción, con grants de los helpers antiguos restablecidos antes de redirigir políticas a ellos. No borrar el esquema privado mientras queden dependencias. No usar `repair reverted` como sustituto de rollback de SQL.
- No restaurar privilegios amplios por conveniencia ni eliminar datos para hacer pasar una migración. Cualquier reversión de seguridad necesita evaluación y aprobación; mantener denegado el tráfico afectado si es necesario.

Fuentes: [migrations](https://supabase.com/docs/guides/deployment/database-migrations), [migration repair](https://supabase.com/docs/reference/cli/supabase-migration-repair), [CLI v3](https://supabase.com/changelog/supabase-cli-v3), [Storage/RLS](https://supabase.com/docs/guides/storage/security/access-control).
