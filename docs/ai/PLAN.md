# Sprint 05 — Flow Chile Sandbox

Estado: plan aprobado por el propietario en esta conversación el 10 de noviembre de 2026, America/Santiago.

Responsabilidades: Codex mantiene la arquitectura y revisa la entrega; Claude Code implementa, integra y prueba este alcance. Este documento es la fuente principal del trabajo aprobado. Su escritura no constituye implementación ni autorización de cobros reales.

## 1. Objetivo y límites

Permitir pagar cotizaciones aceptadas mediante Flow Sandbox, confirmar los pagos de forma segura y mostrar estados, saldos e historial en los paneles de cliente, técnico y administrador. Incluir adicionales registrados por el profesional y aceptados expresamente por el cliente.

Reutilizar Next.js App Router, TypeScript, Supabase, autorización DB/RLS, repositorios, servicios, trabajos y outbox existentes. Elegir la extensión mínima; no crear otro sistema de trabajos, otra abstracción de proveedor ni un motor genérico de contabilidad.

Este plan permite preparar la implementación y pruebas aisladas. No autoriza push, merge, deploy, migraciones productivas, credenciales productivas, cobros reales, transferencias al profesional ni devoluciones. Identificar y autorizar específicamente cualquier destino remoto de pruebas antes de modificarlo; no reutilizar por inferencia las autorizaciones del Sprint 04.

## 2. Referencias y estado comprobado

- README.md, AGENTS.md y CLAUDE.md.
- docs/production/SPRINT_05_FLOW_IMPLEMENTATION_PLAN.md: referencia preliminar del Sprint 04.
- docs/production/SPRINT_04_REPORT.md: entrega anterior y evidencia histórica.
- docs/production/FIXO_PRODUCTION_READINESS.md y supabase/README.md.
- Contratos de dominio, preparación y proveedor en src/integrations/payments y src/domain/entities/payment-order.ts.
- Migraciones de adjudicación y trabajos, en particular 20261109185924_inspection_queue_and_marketplace_transactions.sql y 20261109205324_job_operations_incidents_and_outbox.sql.
- Repositorios, servicios, acciones, vistas de trabajos, configuración administrativa y worker de notificaciones directamente relacionados.

La inspección local confirmó que la adjudicación crea un job con snapshot inmutable; existe preparación de orden desde snapshot, pero no persistencia financiera ni integración externa. FlowProvider rechaza todas las operaciones. jobs.payment_state está limitado a not_enabled, el trigger impide modificarlo y el mapper también lo fija a ese valor.

La política DB de ejecución está disabled por defecto; payment_required falla cerrado. Existen controles de sesión vigente, suspensión global, habilitación profesional, revisiones, idempotencia, incidentes, cancelaciones y outbox. Deben conservarse.

README.md y supabase/README.md contienen estados históricos anteriores al Sprint 04. Actualizarlos con evidencia al entregar Sprint 05. Los resultados del reporte anterior son históricos: no equivalen a pruebas nuevas ni a verificación del estado remoto actual. Durante la planificación no se consultó ni modificó la base remota.

## 3. Decisiones comerciales aprobadas

La última definición explícita del propietario prevalece sobre la idea preliminar de sumar la tarifa Flow al cliente:

| Concepto | Regla |
| --- | --- |
| Importe profesional Q | Precio cotizado por la visita o servicio a domicilio; no hay tarifa fija de domicilio definida por Fixo |
| Porcentaje Fixo r | Inicialmente 5%, editable desde administración por superadmin |
| Comisión Fixo F | Redondeo al peso más cercano de Q por r; mitades hacia arriba |
| Total cliente T | Q + F |
| Coste Flow G | A cargo de Fixo, dentro de F; nunca se suma automáticamente al cliente ni se resta al profesional |
| Importe asignado al profesional | Q |
| Margen de plataforma | F - G, antes de otras obligaciones; puede ser negativo |
| Inicial | Pago verificado antes de iniciar la visita |
| Adicionales | Profesional registra; cliente acepta; cliente paga mediante la aplicación |
| Cierre | Requiere todos los importes aceptados pagados |
| Liquidación al profesional | Calculada al cierre sin reclamos; sólo simulada en Sandbox |

