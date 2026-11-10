# Sprint 05 — integración Flow Sandbox preparada, sin habilitar

Sprint 04 entrega contratos de dominio, preparación de orden desde snapshot y un `FlowProvider` que rechaza todas las operaciones. No hay credenciales, endpoint de cobro/callback, orden financiera persistida, consulta externa ni prueba Sandbox ejecutada. `jobs.payment_state` continúa `not_enabled`; aceptar cotización, recibir retorno del navegador y completar un trabajo no acreditan pago.

## Decisiones comerciales previas

| Decisión | Estado y responsable |
| --- | --- |
| Quién contrata/cobra y quién recibe fondos en Flow | Pendiente del propietario Fixo y revisión contable/legal |
| Comisión, impuestos y base de cálculo | Pendiente; no se fija porcentaje ni se deduce del precio actual |
| Cobro total/anticipo y momento respecto de agenda/ejecución | Pendiente de Fixo |
| Liquidación al técnico, plazo y responsable | Pendiente; ninguna transferencia automática autorizada |
| Cancelación previa/posterior al inicio y no asistencia | Pendiente; conservar solicitud sensible en revisión |
| Reembolsos parciales/totales, disputa y garantías | Pendiente de política explícita, aprobadores y tratamiento contable |
| Boletas/facturas y responsabilidad tributaria | Pendiente de revisión profesional |
| Custodia/retención de evidencia y datos de pagador | Pendiente de política operativa y privacidad |

Estas decisiones son gates; los contratos técnicos no las sustituyen. La tarifa del proveedor tampoco determina la comisión de Fixo.

## Arquitectura y plan de implementación

1. Autorizar expresamente la cuenta Flow y pruebas **Sandbox**, credenciales de ese entorno, destino protegido de callbacks y montos/datos sintéticos. Separar claves/base/host de producción. No conectar preview público a Fixo comercial. Registrar dueño, rotación, secretos server-only y presupuesto. No usar credenciales públicas de documentación como si fueran la cuenta Fixo.
2. Diseñar una nueva migración revisable: orders, attempts, verified events, callback inbox y refund requests/reconciliations privados; UUID/reference únicos, snapshot digest, job FK, moneda CLP y entero positivo, eventos append-only, unique de referencia externa y deduplicación. RLS/definer/grants mínimos, indexes FK, locks/revisiones, idempotency keys. Revisar cada migración antes de aprobación específica. No editar la migración Sprint 04 ya aplicada.
3. Crear orden en servidor: sesión/cuenta vigente, customer propietario y adjudicación válida, cargar **snapshot DB**, validar vínculo job/quote/request/technician, calcular exacto CLP y digest canónico. No aceptar monto/comisión/customer desde formulario. `preparePaymentOrder` actual demuestra ese contrato pero no persiste ni habilita una orden. Una referencia de comercio única por orden y entorno; intentos separados permiten investigar fallos sin crear dobles cargos.
4. Extender el mismo `PaymentProvider`: `createOrder`, `reconcile`, `requestRefund`, además del contrato previo. El adaptador Flow real será server-only y con host fijo por entorno; no aceptar URL/token de proveedor arbitrarios. La documentación oficial define HMAC-SHA256 sobre parámetros ordenados alfabéticamente (sin `s`), concatenando nombre y valor antes de codificar el envío. Implementar y probar vectores canónicos, Unicode, valores vacíos y encoding; no registrar SecretKey, token ni payload con PII. Tiempo límite y códigos de error controlados.
5. Crear pago con `/payment/create`; validar checkout host y correlación orden/intento. La llamada externa no queda dentro de una transacción DB que mantenga locks. Persistir intento primero; si la respuesta se pierde, dejar `reconciliation_required` y consultar/investigar antes de repetir. No asumir que Flow ofrece una garantía de idempotencia de creación sin verificarla en su contrato vigente.
6. `urlConfirmation`: recibir token por POST con límite de tamaño/tipo y rate limits. La notificación es un disparador **no confiable**, no prueba de pago. Consultar `/payment/getStatus` desde servidor con parámetros firmados. Validar flowOrder/commerceOrder, entorno/cuenta, moneda, monto exacto y relación con intento conocido; token desconocido/monto distinto => cuarentena y conciliación, nunca paid. No atribuir una firma de solicitud saliente a un webhook entrante sin garantía documentada.
7. Callback inbox durable, deduplicación por referencia/identidad estable y consulta confiable del proveedor. Bloquear orden y job en orden consistente, aplicar una sola transición, insertar evento verificado y outbox en la misma transacción. Replay y mensajes fuera de orden no revierten un paid a pending ni duplican notificaciones. Correlación e historial de estados con timestamp del proveedor y de observación. No almacenar datos de tarjeta innecesarios.
8. `urlReturn`: mostrar estado de la DB y permitir recarga/consulta; nunca modificar pago por querystring o retorno del browser. Estados pendiente/rechazado/cancelado separados. Ante caída de Flow mostrar estado pendiente de verificación, sin éxito simulado. No iniciar ejecución por una redirección.
9. Conciliación programada con leases/backoff, consultas de estados pendientes y comparación de órdenes/transacciones. Discrepancias de monto/referencia, duplicados y timeout tienen cola administrativa y auditoría. Medir accepted/pending/verified, sin inventar ingresos ni saldos disponibles. Antes de habilitar `payment_required`, una migración específica debe vincular su helper central a eventos verificados y política comercial aprobada, preservando el modo disabled por defecto.
10. Reembolsos: preparar solicitud con motivo, importe no mayor al verificado menos reembolsos confirmados, autorización administrativa separada y política aprobada. Callback/consulta confiable e idempotencia, sin marcar refunded al solicitar. El Sprint 05 puede dejar el envío de refund bloqueado si no hay decisión comercial; no inventar compensación ni liquidación al técnico.

## Pruebas y criterios de salida

- Unitarias: importe desde snapshot, CLP entero, firma/encoding, correlación, mapper de estados, credenciales nunca cliente, provider unavailable.
- PostgreSQL/RLS: orden ajena, cuenta suspendida/sesión antigua, doble creación, callback replay, carreras callback/conciliación/cancelación/refund, snapshot inmutable, locks, rollback y outbox único; monto alterado jamás habilita ejecución.
- Sandbox real autorizado: pendiente/pagado/rechazado/cancelado, callback antes/después del retorno, callback falso, token desconocido, moneda/monto/referencia distintos, múltiples notificaciones, caída/timeouts/respuesta perdida y consulta posterior. Cada caso con evidencia real, sin declarar PASS por mocks.
- Navegador: cliente/tech/admin desktop/mobile/teclado, retorno y recarga, pendiente sin falso éxito, trabajos disabled hasta evento verificado, bloqueo de terceros y sin filtración de tokens/PII.
- Operación: restauración probada del nuevo modelo en destino aislado, secretos/orígenes por entorno, reconciliador supervisado, alertas, runbook, soporte y aprobación de publicación. Supabase/Flow producción permanecen separados hasta gate comercial y autorización.

**Listos para implementar el código de Sprint 05, una vez cerradas las decisiones de contrato y autorizadas las pruebas Sandbox. No listos para cobrar ni operar comercialmente.**

Referencias primarias consultadas el 9-11-2026: [Quickstart Flow](https://developers.flow.cl/docs/quick-start), [API oficial: firma y payment/getStatus](https://developers.flow.cl/api), [retorno de orden](https://developers.flow.cl/docs/tutorial-basics/order-finished). Verificar de nuevo el contrato al iniciar Sandbox.
