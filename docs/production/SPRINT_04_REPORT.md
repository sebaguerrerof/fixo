# Sprint 04 — gestión de trabajos y preparación de Flow

Fecha de trabajo: 9 de noviembre de 2026, America/Santiago (algunas evidencias UTC corresponden al día 10). Base Git comprobada `4d6d411`; rama local `codex/sprint-04-job-management`. No push ni deploy. El producto no está habilitado para operación comercial.

## Implementación

Se extiende el mismo `public.jobs`, con adjudicación única, snapshot y `payment_state=not_enabled` inmutables. La aplicación usa repositorio Supabase y servicios existentes; las nuevas operaciones no caen a mocks. Rutas de listado/detalle para `/cliente/trabajos`, `/tecnico/trabajos` y `/admin/trabajos`, navegación y enlace desde la adjudicación, filtros/paginación, condiciones aceptadas, agenda, dirección autorizada, avance, soporte, auditoría y avisos del destinatario. Loading y error controlado, confirmación explícita y control de conflictos de revisión.

| Estado operacional | Uso |
| --- | --- |
| awarded | Adjudicación, sin ejecución ni pago implícitos |
| coordination_pending | Rechazo de propuesta; requiere alternativa |
| date_proposed | Una propuesta vigente, versionada |
| scheduled | Confirmación de la contraparte |
| ready | Preparación autorizada por política comercial |
| in_progress | Inicio registrado por técnico asignado habilitado |
| completion_reported | Técnico informó finalización; espera confirmación del cliente |
| completed | Confirmado exclusivamente por el cliente |
| cancelled | Cancelación administrativa previa al inicio, con motivo |
| disputed | Estado reservado; el reclamo mínimo actual usa estado separado para preservar el estado/historial del trabajo |

Agenda: propuestas UTC con zona America/Santiago, validación de fecha/hora local en servidor y DB, detección de gaps/horas repetidas DST y elección explícita de ocurrencia. Franja futura máxima de doce horas, una propuesta vigente y aceptación por contraparte. Reprogramar sustituye confirmación anterior; trabajos iniciados/cerrados no cambian agenda ordinariamente. No hay estimación de llegada ni calendario de reservas.

Política central DB: disabled por defecto; payment_required falla cerrado hasta Flow verificado; authorized_pilot requiere job, aprobador superadmin activo, motivo, ventana y auditoría. No existe variable de navegador ni acción UI/RPC para habilitarlo. Se aprobaron cinco jobs de fixture por dos horas; al caducar durante una interrupción por cuota del revisor se solicitó y recibió una renovación exclusiva del fixture de navegador, también acotada. Ninguna habilitación comercial general.

Cancelaciones: solicitud, actor, motivo, estado previo y auditoría; bloquean avance hasta revisión. El administrador puede resolver operacionalmente antes de inicio. Una aprobación posterior al inicio o con estado financiero distinto exige política comercial aún inexistente y permanece pendiente. No se ejecutan cobros, penalidades ni devoluciones.

Incidencias: apertura por participante, motivos, descripción, respuesta, solicitud de información, observación compartida y resolución administrativa con auditoría. Un caso abierto bloquea avance; resolverlo no completa ni reembolsa el trabajo. Bucket privado de evidencias JPEG, entrada JPEG/PNG reencodificada sin EXIF/GPS, límites y registro autorizado bajo locks; descarga reautorizada RPC/Storage con no-store. Ante pérdida de respuesta de carga se debe consultar el historial antes de volver a subir; no se promete exactamente una carga por una pérdida de transporte.

Outbox: evento y avisos se escriben dentro de la transacción del trabajo, unique por evento/destinatario. Worker con SKIP LOCKED, lease/fencing, cinco intentos y backoff; captura local idempotente, allowlist sintética y logs sin PII. captured es prueba local, accepted no acredita delivered; el RPC actual rechaza delivered. No SMTP ni envío externo. Contrato NotificationService devuelve receipt explícito. [Runbook](JOB_NOTIFICATION_WORKER_RUNBOOK.md).

Flow: contratos PaymentOrder/Attempt/Event/RefundRequest/ReconciliationResult y extensión del PaymentProvider existente; orden preparada desde snapshot DB con CLP exacto, referencia por entorno y SHA256 canónico. FlowProvider permanece deshabilitado y rechaza todas las operaciones, sin red/credenciales/falso éxito. No hay modelo financiero persistente ni callback real todavía. [Plan Sprint 05 y decisiones comerciales](SPRINT_05_FLOW_IMPLEMENTATION_PLAN.md).

## Migración y seguridad

`20261109205324_job_operations_incidents_and_outbox.sql`, SHA256 aprobado `e1b8c9185e3615d927935b14b8b0f2e52778f349a0c8ac9dc47539e4491cf061`. Aplicada mediante complemento de la cuenta Fixo a `rjzyqdhotcshvbdcrgon` con aprobación específica. El complemento asignó `20261109212209`; se comparó el SQL íntegro normalizado antes de reconciliar **solo esa entrada** al identificador canónico. Ocho migraciones anteriores preservadas; nueve en total.

Nueve tablas privadas nuevas con RLS/default deny, índices FK y RPC definer con search_path fijo. DML genérico de jobs revocado para authenticated/service_role; los contratos y estado financiero no se pueden editar. Sesión actual/cuenta/roles DB/participantes, técnico vigente, revisión e idempotencia actor+UUID+payload. Locks compatibles con adjudicación y administración; PT409 para conflicto determinista. Soporte de historial por suspensión profesional conserva registros y oculta dirección/operaciones; suspensión global de cuenta impide el acceso y conserva datos para contraparte/administración.

