# Sprint 04 — gestión operacional de trabajos

Continuar sobre `jobs` y el snapshot de `quotes`, conservando la adjudicación única de Sprint 03. No reproducir migraciones históricas ni crear otro modelo de contratación.

## Punto de partida

Un cliente puede publicar, comparar propuestas, confirmar una selección y generar una adjudicación persistente con auditoría. El estado inicial es `awarded`; pago `not_enabled`. La ejecución está bloqueada por restricciones DB y por ausencia de RPC de avance. El snapshot conserva precio entero CLP, desglose, condiciones, vigencia, versión e identidad profesional revisada.

## Trabajo propuesto

1. Definir con el responsable comercial las condiciones de ejecución: Flow integrado en un sprint posterior o piloto explícitamente aprobado sin pago integrado. Ningún cambio de estado debe implicar que existe un pago.
2. Añadir estados de trabajo y transiciones autorizadas: coordinación de agenda, confirmación de ambas partes, traslado/llegada, inicio y propuesta de finalización, confirmación del cliente, cierre. Mantener separados request/quote/job/payment. Acordar evidencias, plazos y quién puede actuar; no inventar esas reglas comerciales.
3. Implementar RPC transaccionales con revisión, idempotencia, bloqueos, estado previo y actor. Conservar sesión viva/cuenta actual y resolver cómo una suspensión profesional afecta trabajos ya adjudicados, soporte y acceso a dirección. Sin UPDATE genérico ni edición del snapshot.
4. Cancelaciones por actor y etapa, motivo y auditoría; reclamo básico con estado, responsables y adjuntos privados. No inventar reembolsos ni penalidades financieras.
5. Paneles cliente/técnico y supervisión admin para la agenda y seguimiento. Solicitar confirmaciones explícitas, mostrar pendientes y errores y reautorizar cada descarga privada.
6. Notificaciones mediante outbox transaccional y worker idempotente. Integrar el proveedor SMTP aprobado, supresión/bounce y monitoreo; las notificaciones no deben revelar direcciones ni documentos en el asunto.
7. Preparar contrato Flow: orden e importe desde snapshot, intentos, correlación, estados financieros separados, verificación de firma, webhook idempotente, conciliación y eventos. Solo sandbox autorizado; no credenciales reales, cargos, pagos, liquidaciones ni devoluciones.

## Pruebas y gates

PostgreSQL aislado primero; presentar cada migración nueva con diff, impacto, backup y rollback. Sobre Fixo existente, nueva aprobación específica. JWT propios cliente A/B, técnico asignado/no asignado, administrador, suspensión con sesión anterior, replay y dos transiciones simultáneas. Probar finalización no confirmada, cancelación frente a inicio, reclamo frente a cierre, snapshot inmutable y rol actual. Navegador desktop/móvil, teclado, loading/error, ausencia de overflow. Fixtures con UUID exactos/manifiesto y limpieza verificada.

## Dependencias antes de operación comercial

SMTP real con dominio autenticado y pruebas de entrega/expiración; requisitos definitivos y técnicos aprobados; worker permanente con firmas/alertas; staging separado y backup/restore comprobado; origen canónico y variables por entorno; CI y preview validados; términos comerciales y política de cancelación; autorización de publicación. El plan Pro publicado de Supabase parte de USD 25/mes y cada proyecto adicional añade compute desde aproximadamente USD 10/mes: dos Micro en una misma organización implican base estimada USD 35/mes antes de uso/extras, calculada a partir de la tarifa oficial, **no una cotización contractual de la cuenta**. [Facturación oficial](https://supabase.com/docs/guides/platform/your-monthly-invoice). No se cambió el plan Free ni se crearon recursos pagados.

La base técnica permite iniciar Sprint 04. La apertura comercial depende de cerrar esos gates y aprobar el modelo de ejecución/pago; una cotización aceptada no los sustituye.
