# Inspección continua: solución preparada, hosting pendiente

`node scripts/inspection-worker.mjs` ejecuta un proceso persistente con concurrencia uno; `--once` procesa como máximo una tarea y sirve para supervisión programada. No instalar ni activar el unit de `ops/inspection-worker.service` sin aprobar el servidor. El worker no pertenece al runtime de Vercel.

## Contrato y operación

Cada documento nuevo vigente entra en `private.inspection_jobs`. El servicio reclama una fila con `FOR UPDATE SKIP LOCKED`, token aleatorio y lease de cinco minutos. Antivirus tiene timeout de 120s. El resultado solo se confirma con el lease vigente; un proceso anterior no puede sobrescribir al nuevo. Cinco intentos máximos; backoff exponencial de 60s hasta una hora; lease agotado termina en dead. Fallos de descarga, contenido, firmas o motor no publican un documento. La revisión administrativa exige estado clean y antecedentes vigentes. Las confirmaciones idénticas no duplican eventos ni revocan revisión previa.

El worker descarga Storage privado evitando caché, verifica contenido real y ejecuta ClamAV mediante el contrato existente. No imprime claves, paths, nombres de clientes, documentos ni respuestas internas del proveedor. Registra resultado/contador e indisponibilidad. Una tarea reemplazada conserva cuarentena; inspección solo puede confirmarse sobre un documento vigente.

Variables de **este servicio**: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FIXO_INSPECTION_PROJECT`, `FIXO_CLAMSCAN_PATH`, `FIXO_CLAMAV_DATABASE_DIR`. Publishable key no sustituye al inspector. Archivo EnvironmentFile fuera del repositorio, permisos 0600 y usuario dedicado. No exponer estos secretos en navegador, previews, argumentos CLI o logs. `FIXO_INSPECTION_LOAD_LOCAL=true` solo en el equipo de pruebas, no en hosting.

Propuesta inicial: host Linux de 4 GiB con Node 24, ClamAV/freshclam del repositorio oficial del sistema, firmas en directorio dedicado y actualización supervisada. Worker sin puertos entrantes. Freshclam como servicio separado con permiso exclusivo sobre firmas; el worker las lee. Alerta si daily tiene más de 24h; corte fail-closed a las 48h. Monitorizar reinicios, memoria, tareas dead, edad del pendiente más antiguo y último scan exitoso. Revisar una tarea dead antes de reencolar; no usar SQL masivo para marcar clean. La operación de reencolado administrativo queda pendiente de flujo con motivo y auditoría.

Un worker por host basta para el MVP. Escalar réplicas solo tras medir memoria y latencia; la cola tolera concurrencia. El servicio systemd es una plantilla revisable: no crea usuarios ni modifica equipos al incluirse en Git. Validar paths, usuario, versión Node, acceso de red TLS y la ruta de firmas antes de habilitarlo.

## Costos consultados el 9-11-2026

- Host propuesto DigitalOcean Basic 4 GiB/2 vCPU/80 GiB: **USD 24/mes**, antes de impuestos, backups opcionales y excesos. [Tarifa oficial](https://www.digitalocean.com/pricing/droplets). La selección de 4 GiB es una estimación de capacidad para el consumo observado de ClamAV; falta prueba sostenida de carga en ese host.
- Alternativa administrada Render worker 2 GiB/1 CPU: **USD 25/mes** de compute, sujeto a plan de workspace y almacenamiento. [Precios oficiales](https://render.com/pricing). Menor margen de memoria; medir antes de elegir.
- Equipo local: sin contratación nueva, dependiente de que esté encendido y de actualización/monitoreo manual. Es verificable y sirve para desarrollo; no acredita operación comercial permanente.

No se contrató ni desplegó ningún servidor. Las dos inspecciones remotas de este sprint usaron la cola y ClamAV real local con datos sintéticos, una a la vez. Las pruebas de leases/reintentos/fencing corrieron en PostgreSQL 17.11 aislado; el resultado clean por sí solo no sustituye estas pruebas de cola.