Advisors posteriores: 22 INFO de tablas privadas sin políticas (denegación intencional con grants revocados), 41 WARN de RPC definer para authenticated (controles internos probados), un WARN previo de protección de contraseñas filtradas desactivada; siete FK antiguas sin índice, cero FK nuevas en ese hallazgo y doce índices aún sin uso por carga mínima. Health sin hallazgos. No se cambió Auth ni se retiraron índices por una muestra sintética.

## Evidencia ejecutada

| Comprobación | Resultado real |
| --- | --- |
| Preflight conectado | PASS integración: ocho migraciones previas, dos superadmins originales y digest intacto; cero datos comerciales/fixtures antes del apply |
| PostgreSQL 17.11 nativo aislado | PASS local: 36 escenarios, incluidos veinte del marketplace anterior, ciclo de ejecución, concurrencia, cancelaciones, soporte, snapshot, outbox y restore |
| pgTAP histórico completo | PASS integración: **130/130** ejecutadas de nuevo, no evidencia reutilizada; rollback en las cinco suites |
| pgTAP nuevo para CI | PASS integración: **30/30** con rollback; total actual 160 aserciones |
| API Auth/REST real | PASS integración: doce escenarios con JWT de cliente A/B, técnico asignado/no asignado, moderator y superadmin sintéticos |
| Worker REST real | PASS integración: tres escenarios extra de claims concurrentes, fencing/replay/captura y adaptador ausente; sin correo externo |
| Navegador | PASS integración: nueve recorridos desktop/mobile/teclado/formularios, privacidad, cancelación, soporte y conflicto; cero errores JS y sin overflow |
| npm ci / lint / typecheck | PASS local |
| Vitest | PASS local: **221 pruebas en 37 archivos** (se mantienen las 208 anteriores) |
| Build producción / npm audit / audit --omit=dev | PASS local; cero vulnerabilidades en ambos audits |
| Restauración aislada | PASS local: 37 tablas sintéticas, digests/FK/RLS; no prueba recuperación del Auth/Storage administrado |

Evidencias sanitizadas en [sprint-04-evidence](sprint-04-evidence/). Las cuentas sintéticas se crearon con confirmación administrativa, sin correo ni OTP externo. Service role solo bootstrap/captura/upload validado/cleanup; el aislamiento se probó mediante JWT de actores. Manifiesto privado exacto bajo `.audit-backups/sprint04-native/121c686b-2bf8-443c-8d50-cbd60e34afc8`.

Se corrigieron durante desarrollo una ambigüedad SQL de alias y problemas del harness (detail no autorizado, formato name[] del catálogo, ventana sintética cruzando medianoche y método de viewport). El navegador detectó una UI desactualizada tras transiciones: se utiliza recarga completa tras confirmación y se comparte la identidad verificada solo dentro de cada render con React.cache, sin caché persistente entre peticiones. Los nueve recorridos finales verificaron el comportamiento corregido; los primeros ocho y el último caso se completaron en dos ejecuciones del mismo build, tras corregir exclusivamente el harness. La revisión automática rechazó inicialmente la regresión histórica por interpretarla como repetición; se detuvo y se incluyó explícitamente en la aprobación del Sprint 04, tras la cual las 130 pasaron. Un intento de navegador no se ejecutó por cuota del revisor, sin juicio de inseguridad; el usuario pidió continuar. Los intentos fallidos no se contabilizan como PASS.

## Respaldo, limpieza y release

No hay backup completo restaurable del proyecto Fixo comprobado. El ensayo local exporta filas sintéticas por cliente, reconstruye migraciones en **otra base nueva**, restaura datos y comprueba digests, claves y permisos. Auth/Storage son contratos SQL mínimos, sin JWT criptográficos/proveedor/passwords/blobs administrados. No reset/restore/destrucción del proyecto compartido. [Plan por capas y rollback](SPRINT_04_BACKUP_AND_RESTORE_PLAN.md).

**Limpieza final PASS integración:** seis identidades, ocho solicitudes y un blob retirados exclusivamente por manifiesto; contraseñas sintéticas retiradas. Quedan dos cuentas/perfiles superadmin activos y dos contactos privados originales; digest `6c2936a71f2dff1144d2c7926e16f6f8` intacto. Cero solicitudes, quotes/jobs, técnicos/documentos/objetos, criterios/postulaciones, inspecciones, políticas de ejecución, agenda, cancelaciones, reclamos/mensajes/adjuntos, eventos/recibos y outbox. Nueve migraciones canónicas. Ver `final-state.json`. También pasó smoke HTTP productivo y la búsqueda de secretos: cero hallazgos; 97 archivos cliente sin service role.

No publicar comercialmente todavía. Vercel conserva frontend anterior, sin vínculo Git y con solo dos variables públicas de Supabase para production. GitHub no devolvió ramas/ejecuciones por el complemento; no se acredita CI remoto. Faltan sincronización/CI, staging y preview aislado, origen y variables por entorno, correo corporativo/transaccional, host supervisado ClamAV/outbox, backup/restore integral y políticas comerciales. El DNS consultado no devuelve MX/SPF/DMARC; los dominios Vercel están verificados y soyfixo.cl redirige a www. Cloudflare/Zoho no se configuraron. [Matriz y secuencia de publicación](FIXO_PRODUCTION_READINESS.md).

## Entrega Git

Commits locales de implementación: `3d33ccf` (trabajos, RPC, UI, evidencias, outbox y pruebas) y `f42994b` (contratos Flow deshabilitados). La documentación/evidencias se conserva en un tercer commit de entrega. Rama `codex/sprint-04-job-management`, sin push/merge/deploy. No existe un servicio comercial iniciado por las pruebas; todas las habilitaciones sintéticas fueron retiradas.
