# Sprint 04 — plan de ejecución remota y acta

Proyecto Fixo `rjzyqdhotcshvbdcrgon`, cuenta conectada Fixo, organización `jmbhjccxstrsgywyxdeq`. No staging separado: la cuota Free impidió crearlo. Base `4d6d411`, rama `codex/sprint-04-job-management`. Este documento no constituye autorización.

## Diff y dependencias

Única migración nueva: `20261109205324_job_operations_incidents_and_outbox.sql`, SHA256 `e1b8c9185e3615d927935b14b8b0f2e52778f349a0c8ac9dc47539e4491cf061`. Depende de las ocho migraciones canónicas comprobadas el 9-11-2026. Se ejecutó la cadena completa en PostgreSQL 17.11 aislado: **35 escenarios PASS local**, con Auth/Storage SQL simulados, sin acreditar JWT/REST hospedados.

Amplía `jobs.status`, añade revisión y timestamps/agenda, sustituye el trigger inmutable por uno que conserva contrato y `payment_state`. Añade nueve tablas privadas RLS/default deny, índices, RPC de consulta/transiciones/evidencias, cola y RPC de worker, y bucket privado `job-incident-evidence` (4 MiB JPEG). Retira DML genérico de jobs, incluso service_role; los RPC definer conservan adjudicación atómica. No cambia snapshots, adjudicaciones ni cuentas anteriores. Cada nuevo trabajo se inicializa con ejecución **disabled**. No existe UI/RPC para activar un piloto. `payment_required` falla cerrado; no se confirma ningún pago.

Impacto frontend: la nueva UI consume `job_list`, `job_detail`, `job_command`; requiere esta migración. El frontend antiguo continúa leyendo adjudicaciones; no debe publicarse una mezcla de versiones sin validación de contrato. Las nuevas escrituras solo se realizan por RPC con sesión actual, roles/participantes, revisión, idempotencia, locks, auditoría y outbox. Los reclamos conservan el estado del trabajo y bloquean su avance mientras están abiertos. La cancelación posterior al inicio no se aprueba sin política comercial.

## Preflight, respaldo y fallo

Repetir únicamente conteos/digest y catálogo pertinente antes del apply: dos cuentas/admin originales, digest `6c2936a71f2dff1144d2c7926e16f6f8`, cero solicitudes/cotizaciones/jobs/documentos/objetos/fixtures. Si cambia el estado esperado, detener la mutación y revisar el impacto. Guardar evidencia privada del catálogo/historial; no exportar contraseñas/secretos en informes.

**No hay backup completo restaurable de Fixo confirmado.** [Plan de respaldo](SPRINT_04_BACKUP_AND_RESTORE_PLAN.md): el ensayo aislado no acredita recuperación de Auth/Storage del proveedor. Aceptar expresamente esta limitación para aplicar en el proyecto existente. No reset, restore, DROP de datos ni cambios de contraseña. DDL transaccional, lock_timeout 5 s, statement_timeout 30 s: fallo antes de commit revierte. Tras commit, detener nuevas operaciones y preparar reparación hacia adelante; cualquier reversión destructiva requiere otra aprobación. No retirar el control comercial ni la inmutabilidad como rollback.

## Alcance de validación propuesto

1. Aplicar exclusivamente el SQL cuyo hash aparece arriba. El complemento puede asignar timestamp nuevo; contrastar nombre y SQL antes de reconciliar exclusivamente esa entrada al identificador canónico, sin tocar las ocho anteriores.
2. Ejecutar explícitamente las **130 aserciones históricas completas** solicitadas en §4 del Sprint 04 (27+53+7+18+25). Wrappers fail closed, fixtures dentro de transacción y ROLLBACK; no reutilizar el PASS de otro sprint. La primera llamada previa fue rechazada por revisión automática por considerarla repetición histórica: no se acredita ninguna de las 130 aún.
3. Crear solo identidades sintéticas etiquetadas por run UUID: cliente A/B, técnico asignado/no asignado, moderator y superadmin sintéticos. Bootstrap por Admin API con confirmación local administrativa, sin email/OTP externo. JWT propios para todas las pruebas de aislamiento. Service role solo setup/cleanup/worker/upload validado; no prueba RLS.
4. Crear solicitudes/cotizaciones/jobs/agenda/reclamos/evidencias exclusivamente sintéticos; probar transiciones, duplicados, sesiones antiguas/suspensión, privacidad, concurrencia, replay, cancelación sensible, outbox y recuperación de respuesta perdida. Navegador local con las mismas cuentas, desktop/mobile/teclado/formularios/overflow.
5. **Opcional sujeto a aprobación expresa en la pregunta:** habilitar `authorized_pilot` únicamente sobre jobs sintéticos del manifiesto, con aprobador superadmin sintético, motivo explícito, vigencia máxima dos horas y evento de auditoría. Es una habilitación de fixture para probar inicio/finalización; no un piloto comercial. Sin esa aprobación, probar positivos solo en PostgreSQL aislado y mantener remotos disabled.
6. Worker solo adaptador **capture**, UUID destinatarios sintéticos en allowlist, archivos locales privados y sin dirección/cuerpo de reclamo. No SMTP ni email remoto. Estado captured/accepted no demuestra delivered. Evidencias raster reencodificadas sin EXIF, bucket privado, descargas reautorizadas.
7. Manifiesto exacto de UUID/path y guardas contra referencias externas. Retirar exclusivamente blobs/filas/cuentas sintéticas del run, verificar cero residuos y digest original. Conservar evidencias sanitizadas; tokens/passwords se retiran de archivos temporales tras las pruebas. No eliminar registros existentes ajenos.

## Exclusiones

Sin push, deploy, DNS, contratación, Auth/SMTP, correo externo, Flow Sandbox/producción, pagos, reembolsos, liquidaciones, excepción general de ejecución, ni modificación de los dos usuarios originales. Cada nueva migración adicional necesitará revisión y aprobación propia.

## Acta de ejecución

El usuario aprobó explícitamente aplicar y probar, incluyendo habilitación exclusiva de fixtures. Preflight coincidió con el estado descrito. La migración se aplicó, su SQL íntegro se comparó y se reconcilió únicamente su timestamp asignado por el complemento. Pasaron 130 pgTAP históricos + 30 nuevos (rollback), 36 escenarios PostgreSQL locales, doce API + tres worker REST, nueve navegador y calidad. La ventana inicial de fixtures caducó durante una interrupción por cuota del revisor; se pidió y recibió renovación exclusiva del job sintético de navegador, auditada y por dos horas. La limpieza retiró seis usuarios/ocho solicitudes/un blob: cero políticas/fixtures/colas residuales, dos administradores originales y digest intacto. Ningún piloto comercial activo. Evidencia en `sprint-04-evidence/` y resultado consolidado en `SPRINT_04_REPORT.md`.
