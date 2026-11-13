# Fixo — Análisis de brechas P0 (Gap Analysis)

> Documento histórico de la etapa demo. La [auditoría Sprint 00](production/SPRINT_00_AUDIT.md) y la [estabilización Sprint 00.5](production/SPRINT_00_5_REPORT.md) reemplazan su evaluación. Activar demo en Vercel está prohibido por el código actual; los ejemplos siguientes describen un estado anterior, no instrucciones para producción.

Fecha de este corte: sesión de implementación de cotizaciones y urgencias (quotes + emergencies) sobre la base de Demo Mode y marketplace ya estabilizados.
Referencia: `marketplace_tecnicos_master.md`.

Leyenda de **Estado**: `IMPLEMENTADO` · `PARCIAL` · `SOLO MOCK/CONECTADO A FIXTURES` · `FALTA`.

| Área | Estado | Implementado | Falta | Severidad | Próximo paso |
|---|---|---|---|---|---|
| Foundation (arquitectura UI→Servicios→Repos→Infra) | IMPLEMENTADO | Contratos en `src/repositories/contracts`, servicios en `src/services/*`, factory `repository-factory.ts` que resuelve Mock vs Supabase. | Nada crítico. | — | Mantener disciplina al agregar nuevos módulos. |
| Demo Mode | IMPLEMENTADO | `isDemoModeEnabled()`, repos Mock de técnicos y solicitudes, fixtures Chile-realistas (12 técnicos, categorías, cuentas demo, solicitudes), auth demo por cookie. | Falta un botón "Reiniciar demo" que restaure fixtures mutadas a su estado original. | Media | Agregar acción de reset en `/admin`. |
| Marketplace `/tecnicos` | IMPLEMENTADO (antes: BROKEN, 0 técnicos) | Causa raíz corregida: el factory ya no fuerza Supabase; filtros por texto/categoría y orden (`recomendado`, `rating`, `experiencia`, `respuesta`) funcionando de extremo a extremo. | Faltan filtros de ubicación/comuna y "solo urgencias" en la UI (el contrato ya soporta extenderlos). | Media | Etapa 2: agregar filtro de comuna y disponibilidad. |
| Perfil público de técnico `/tecnicos/[slug]` | IMPLEMENTADO | Lee del mismo repositorio (Mock/Supabase transparente). | Sin reseñas reales conectadas (placeholder). | Media | Etapa 9: reviews. |
| Dashboard cliente `/cliente` | PARCIAL | Lectura de solicitudes propias vía Mock/Supabase; cada solicitud enlaza a `/cliente/solicitudes/[id]` para comparar y aceptar cotizaciones. | Falta un resumen agregado de pagos/historial real y notificación push cuando llega una nueva cotización. | Media | Etapa 7/8. |
| Crear solicitud `/solicitar` | IMPLEMENTADO | Migrado a Server Action; además, en Demo Mode la solicitud avanza automáticamente a `receiving_quotes` (no existe una demora real de matching) para que el flujo de cotizaciones sea recorrible de punta a punta. | Falta orientación por IA antes de enviar (comparte motor con urgencias, pendiente de reutilizar aquí). | Media | Reutilizar `MockAiProvider` también en `/solicitar`. |
| Urgencia `/urgencia` | IMPLEMENTADO | Máquina de estados dedicada (`EmergencyStatus`/`canTransitionEmergency`), `EmergencyRequest`/`EmergencyStatusEvent`, `MockAiProvider` (orientación + banderas de seguridad), `EmergencyMatchingService` (candidatos reales vía `TechnicianRepository.search`), adjudicación atómica (`acceptEmergency`), `EmergencyService` completo y wizard end-to-end en `/urgencia` (describir → orientación IA → matching → broadcasting → aceptación → confirmación → seguimiento en vivo → cierre). | Persistencia Supabase de emergencias es un stub (`SupabaseEmergencyRepository`); no hay notificaciones push reales al técnico convocado (se simula con un botón de demo). | Media | Implementar Supabase + RPC atómica y notificaciones. |
| Cotizaciones (quotes) | IMPLEMENTADO | Entidad `Quote` completa (precio, materiales, visita de diagnóstico, condiciones, expiración) + `AcceptedQuoteSnapshot` contractual; `QuoteStatus`/`canTransitionQuote`; `QuoteRepository` (Mock + stub Supabase) con aceptación atómica que rechaza automáticamente las cotizaciones hermanas; `QuoteService` con ownership y orquestación de `Job`; UI: técnico crea/envía/guarda borrador (`/tecnico/oportunidades/[id]/cotizar`), cliente compara y acepta (`/cliente/solicitudes/[id]`). | Persistencia Supabase es un stub; falta edición de una cotización ya enviada (sólo retirar). | Media | Implementar Supabase + RPC atómica para `accept`. |
| Dashboard técnico `/tecnico` | PARCIAL | Oportunidades reales (solicitudes abiertas por rubro + urgencias que lo convocan), envío de cotizaciones y trabajos activos ahora leen de los repositorios reales. | Agenda y pagos siguen siendo pantallas mayormente estáticas; métricas del resumen (`newOpportunities`, ingresos) siguen en placeholder. | Alta | Etapa 6 (agenda/pagos) y métricas reales. |
| Ciclo de vida de trabajos (job-status) | IMPLEMENTADO en Demo Mode | `JobRepository` (Mock + stub Supabase) persiste trabajos originados tanto de cotizaciones aceptadas como de urgencias confirmadas; `TechnicianJobsService` sincroniza siempre el estado del `Job` con el de la urgencia asociada (bug de desincronización detectado y corregido en `EmergencyService.confirmAssignment`). | Persistencia Supabase es un stub. | Media | Implementar `SupabaseJobRepository`. |
| Chat | FALTA | — | Sin dominio, contrato ni UI. | Alta | Etapa 8. |
| Reviews / reputación | FALTA | Rating agregado en fixtures de técnico. | Sin flujo de creación de reseñas ni recálculo de reputación. | Alta | Etapa 9. |
| Reportes (admin) | SOLO MOCK | Pantalla existe. | Sin repositorio de reportes conectado a Mock/Supabase. | Media | Etapa 10. |
| Admin — gestión de técnicos | IMPLEMENTADO en Demo Mode | `MockAdminManagementStore` + factory permiten aprobar/suspender/reactivar y ver audit log sin Supabase. | En modo real falta poblar RLS/políticas para esas mutaciones. | Media | Validar políticas RLS antes de producción real. |
| Auditoría (`audit-log`) | IMPLEMENTADO en Demo Mode | Entradas en memoria por sesión, visibles en `/admin/audit-log`. | No persiste entre reinicios del servidor (aceptable para demo). | Baja | — |
| Pagos (abstracción) | FALTA | Carpeta `src/integrations/payments/` existe. | Sin proveedor implementado ni UI de estado de pago conectada. | Alta | Etapa futura (post P0 de flujo). |
| Notificaciones | FALTA | Carpeta `src/integrations/notifications/` existe. | Sin proveedor ni disparo de eventos. | Media | Post P0. |
| Ubicación (location) | FALTA | Carpeta `src/integrations/location/` existe. | Sin geocoding/distancia real conectado a matching. | Media | Post P0. |
| Supabase / migraciones / RLS | IMPLEMENTADO (para lo ya modelado) | Migración inicial en `supabase/migrations/`. | No se agregaron migraciones para quotes/chat/reviews (no requerido en esta sesión, ya que no se tocó el modelo real). | — | Se crearán junto con cada etapa que las necesite. |
| Testing | PARCIAL | Tests de transición de estados (`service-request-status`, `technician-status`, `job-status`, `quote-status`, `emergency-status`), tests de `demo-mode`/`MockTechnicianRepository`, y nuevos tests de servicios (`QuoteService.acceptQuote`: aceptación atómica + rechazo de hermanas + ownership; `EmergencyService`: flujo feliz completo end-to-end, técnicos no convocados/suspendidos, adjudicación única). 43 tests, todos verdes. | Sin tests de matching/ranking avanzado ni de los Server Actions/UI (sólo servicios y dominio). | Media | Agregar tests de integración de Server Actions si se requiere mayor cobertura. |
| Accesibilidad / responsive | PARCIAL | Componentes usan Tailwind responsive y roles ARIA básicos. | Sin auditoría formal. | Baja | Revisión dedicada. |
| Build / Deploy | IMPLEMENTADO | `lint`, `typecheck`, `test`, `build` verdes en este corte. | — | — | — |

## Nota crítica sobre la causa raíz del marketplace vacío

El repo local (`.env.local`) **sí tiene credenciales reales de Supabase configuradas**. Esto significa que, en producción, si esas mismas credenciales están en Vercel, `isDemoModeEnabled()` NO se activará automáticamente (Supabase se considera "configurado"). Para que la demo se pueda recorrer completamente en producción hay dos caminos, no mutuamente excluyentes:

1. Definir `NEXT_PUBLIC_DEMO_MODE=true` explícitamente en las variables de entorno de Vercel (solución inmediata, cero riesgo, no toca datos reales).
2. Poblar (seed) la base Supabase real con datos coherentes y dejar `NEXT_PUBLIC_DEMO_MODE` sin definir o en `false`.

Ambas rutas ya están soportadas por el código; la elección es una decisión de producto/despliegue, no de ingeniería adicional.