Ejemplo aprobado: Q = $100.000, F = $5.000, T = $105.000. El profesional tiene asignados $100.000 y Fixo cubre Flow con sus $5.000. No descontar G de Q ni agregar otro recargo por Flow.

Aplicar el mismo porcentaje al importe completo de cada adicional aceptado. Calcular con enteros CLP y puntos base: 5% = 500 puntos base. Evitar aritmética monetaria de punto flotante y validar rangos.

El porcentaje y la regla de cálculo se congelan por orden. Cambios de configuración afectan nuevas órdenes; no recalculan órdenes existentes, sus reintentos ni su historial. Un adicional nuevo puede utilizar la política vigente al confirmar sus condiciones.

La cotización original y su snapshot no se reescriben. Antes de crear la orden, mostrar al cliente Q, F y T y registrar su consentimiento financiero independiente, versión de política, actor y fecha. Cotizaciones aceptadas previamente también requieren ese consentimiento; no considerar que el antiguo importe aceptado ya incluía F.

El importe del profesional es asignado o pendiente de liquidación simulada, nunca una transferencia efectuada. Si G falta o no está confirmado, mostrar el coste/margen como pendiente de conciliación; no asumir cero. Si G supera F, registrar la diferencia sin reducir Q. Distinguir el coste reportado por Flow de obligaciones contables o tributarias adicionales que esta integración no acredita.

## 4. Supuestos, exclusiones y requisitos de entorno

Supuestos adoptados con la aprobación del plan:

- Cuenta receptora Sandbox de Fixo, sin reparto automático por comercios asociados.
- Comisión sobre el importe completo cotizado, incluidos los conceptos que integran ese precio.
- Adicionales únicamente en trabajos vigentes antes del cierre y sujetos a aceptación del cliente.
- Liquidación simulada elegible al cierre confirmado por cliente, con importes aceptados pagados y sin reclamos ni cancelaciones pendientes.
- No inventar un desglose tributario ni agregar impuestos nuevos al precio aprobado.

Pendiente de identificar antes de pruebas reales: titular/cuenta Flow Sandbox, custodio de sus credenciales, destino Supabase aislado, origen HTTPS de callbacks, ejecutor del worker y conjunto de datos/montos sintéticos autorizado. La implementación y pruebas sin red pueden avanzar mientras se preparan esos recursos.

Fuera del sprint: cobros productivos, anticipos porcentuales y saldos de una misma cotización, tarjetas guardadas, suscripciones, pagos bancarios a profesionales, liquidaciones reales, emisión tributaria, reembolsos ejecutables y resolución financiera completa de disputas.

Los contratos existentes de authorize/refund/requestRefund no se habilitan por implementar createOrder/reconcile. No introducir falsos éxitos ni sustituir evidencia Sandbox por mocks.

## 5. Arquitectura y modelo mínimo

Flujo: componentes y acciones/rutas Next.js -> servicio de pagos -> contrato de repositorio y PaymentProvider -> Supabase y adaptador Flow server-only.

Añadir seis tablas en private, con RLS como defensa adicional y sin DML directo para anon/authenticated ni acceso genérico del worker:

| Tabla propuesta | Contenido e invariantes |
| --- | --- |
| payment_pricing_policies | Versiones de porcentaje/regla, autor, fecha y motivo; historial inmutable y actualización con control de versión |
| job_extra_charges | Job, profesional, concepto, importe CLP, estado, revisión y aceptación/rechazo; condiciones inmutables después de aceptación |
| payment_orders | Job y origen inicial/adicional, snapshot original y digest, términos financieros consentidos, política congelada, Q/F/T, estado, entorno y pago aplicado |
| payment_attempts | Orden, idempotencia, referencia comercial única por intento, identidad Flow, datos privados de checkout, estado técnico y planificación de conciliación |
| payment_events | Observaciones verificadas del proveedor, correlación, importe/moneda, resultado de validación y fechas; append-only |
| payment_inbox | Recepción durable, identidad/hash de notificación, material privado para verificar, estado de procesamiento, lease y cuarentena |

No añadir tablas de conciliación, reembolsos ni transferencias: la conciliación usa intentos, eventos y bandeja; la liquidación simulada se calcula a partir de importes y pagos verificados.

Invariantes:

