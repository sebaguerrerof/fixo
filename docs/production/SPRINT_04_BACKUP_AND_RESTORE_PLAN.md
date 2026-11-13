# Sprint 04: respaldo y restauración

Destino de referencia Fixo `rjzyqdhotcshvbdcrgon`. Base Git verificada `4d6d411`; ocho migraciones canónicas, dos superadmins originales, digest `6c2936a71f2dff1144d2c7926e16f6f8`, cero datos/fixtures comerciales. Consulta del 9-11-2026. El catálogo no sustituye un backup completo.

| Capa | Alcance necesario | Estado |
| --- | --- | --- |
| Esquema de aplicación | DDL versionado, funciones, grants, RLS, índices, triggers, extensiones | Ocho migraciones previas y catálogo contrastados; novena aplicada con aprobación. SQL versionado, sin dump hospedado completo acreditado. |
| Datos public/private | Filas, relaciones, UUID, timestamps, snapshots, auditoría, recibos y colas | Exportación y restore sintéticos aislados se documentan por separado. No son copia del proyecto hospedado. |
| Auth | Usuarios, hashes de contraseña, identidades, configuración, claves y dependencias de la versión administrada | Backup hospedado completo y restauración NO COMPROBADOS. Admin API no exporta todos los elementos necesarios. No resetear contraseñas para conseguir acceso. |
| Storage | Metadatos DB y blobs por bucket/path, manifiesto/hash; políticas y límites | Blobs remotos cero en preflight. El dump de Postgres no contiene los archivos de Storage. |
| Historial | supabase_migrations y hashes del SQL canónico | Ocho entradas contrastadas, sin replay del baseline. |
| Despliegue/configuración | Commit/build por entorno, variables secretas fuera de Git, DNS/Auth/SMTP, servicios worker | Plan de release; no existe un rollback integral probado del hosting y sus proveedores. |

## Procedimiento ejecutable propuesto para backup hospedado

1. Aprobar una ventana y destino separado, presupuesto si aplica, accesos mínimos y responsable de restauración. Obtener conexión DB de forma segura en un secret manager; no ponerla en chat, argumentos visibles o Git. No cambiar la contraseña DB ni pausar proyectos ajenos.
2. Verificar versiones/CLI y exportar roles, esquema y datos conforme al procedimiento oficial, incluyendo los esquemas administrados en el alcance soportado. Revisar qué excluye el CLI antes de asumir que Auth/Storage/Vault están cubiertos. Cifrar backups y guardar claves separadas, con rotación, retención y copia fuera del mismo equipo.
3. Exportar objetos Storage por su API con manifiesto de bucket/path/hash y conteo, independientemente del dump. Conservar settings de Auth, redirects, plantillas y configuración de proveedores mediante mecanismo aprobado; no incluir secretos en evidencias sanitizadas.
4. Restaurar en **otro proyecto/cluster vacío y autorizado**, nunca Fixo. Adaptar extensiones/roles del destino administrado, preservar claves de cifrado si existen y no activar SMTP/webhooks de salida durante el ensayo.
5. Comparar conteos y hashes de tablas/objetos, constraints, snapshots, RLS/grants, migraciones y colas. Probar Auth con identidad sintética conocida, JWT/REST/Storage y la aplicación con claves exclusivas del destino. No acreditar Auth por insertar filas de prueba en un esquema mínimo.
6. Registrar duración, RPO/RTO medidos y pasos manuales. No prometer objetivos que no se midieron. El ensayo debe demostrar recuperación de la versión del frontend y su contrato DB; revertir únicamente Vercel no revierte migraciones.

No se dispone de conexión DB/backup administrado descargable verificados mediante el complemento actual ni de staging separado. La creación Free anterior fue rechazada por cuota. **Recuperación integral de Fixo: BLOCKED / NOT TESTED** hasta disponer de esos elementos y ejecutar el ensayo autorizado.

## Ensayo local permitido

PostgreSQL 17.11 en directorio nuevo, persistente, loopback y puerto dedicado. Se puede reconstruir el esquema de aplicación desde migraciones, exportar filas sintéticas por el cliente, restaurarlas en otra base nueva del mismo cluster y comparar digests y permisos. Auth y Storage de ese ensayo son contratos SQL mínimos; no incluyen passwords reales, JWT criptográficos, servicios del proveedor ni blobs reales. Ese resultado acredita únicamente el alcance aislado efectivamente probado.

Ensayo ejecutado: **PASS local**, 37 tablas, 406 filas sintéticas, 64 claves foráneas, digests iguales y RLS reautorizado para propietario/tercero en la segunda base nueva. Evidencia `sprint-04-evidence/restore-result.json`. No se ha medido un RPO/RTO del proyecto hospedado ni se ha restaurado su Auth/Storage.

## Riesgos de migración y rollback

El Sprint 04 extiende jobs, conserva su snapshot y estado financiero e incorpora tablas privadas, RPC y bucket. DDL transaccional con lock/statement timeout. Error antes de commit revierte. Tras commit, preferir reparación hacia adelante; no ejecutar DROP/reset/restauración sobre Fixo automáticamente. Un rollback que permita modificar snapshots o iniciar trabajos sin habilitación no es aceptable. Cada cambio remoto nuevo necesita diff/impacto y aprobación específica, incluso si no hay datos comerciales.

Fuente: [Backup y restore oficiales](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Se revisó el cambio de CLI 3: los comandos son locales por defecto y los cambios hospedados requieren consentimiento; no ejecutar comandos de versiones anteriores por memoria.
