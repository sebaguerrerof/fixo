# Worker de notificaciones — Sprint 04

`scripts/notification-worker.mjs` consume el outbox persistente generado en la misma transacción que la operación del trabajo. No corre en una transacción comercial ni en el navegador. Concurrencia inicial de proceso: uno; la DB admite varios consumidores mediante `FOR UPDATE SKIP LOCKED`, lease de cinco minutos y fencing por token. Máximo cinco intentos, backoff exponencial acotado a una hora; leases agotados terminan dead. Un reinicio permite reclamar el lease vencido; un worker antiguo no puede confirmar el lease nuevo.

## Configuración de pruebas

Ejecutar solo contra el proyecto y manifiesto expresamente aprobados. Credenciales en el entorno del proceso, sin argumentos visibles ni Git. `FIXO_NOTIFICATION_PROJECT` debe coincidir con el host del URL Supabase. `FIXO_NOTIFICATION_ADAPTER=capture` es obligatorio; no existe adaptador comercial ni fallback SMTP. `FIXO_NOTIFICATION_SYNTHETIC_RECIPIENTS` es una allowlist de UUID exactos y `FIXO_NOTIFICATION_CAPTURE_DIR` un directorio privado. `FIXO_NOTIFICATION_LOAD_LOCAL=true` permite cargar `.env.local` únicamente durante una prueba autorizada. En un host compartido usar secret manager y permisos del sistema de archivos. La service role queda exclusiva del servidor.

Comando: `node scripts/notification-worker.mjs --once` procesa como máximo un aviso; sin `--once` consulta cada quince segundos cuando no hay trabajo. SIGINT/SIGTERM terminan tras el elemento actual. No arrancar el adaptador de captura contra una cola que contenga destinatarios comerciales: una allowlist impide capturarlos, pero ese rechazo consume un intento y se reintenta. El Sprint 04 se ejecutó cuando solo existían fixtures controlados.

## Idempotencia, PII y estados

Un aviso por evento/destinatario, unique en DB. El nombre local deriva del UUID del aviso, escritura exclusiva `wx` y comparación exacta del contenido si ya existe. Si se pierde la respuesta después de capturar y antes de confirmar, el reintento conserva el mismo archivo y referencia hash. No se sobrescribe una captura incompatible. No promete exactamente una entrega para un futuro proveedor que no soporte idempotency keys.

El lease entrega email solo en memoria; la captura y logs no conservan dirección, email, descripción del reclamo ni tokens. Solo UUID, plantilla y texto genérico que dirige al historial privado. La dirección/antecedentes se consultan dentro de la aplicación, bajo sesión/RLS. Se conserva la identidad visual y el criterio de mensajes transaccionales de las plantillas Auth del Sprint 02.5, sin reutilizar enlaces OTP en eventos de trabajo. `NotificationService` distingue receipt captured/accepted.

| Estado | Significado |
| --- | --- |
| pending / leased | Espera / intento con lease |
| captured | Archivo de prueba local; no envío |
| accepted | Proveedor aceptó la petición; entrega pendiente de verificar |
| delivered | Reservado para confirmación autenticada del proveedor futuro; RPC actual rechaza este resultado |
| dead | Requiere atención después del máximo de intentos |

Captura fallida o proveedor ausente => retry y código fijo `provider_unavailable`, nunca excepción/PII del proveedor. Los participantes ven únicamente sus avisos. No hay envío externo habilitado. No ejecutar UPDATE manual para convertir accepted en delivered.

## Operación futura

Antes de producción: aprobar proveedor, dominio remitente, SPF/DKIM/DMARC, plantillas, presupuesto y envío de prueba; host supervisado independiente de Vercel, TLS, secretos rotados, métricas sin PII para profundidad/edad de pending, leases vencidos, dead y discrepancias accepted/delivered. Definir responsable y alertas. El proveedor futuro debe usar UUID de aviso como idempotency key y validar callbacks de entrega; nueva migración y autorización si cambia DB. Un dead necesita investigación y reencolado controlado/auditado, no un ciclo infinito. Retención/borrado de PII y capturas se aprueban antes de eventos comerciales.

## Evidencias privadas e incertidumbre de carga

Los adjuntos de reclamo se reencodifican mediante Sharp (máximo 16 MP de entrada, JPEG/PNG, salida JPEG de 4 MiB, sin EXIF/GPS), se guardan con path único de participante/incidencia y se registran con hash/tamaño mediante JWT. El registro vuelve a comprobar el estado bajo locks; cierre concurrente impide añadir evidencia. Las descargas vuelven a autorizar RPC y Storage, cache-busting y no-store; no se generan URLs firmadas persistentes. Un fallo de transporte exige consultar el historial antes de reintentar. Cualquier limpieza de archivos huérfanos debe comparar metadatos y manifiesto exacto, sin borrar por prefijos generales.