1. Una orden lógica por obligación y entorno: una inicial por job y una por adicional aceptado. Reintentar una obligación no crea otra deuda.
2. Cada intento externo tiene commerceOrder propio, único por cuenta/entorno. Ajustar el contrato preliminar para separar la referencia interna de la orden de la referencia del intento enviada a Flow.
3. Sólo un intento externo potencialmente pagable por orden. Ningún intento ambiguo permite recreación automática.
4. Un reintento nuevo requiere comprobar que el anterior ya no admite pago. Si el contrato del proveedor no permite asegurarlo, mantener revisión manual.
5. El primer pago válido satisface la obligación una sola vez. Un segundo pago externo se conserva como anomalía, sin duplicar asignaciones, avisos ni saldo liquidable.
6. Snapshot y términos consentidos son inmutables; índices FK, referencias únicas y constraints garantizan correlación, CLP entero y positivo y T = Q + F.
7. Separar estado financiero, estado técnico y estado operacional. Un timeout no demuestra rechazo ni anulación.

Ampliar jobs.payment_state como proyección controlada del pago inicial y actualizar su tipo/mapper. Los saldos adicionales se consultan separadamente; no presentar el inicial pagado como saldo total cero. Las únicas escrituras financieras serán RPC técnicas estrechas que mantengan la proyección a partir de los registros autorizados.

Adaptar guard_job_contract preservando la inmutabilidad de contrato, participantes y snapshot. Conservar las revisiones de trabajo y la denegación de DML directo. No usar un indicador controlable por el cliente para eludir el trigger.

Reutilizar job_events y notification_outbox. Permitir eventos automáticos con origen proveedor y vínculo único al evento financiero, sin suplantar un actor humano. Conservar unique por evento/destinatario y extender la allowlist del capturador de avisos.

## 6. Autorización y seguridad

- Cliente: consultar sólo trabajos/órdenes propios, confirmar condiciones, iniciar pagos y aceptar/rechazar adicionales propios.
- Técnico: consultar sus trabajos e importes asignados y registrar adicionales como profesional vigente; no confirmar pagos ni aceptar por el cliente.
- Moderador: consultar estados e incidencias de conciliación según permisos administrativos existentes; no cambiar comisión ni marcar pagos.
- Superadmin: editar porcentaje con sesión/cuenta vigentes, motivo, versión y auditoría; solicitar una nueva conciliación, sin imponer su resultado.
- Worker/servidor: sólo RPC específicas de bandeja, intents y aplicación de observaciones verificadas. Ninguna RPC anónima o authenticated puede insertar un pago verificado.

Reutilizar private.marketplace_actor, private.is_active_account, controles de sesión y habilitación profesional vigentes. Las comprobaciones de UI y middleware complementan las de DB.

Funciones SECURITY DEFINER sólo donde lo exige el acceso privado existente, con search_path fijo, objetos calificados, revocación de EXECUTE a PUBLIC/anon y grants mínimos. Verificar propiedad y rol dentro de cada RPC. No tomar decisiones desde user_metadata.

Lecturas de usuario mediante JWT propio; service_role no sustituye RLS para cargar paneles. Para callbacks/worker, acceso privilegiado server-only acotado y revisión explícita de su uso; no ampliar indiscriminadamente el cliente de Auth.

Credenciales Flow y material criptográfico únicamente en servidor. Tokens de checkout y callback son datos sensibles: almacenamiento privado, cifrado autenticado cuando deban conservarse para procesar/reutilizar, claves separadas del contenido y retención mínima documentada. No guardar tarjeta ni respuestas completas con PII.

El token que necesita el navegador se limita al checkout del proveedor y al retorno protocolario; no incorporarlo a querystrings de Fixo, historial, analítica ni logs. Usar no-store, no-referrer y errores sanitizados.

La activación sólo admite Sandbox y destino Supabase esperado. Prohibir el host productivo y URLs arbitrarias de API/checkout; comprobar host HTTPS exacto autorizado. Añadir límites de cuerpo, campos y frecuencia, timeouts y límites de concurrencia.

## 7. Flujos de aplicación

### 7.1 Preparación y creación

