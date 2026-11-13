# Runbook de monitoreo y alertas — Sprint 06 (borrador, NOT TESTED)

Fecha: 2026-11-13. Estado: **borrador sin ejecutar**. Hoy **no existe** monitor externo, receptor de alertas, responsable ni canal definidos; la salud del worker de Flow se consulta a mano. Este documento fija qué vigilar y los umbrales **propuestos**; los umbrales, el receptor y el escalamiento los aprueba el propietario (PENDIENTE). Conecta con `INSPECTION_WORKER_RUNBOOK.md`, `JOB_NOTIFICATION_WORKER_RUNBOOK.md` y `SPRINT_05_FLOW_SANDBOX_RUNBOOK.md`.

## 1. Principios
- Un monitor alojado junto al servicio no informa de su propia caída: debe haber un **monitor externo independiente** del host y del proveedor del worker (heartbeat con alerta por ausencia).
- Distinguir **mantenimiento** (switches de pagos apagados, sólo limpieza y retención) de **conciliación activa**. No declarar saludable un worker sólo por HTTP 200.
- Las alertas no contienen PII ni secretos; los logs tampoco.
- Una alerta sin acuse probado no es una alerta: el ensayo incluye recibirla y acusarla.

## 2. Qué se vigila
| Componente | Señal | Umbral propuesto (por aprobar) | Fuente hoy |
| --- | --- | --- | --- |
| Worker de pagos Flow (Supabase Cron) | `private.payment_worker_health()`: `degraded`, último tick, último tick **saludable** | alerta si `degraded=true`; sin tick > 3 min; sin tick saludable > 5 min (los umbrales de la función) | Consulta SQL manual como propietario (`db query --yes`, no `--read-only`); sin alerta automática |
| Cron detenido | job `fixo-payments-worker` inactivo o sin ejecuciones | cualquier ausencia > 3 min | misma función |
| Fallos internos del worker | `failures` o `housekeepingFailures` > 0 en el resumen | cualquier valor > 0 sostenido (2 ticks) | cuerpo de la respuesta registrado por pg_net |
| Cuarentenas y revisión financiera | filas de inbox en cuarentena; órdenes `review` (p. ej. `job_cancelled`) | cualquiera > 0 → aviso al responsable financiero/operativo | tablas `private.payment_*` |
| Cola de avisos | antigüedad y profundidad de `pending`, leases vencidos, `dead`, discrepancia `accepted` vs `delivered` | antigüedad `pending` > 15 min; `dead` > 0; lease vencido repetido (valores a ajustar con carga medida) | outbox existente (métricas por definir) |
| Inspector de documentos | latencia de la cola, reinicios del servicio, memoria, disco, **antigüedad de firmas ClamAV** | firmas > 24 h → alerta; el corte fail-closed existente a **48 h** se conserva; memoria cerca de `MemoryMax=3G`; reinicios repetidos | `ops/inspection-worker.service` + freshclam (por instalar) |
| Host de workers | CPU, memoria, disco, reinicio del host | umbrales a medir en la prueba de carga | sin host aún |
| Correo (Auth y avisos) | rechazos, rebotes, cola del proveedor, entrega | tasa de error del SMTP/API; rebotes > umbral | CPaaS (pendiente de contratar y validar eventos) |
| Backups | antigüedad del último respaldo verificado y su tamaño | > RPO acordado → alerta | pendiente (no hay respaldos programados) |
| Web | disponibilidad de `www.soyfixo.cl`, TLS (caducidad), redirect apex→www, respuesta de `/login` | caída > 2 checks consecutivos; certificado < 14 días | pendiente |

## 3. Consulta manual de salud de Flow (hasta tener alertas)
Como propietario del proyecto, con la CLI de Supabase fijada: ejecutar `select private.payment_worker_health();` mediante `db query --yes` (no funciona con `--read-only`: la función puede escribir). Interpretación: `degraded=false` y `last_healthy_age_seconds` < 300. Cualquier otra cosa: ver §6. No exponer la salida fuera del equipo operativo.

## 4. Monitor externo (por definir 🔒)
Requisitos: proveedor independiente del host de workers y de Supabase; chequeos HTTP a `www.soyfixo.cl`; heartbeat (URL de latido llamada por el worker de avisos y por el inspector; alerta si falta); receptor con **escalamiento** y acuse. Sin proveedor, presupuesto ni destinatarios no se puede implementar: es una decisión del propietario.

## 5. Prueba de alertas (criterio de aceptación 5) — NOT TESTED
En validación: (1) detener el cron y comprobar alerta en ≤ umbral; (2) detener cada worker y comprobar reinicio/alerta; (3) reiniciar el host y comprobar recuperación sin pérdida de tareas (leases/fencing/backoff); (4) simular proveedor de correo caído y ausencia de falsos `delivered`; (5) firmas ClamAV > 24 h (alerta) y > 48 h (fail-closed, nunca `clean`); (6) caída del host **y** del monitor local: el monitor externo debe alertar; (7) acuse probado por el responsable. Prueba sostenida propuesta de 24 h para reinicios, colas, firmas y alertas.

## 6. Respuesta a una alerta (guía)
1. Confirmar con la consulta manual (§3) y con el estado del host/servicio. No reiniciar a ciegas.
2. Worker de Flow degradado: revisar `failures`/`housekeepingFailures` y los logs JSON (sin secretos); con switches apagados sólo hay mantenimiento; no activar notificaciones para "arreglarlo". Reanudar el cron sólo con la causa entendida.
3. Cuarentena u orden en revisión: no reintentar pagos; escalar al responsable financiero; el cierre de una orden externa abierta requiere conciliación explícita.
4. Documentos sin inspeccionar: nunca marcar `clean` a mano; corregir motor/firmas y reencolar con motivo y auditoría.
5. Avisos `dead`: reencolar sólo con motivo y auditoría; no ejecutar `capture` sobre avisos comerciales.
6. Registrar el incidente (hora, causa, acción, resultado) y actualizar este runbook.

## 7. Decisiones pendientes (propietario)
Responsable operativo y suplente; canal de alertas (correo/otro) y horario de cobertura; proveedor de monitor externo y presupuesto; umbrales definitivos; política de retención de logs; ajuste de los umbrales de cola tras medir carga.
