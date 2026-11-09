# Fixo — plan de Sprint 03

Fecha: 9 de noviembre de 2026. Base de partida: identidad y postulación profesional probadas contra PostgreSQL real. **Preparación permitida; no comenzar operaciones comerciales mientras existan gates de correo, inspección continua y release.**

## Entrada verificable

1. Consolidar `SPRINT_01_INTEGRATION_REPORT.md`, `SPRINT_02_REPORT.md` y evidencia final de SQL, APIs y navegador. Conservar pruebas previas y fixes de PostgREST/Storage.
2. Configurar correo de captura, probar registro público, callback OTP/PKCE en otro contexto, recuperación/expiración y envío/reenvío de invitaciones sin destinatarios externos. Aprobar SMTP y dominios comerciales por separado.
3. Acordar criterios reales por categoría, fuentes legales confirmadas y responsables de revisión. El sistema no incorpora obligaciones legales inventadas; categorías sin reglas permanecen cerradas para publicación.
4. Provisionar y aprobar un worker real de inspección con ClamAV actualizado o un proveedor autorizado. Probar clean, detección, error, timeout, firmas antiguas, reintentos y conciliación de objetos huérfanos, sin abrir cuarentena por conveniencia.
5. Resolver aislamiento de entornos al liberar cuota o aprobar costos; la base actual fue autorizada para integración y conserva dos cuentas iniciales. No convertirla silenciosamente en un entorno comercial ni conectar Preview a datos reales.

## Alcance propuesto

| Caso | Trabajo | Aceptación real |
| --- | --- | --- |
| C01 | Solicitud de cliente completa y persistente, reutilizando `service_requests` | JWT customer A crea/consulta; customer B no lee ni modifica; campos de estado/asignación no se aceptan por overposting. |
| C02 | Edición, envío y cancelación guardada | Máquina de estados y RPC con revisión/idempotencia; `PT409` para versión vieja, nunca `40001` como error de negocio. Historial con actor/motivo. |
| C03 | Distribución a profesionales elegibles | Solo técnicos con cuenta activa y publicación vigente, cobertura/rubro declarados y documentos satisfechos; suspensión y cambios de requisitos bloquean nuevas operaciones. |
| C04 | Cotización persistente | Técnico A/B autorizados por oportunidad; cliente propietario ve propuestas propias; impedir duplicados y concurrencia sobre estados. Sin cobros reales. |
| C05 | Selección y cierre de oportunidad | Operaciones transaccionales, una selección efectiva, auditoría y revisión vigente; definir reglas de expiración y cancelación con negocio antes de implementarlas. |
| C06 | UI cliente/técnico/admin y pruebas | Formularios desktop/mobile/teclado, errores y pending; dos clientes/dos técnicos con JWT, sesiones previas suspendidas, RLS/RPC/HTTP reales y rollback/limpieza sintética. |
| C07 | Entrega | npm ci/lint/typecheck/test/build/audit, SQL real, browser y smoke; commits locales, PR/push/preview solamente con autorización explícita. |

## Fuera de alcance

Flow/cobros, comisiones y liquidaciones reales, suscripciones, chat, IA y urgencias. No presentar métricas comerciales inventadas ni activar publicidad para suplir gates técnicos pendientes.

## Publicación

Flujo objetivo: desarrollo → GitHub/CI → preview con Supabase y correo aislados → revisión por SHA → aprobación → release. El workflow local no equivale a GitHub Actions ejecutado. Mantener rollback de app separado de migraciones DB y caché de documentos. Ningún push, deploy, facturación o cambio Auth/DNS está incluido en este plan.