1. Cargar en servidor el job autorizado y el snapshot original, o el adicional aceptado vinculado al mismo job.
2. Mostrar desglose Q/F/T, modo Sandbox y estado actual, reutilizando los términos de una orden ya creada.
3. Recibir sólo identificadores, revisión, versión de política e idempotency key; nunca confiar en montos, comisión, beneficiario o identidad enviados desde el navegador.
4. Bajo autorización y locks, recalcular términos, comprobar el consentimiento de la versión mostrada y persistir orden/intento antes de cualquier red. Si la política cambió, exigir refrescar el desglose; no cobrar otro total silenciosamente.
5. Llamar payment/create fuera de la transacción DB. Firmar todos los parámetros requeridos salvo s, ordenados y concatenados antes de codificar; probar Unicode, vacíos y encoding.
6. Persistir y validar correlación y destino de checkout antes de redirigir.
7. Si se pierde la respuesta, se interrumpe el proceso o falla su persistencia, dejar reconciliation_required. La conciliación recupera por referencia de comercio o identidad Flow; no asumir idempotencia de payment/create.

El ajuste de preparePaymentOrder debe conservar el digest del snapshot original y añadir los términos financieros aprobados: amountClp enviado a Flow pasa a ser T, no sólo Q. El preparado de adicionales reutiliza la misma abstracción con su propio snapshot aceptado.

### 7.2 Confirmación

POST /api/payments/flow/confirmation:

1. Endpoint público sin requerir cookies de usuario; aislar su tratamiento en middleware sin relajar rutas protegidas.
2. Validar POST form-urlencoded, tamaño, token único y límites de frecuencia; no confiar en estados o importes entrantes.
3. Persistir durablemente en inbox y responder HTTP 200 dentro de la ventana oficial; ante fallo de persistencia no confirmar recepción con 200.
4. El worker consulta payment/getStatus firmado con la cuenta Sandbox. Correlacionar flowOrder, commerceOrder del intento, entorno/cuenta, CLP y T exacto.
5. Identidad desconocida o discrepancia: cuarentena y revisión; nunca paid.
6. Aplicar bajo locks en orden consistente con trabajos/adjudicación/administración, sin red dentro de esa transacción.
7. Insertar evento, proyección y outbox de forma atómica y deduplicada.

No atribuir firma entrante al callback: la firma HMAC protege solicitudes salientes. El callback recibido es un disparador no confiable. La evidencia financiera proviene de la consulta autenticada al proveedor.

La deduplicación no debe descartar una notificación posterior del mismo token tras cambiar pending a paid. Mantener trabajo pendiente/generación de procesamiento o mecanismo equivalente y conciliación independiente. Deduplicar efectos por identidad estable de la observación verificada, excluyendo el timestamp local de la clave.

### 7.3 Retorno

POST /api/payments/flow/return:

- Recibir el POST del navegador y redirigir con 303 a una ruta interna estable del detalle del trabajo.
- No modificar el estado por token, querystring ni retorno del browser.
- Mostrar DB; si sigue pendiente, informar pendiente de verificación y permitir actualizar.
- Si faltan cookies por el retorno entre sitios, completar login y volver al detalle, reautorizando su lectura.
- No exponer información financiera por conocer un token ni iniciar el trabajo automáticamente.

### 7.4 Estados y conciliación

Mapear estados oficiales de Flow: 1 -> pending, 2 -> paid, 3 -> failed (rechazado en UI), 4 -> cancelled (anulado en UI). Estados desconocidos no habilitan ejecución. No usar authorized como pago confirmado.

Worker con lease/fencing, lotes acotados, backoff, recuperación de creating abandonado y reprocesamiento de inbox. Consultar también intentos pendientes/ambiguos aunque nunca llegue callback. Usar getStatusByCommerceId para respuestas de creación perdidas y getStatusByFlowOrder cuando exista identidad persistida.

No marcar anulado por un reloj local ni depender de reintentos automáticos de Flow. Paid no retrocede por mensajes viejos. Un pago tardío tras cancelación/suspensión se registra y deriva a revisión sin reactivar el trabajo ni dar acceso a la cuenta suspendida.

Administración mostrará pendientes, discrepancias, último control, siguiente intento y fallos sanitizados. Una acción de reconsulta sólo programa verificación: no permite imponer paid.

### 7.5 Adicionales y cierre

El profesional asignado propone concepto e importe; cliente revisa Q/F/T y acepta o rechaza. La aceptación crea/congela la obligación local; el pago posterior usa el mismo flujo Flow. Propuestas no aceptadas no son deuda ni habilitan cargos.

Evitar importes mutables después de aceptación, cobros unilaterales y eliminación silenciosa de adicionales aceptados. Los conflictos posteriores se tramitan por soporte existente.

La política payment_required comprueba pago inicial verificado y habilitación Sandbox explícita, acotada al job/entorno aprobado. Mantener disabled por defecto y preservar authorized_pilot. No añadir una habilitación comercial global desde UI.

Conservar agenda, roles, habilitación técnica, incidentes y cancelaciones como condiciones adicionales. El pago no agenda, prepara, inicia ni cierra por sí solo.

confirm_completion debe exigir todos los importes aceptados pagados, sin gestiones bloqueantes, bajo el mismo lock del job que la aceptación de adicionales. Si gana el cierre, no se aceptan nuevos adicionales; si gana la aceptación, el saldo bloquea el cierre. El técnico puede informar finalización sin que ello acredite cobro ni cierre.

No liquidar al profesional ni presentar dinero disponible para retiro. Mostrar cálculo de prueba al cierre elegible. Cancelaciones con pagos o intentos aún pagables quedan en revisión; ningún cierre, cancelación o reclamo solicita refund automáticamente.

## 8. Archivos previstos

Los nombres nuevos son propuestas; mantener los patrones existentes y justificar ajustes de ruta sin ampliar el alcance.

| Área | Crear | Modificar |
| --- | --- | --- |
| Dominio | src/domain/entities/job-extra-charge.ts; validaciones de pago/adicionales | src/domain/entities/payment-order.ts, job.ts, job-operations.ts; payment-status.ts sólo si hace falta documentar el mapeo |
| Proveedor | Configuración y utilidades de firma/verificación bajo src/integrations/payments | payment-provider.ts, flow-provider.ts, prepare-payment-order.ts y sus pruebas |
| Aplicación | src/services/payments/payment-service.ts; src/repositories/contracts/payment-repository.ts; src/repositories/supabase/supabase-payment-repository.ts | repository-factory.ts, supabase-job-repository.ts; servicios de trabajos si requieren delegación |
| Acciones/rutas | src/app/actions/payments.ts; src/app/api/payments/flow/confirmation/route.ts; return/route.ts; acciones de configuración administrativa | src/middleware.ts; src/app/actions/jobs.ts si requiere actualización de vistas |
| Interfaz | Componentes de pago, adicionales y porcentaje bajo componentes correspondientes | src/components/jobs/job-workspace.tsx, job-list.tsx, job-labels.ts; src/app/tecnico/pagos/page.tsx; src/app/admin/configuracion/page.tsx |
| DB | Nueva migración flow_sandbox_payments; supabase/tests/06_flow_payments.test.sql | RPC/triggers existentes reemplazados sólo desde la nueva migración |
| Operación | Worker de pagos y lógica de procesamiento, harness de pruebas aisladas, runbook Sandbox | scripts/lib/job-notification.mjs; .env.example; package.json sólo para scripts necesarios |
| Entrega | docs/production/SPRINT_05_REPORT.md y evidencia sanitizada | README.md, supabase/README.md, FIXO_PRODUCTION_READINESS.md y plan preliminar Flow para enlazar el resultado |

No se prevén nuevas dependencias de ejecución: reutilizar fetch, node:crypto, Zod y clientes Supabase existentes. No rehacer QuoteService ni cambiar snapshots originales para añadir la comisión.

## 9. Etapas verificables

1. Preflight y contratos: comprobar base Git, contratos/RPC actuales y destino aislado; fijar estados, fórmulas, consentimiento y referencias por intento. Salida: contratos y matriz de permisos revisables.
2. DB y política: generar migración con CLI y versión fijada, añadir seis tablas/constraints/RPC, edición versionada por superadmin, proyección de job y adicionales. Salida: migración y pgTAP local; ninguna ejecución productiva.
3. Proveedor y creación: firma, config Sandbox, orden/intento durable, checkout y recuperación de creación ambigua. Salida: pruebas unitarias y de fallos sin falsos éxitos.
4. Confirmación y conciliación: rutas, inbox, worker, eventos y outbox atómicos, cuarentena, leases y reinicio. Salida: pruebas de concurrencia y recuperación.
5. Paneles y reglas: pago/estado por rol, adicionales, porcentaje administrativo, gates de inicio/cierre y liquidación simulada. Salida: flujos de navegador y permisos.
6. Integración Sandbox y entrega: pruebas reales autorizadas, regresión, restauración aislada, revisión de diff, runbook, reporte y limpieza por manifiesto. Salida: evidencia real y limitaciones declaradas.

No detener el trabajo de código y pruebas aisladas por datos de entorno que sólo sean necesarios para integración posterior. No declarar completo el sprint sin evidencia Sandbox o sin identificar explícitamente ese bloqueo.

## 10. Pruebas y evidencia

Unitarias:

- Q = 100.000, r = 500 puntos base: F = 5.000, T = 105.000, importe profesional = 100.000.
- Redondeo, rangos, CLP entero, adicionales y coste Flow mayor que F sin reducir Q.
- Cambio de política sin efectos retroactivos; versión desactualizada exige revisar desglose.
- Snapshot original y términos financieros; firma/encoding; mapper de estados; configuración disabled/Sandbox; ausencia de secretos cliente.
- Errores de proveedor, respuestas inesperadas y rechazo de destinos arbitrarios.

PostgreSQL/RLS y API con JWT reales en destino aislado:

- Cliente ajeno, técnico no asignado, moderator, superadmin, sesiones revocadas y cuentas suspendidas.
- Porcentaje editable sólo por superadmin; historial, motivo y conflicto de versión.
- Aceptación exclusiva del cliente, inmutabilidad de condiciones y rechazo de adicionales después de cierre.
- Doble clic/dos pestañas, creación concurrente, replay y callbacks fuera de orden.
- Carreras callback/conciliación/cancelación/suspensión y aceptación de adicional/cierre.
- Sin pago inicial no hay inicio; sin pagos de todos los importes aceptados no hay cierre.
- Atomicidad de evento/proyección/outbox, rollback, deduplicación y lease/fencing.
- Monto, moneda, cuenta o referencia incorrectos nunca habilitan ejecución.

Sandbox real:

- Aprobado, pendiente, rechazado y anulado con evidencia obtenida en Sandbox.
- Callback antes/después del retorno, retorno con sesión ausente y actualización posterior.
- Token falso/desconocido, repetición y cambio de estado para el mismo token.
- Pérdida de respuesta, interrupción tras reservar intento y recuperación por referencia.
- Caída de worker/red y conciliación sin callback; pago tardío y posible duplicado.
- Cobro inicial y al menos un adicional aceptado, incluyendo saldo pendiente visible antes del cierre.

Usar pruebas controladas de integración para casos adversos que Sandbox no permita provocar. Distinguir sus resultados de los observados realmente en Flow; no acreditar escenarios reales mediante mocks.

Navegador: cliente/técnico/admin, desktop/mobile/teclado, confirmaciones, recarga, aislamiento y ausencia de tokens/PII en Fixo, logs y analítica. Verificar que un cobro no se presenta como pago al técnico.

Regresión: ejecutar npm run lint, npm run typecheck, npm run test, npm run build, npm run secrets:check y suites SQL previas/nuevas. Validar scripts reales de package.json antes de usarlos. Smoke sobre build aislado; no contactar producción por defecto. Ejecutar audits previstos por CI.

Conservar la suite histórica de adjudicación/trabajos. Ensayar restauración del nuevo modelo en otra base aislada y comprobar referencias, digests, eventos, RLS y permisos; no confundirlo con una prueba integral de recuperación de Auth/Storage administrados.

El reporte distinguirá PASS local, PASS integración/Sandbox, FAIL y NOT TESTED. Las cifras del Sprint 04 no se reutilizan como ejecuciones nuevas.

## 11. Operación, riesgos y reversión

| Riesgo | Tratamiento |
| --- | --- |
| Respuesta de creación perdida | Intento previo durable, estado ambiguo y consulta por referencia; sin recreate automático |
| Replay, duplicados y pago tardío | Evidencia persistente, aplicación única y cuarentena; no reactivar trabajo |
| Cambio de porcentaje durante confirmación | Versión esperada, refresco del desglose y política congelada por orden |
| Cierre concurrente con adicional | Lock común y comprobación transaccional del saldo |
| Retorno sin cookies | Ruta POST pública mínima, 303 y reautorización después de login |
| Worker detenido o callback ausente | Inbox durable, conciliación periódica, leases/backoff y supervisión |
| Coste Flow ausente o superior a F | Coste/margen pendiente o diferencia explícita; importe profesional intacto |
| Datos sensibles | Privilegios mínimos, cifrado/retención para tokens, redacción de logs y no-store |
| Cancelación con pago | Revisión administrativa; no devolución ni liberación automática |
| Mezcla de entornos | API Sandbox fija, cuenta/proyecto/origen esperados y producción deshabilitada |

El runbook documentará arranque/parada del worker, frecuencia/backoff, antigüedad de pendientes, alertas, cuarentena, credenciales/cifrado/rotación y limpieza de fixtures.

Separar el interruptor de nuevas creaciones de la capacidad de recibir/verificar pagos ya iniciados. Para revertir una habilitación, detener nuevas órdenes y mantener confirmación/conciliación hasta resolver las pendientes. No borrar eventos, cambiar paid por disabled ni ejecutar un rollback destructivo del modelo financiero.

Preservar historial y migraciones anteriores. Cualquier aplicación remota requiere destino y autorización específica; producción, push y deploy permanecen fuera del alcance.

## 12. Criterios de aceptación

- Flujo inicial y al menos un adicional completados de extremo a extremo en Flow Sandbox con evidencia.
- Cliente paga Q + F; profesional conserva Q; Flow se absorbe exclusivamente dentro de Fixo.
- Comisión inicial 5%, editable por superadmin y congelada por orden, sin cambios retroactivos.
- Consentimiento explícito del total antes de cada orden; adicional sólo tras aceptación del cliente.
- Sólo una consulta autenticada y correlacionada del proveedor acredita pago; retorno y callback por sí solos no lo hacen.
- Inicio bloqueado sin pago inicial verificado; cierre bloqueado con importes aceptados pendientes.
- Historial y saldos coherentes en los tres paneles, sin acceso a órdenes ajenas.
- Replay, fallos y concurrencia no duplican cobros iniciados por la aplicación, asignaciones ni avisos; las ambigüedades se resuelven antes de recrear.
- Inbox y conciliación se recuperan tras interrupciones y presentan discrepancias administrativamente.
- Liquidación únicamente calculada/simulada; no se afirma transferencia, saldo retirable ni reembolso ejecutado.
- Pruebas de aplicación, permisos, regresión y restauración aislada acreditadas con límites explícitos.
- Sin cobros reales, migraciones productivas, push ni deploy.

## 13. Fuentes externas verificadas durante planificación

Reconsultar el contrato vigente antes de integrar credenciales; no introducir actualizaciones de dependencias por rutina.

- API, firma, creación y consultas por token/referencia/FlowOrder: https://developers.flow.cl/api
- Quickstart Sandbox: https://developers.flow.cl/docs/quick-start
- Confirmación POST, form-urlencoded y respuesta HTTP 200 en menos de 15 segundos: https://developers.flow.cl/docs/tutorial-basics/order-confirmation
- Retorno POST del navegador: https://developers.flow.cl/docs/tutorial-basics/order-finished
- Estados oficiales: https://developers.flow.cl/docs/tutorial-basics/status
- Seguridad de funciones y grants Supabase: https://supabase.com/docs/guides/database/functions
- RLS y privilegios: https://supabase.com/docs/guides/database/postgres/row-level-security
- Cambios de CLI v3: https://supabase.com/changelog/supabase-cli-v3

## 14. Entrega para revisión de Codex

Claude Code entregará resumen del comportamiento final, archivos cambiados, migración revisable, git diff, pruebas/comandos/resultados, evidencia sanitizada, restauración y limpieza, decisiones de implementación y riesgos pendientes.

Codex comprobará cumplimiento de este plan, regresiones, RLS, autorización, fórmulas, concurrencia y evidencia real antes de recomendar el siguiente paso. No se autoriza una publicación por el hecho de completar las pruebas.

