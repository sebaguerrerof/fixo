# Marketplace de Técnicos — Master Product & Engineering Specification

> Documento maestro para Codex  
> Objetivo: construir una plataforma confiable para conectar clientes con técnicos y especialistas, con solicitudes normales y urgentes, reputación, pagos, moderación, operación tipo marketplace y asistencia mediante IA.

---

# 1. Rol del agente

Actúa como:

- Staff Full-Stack Engineer
- Software Architect
- Product Engineer
- AI Engineer
- SaaS Architect
- UX/UI Engineer
- Tech Lead
- Revisor de seguridad y calidad técnica

Tu responsabilidad no es solamente generar pantallas.

Debes diseñar e implementar un producto:

- modular;
- mantenible;
- seguro;
- escalable;
- consistente;
- desplegable;
- mobile-first;
- preparado para crecer.

Prioriza:

1. arquitectura;
2. experiencia de usuario;
3. integridad de datos;
4. seguridad;
5. reputación y confianza;
6. mantenibilidad;
7. costos;
8. separación de responsabilidades;
9. consistencia del design system;
10. capacidad futura de crecimiento.

No implementes soluciones improvisadas que después deban ser reconstruidas.

---

# 2. Visión del producto

Construir una plataforma tipo **marketplace + red profesional + sistema de contratación de servicios**, inspirada conceptualmente en la simpleza operacional de plataformas como Uber, pero enfocada en técnicos y especialistas.

Ejemplos de rubros:

- electricistas;
- gasfíteres;
- técnicos de electrodomésticos;
- técnicos automotrices;
- cerrajeros;
- técnicos de aire acondicionado;
- refrigeración;
- computadores;
- redes;
- electrónica;
- construcción;
- carpintería;
- pintura;
- mantenciones;
- jardinería;
- instalación de cámaras;
- especialistas del hogar;
- especialistas para empresas;
- cualquier nuevo rubro configurable por administración.

La plataforma NO debe quedar acoplada a una lista fija de profesiones.

Los rubros, categorías, especialidades, etiquetas y requisitos deben administrarse desde base de datos.

---

# 3. Problema que resolvemos

Contratar técnicos normalmente depende de:

- recomendaciones informales;
- grupos de WhatsApp;
- publicaciones en redes sociales;
- información poco verificable;
- dificultad para saber disponibilidad;
- dificultad para saber si el precio es razonable;
- poca trazabilidad;
- reputación difícil de comprobar;
- ausencia de mecanismos de reclamo;
- poca capacidad de respuesta ante urgencias.

La plataforma debe crear una **red de confianza verificable**.

---

# 4. Propuesta de valor

## Para clientes

- encontrar técnicos;
- filtrar por especialidad;
- visualizar perfiles;
- revisar experiencia;
- ver trabajos anteriores;
- revisar reputación;
- solicitar presupuestos;
- pedir servicios normales;
- pedir servicios urgentes;
- recibir orientación mediante IA;
- comparar propuestas;
- contratar;
- pagar desde la plataforma;
- seguir el estado del servicio;
- conversar con el técnico;
- evaluar;
- generar reclamos;
- mantener historial;
- guardar técnicos favoritos.

## Para técnicos

- generar nuevos clientes;
- construir reputación;
- crear perfil profesional;
- publicar trabajos;
- mostrar certificaciones;
- indicar cobertura;
- configurar disponibilidad;
- recibir solicitudes;
- aceptar o rechazar trabajos;
- enviar cotizaciones;
- cobrar desde la plataforma;
- mantener historial;
- aumentar visibilidad según desempeño;
- construir una cartera de clientes.

## Para la plataforma

- crear un marketplace escalable;
- monetizar transacciones;
- cobrar planes o membresías futuras;
- ofrecer mayor visibilidad;
- controlar estándares de calidad;
- identificar fraude;
- intervenir ante conflictos;
- construir una red profesional confiable.

---

# 5. Stack tecnológico obligatorio

## Aplicación

- Next.js con App Router
- React
- TypeScript estricto
- Tailwind CSS
- shadcn/ui
- Lucide Icons
- React Hook Form
- Zod

## Backend y datos

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime cuando aporte valor
- Row Level Security
- Server Actions y Route Handlers según corresponda

## Infraestructura

- Vercel
- variables de entorno separadas:
  - local;
  - preview;
  - production.

## Base de datos

- migraciones SQL versionadas;
- UUID como identificador principal salvo razón técnica documentada;
- foreign keys reales;
- índices;
- unique constraints;
- check constraints;
- timestamps;
- auditoría para acciones críticas.

---

# 6. Principios de arquitectura

Aplicar:

- SOLID;
- DRY;
- KISS;
- separación de responsabilidades;
- arquitectura modular;
- dominio desacoplado de UI;
- dominio desacoplado de infraestructura.

Flujo recomendado:

```text
UI
↓
Server Actions / Route Handlers
↓
Application Services
↓
Repositories
↓
Supabase / servicios externos
```

Evitar:

- lógica de negocio dentro de JSX;
- llamadas directas a Supabase repartidas por componentes;
- archivos gigantes;
- componentes monolíticos;
- uso de `any`;
- duplicación de queries;
- arrays de IDs como reemplazo de relaciones;
- estados de dominio como strings dispersos;
- estilos hardcodeados repetidos;
- múltiples fuentes de verdad.

---

# 7. Design System

Crear un design system centralizado desde el inicio.

Debe incluir tokens semánticos para:

- colores;
- tipografía;
- spacing;
- border radius;
- bordes;
- sombras;
- tamaños;
- success;
- warning;
- danger;
- info;
- muted;
- surface;
- background.

Crear componentes reutilizables para:

- botones;
- inputs;
- selects;
- combobox;
- badges;
- cards;
- avatars;
- ratings;
- dialogs;
- drawers;
- toasts;
- breadcrumbs;
- tabs;
- filtros;
- tablas;
- empty states;
- skeletons;
- alerts;
- status badges;
- timeline;
- stepper;
- tarjetas de técnicos;
- tarjetas de solicitudes;
- tarjetas de cotización;
- tarjeta de servicio activo.

La UI debe ser mobile-first.

---

# 8. Roles principales

## 8.1 Cliente

Puede:

- crear cuenta;
- administrar perfil;
- administrar direcciones;
- pedir servicios;
- pedir urgencias;
- conversar con IA;
- adjuntar fotografías;
- recibir propuestas;
- contratar;
- pagar;
- conversar con el técnico;
- confirmar realización;
- evaluar;
- reportar problemas;
- guardar favoritos;
- ver historial.

## 8.2 Técnico

Puede:

- crear perfil profesional;
- ingresar identidad;
- agregar rubros;
- agregar especialidades;
- registrar experiencia;
- agregar certificaciones;
- subir documentos;
- definir cobertura;
- indicar disponibilidad;
- activar/desactivar recepción de urgencias;
- recibir solicitudes;
- postular/cotizar;
- aceptar servicios;
- actualizar estados;
- adjuntar evidencia;
- completar trabajos;
- ver pagos;
- ver reputación;
- responder evaluaciones cuando corresponda.

## 8.3 Moderador / Operaciones

Puede:

- revisar técnicos;
- revisar validaciones;
- revisar solicitudes denunciadas;
- gestionar conflictos;
- suspender temporalmente;
- pedir antecedentes;
- revisar pagos asociados;
- aplicar medidas.

## 8.4 Superadministrador

Control total.

Puede:

- crear y administrar rubros;
- crear categorías;
- configurar requisitos;
- aprobar/rechazar técnicos;
- suspender técnicos;
- bloquear técnicos;
- retirar técnicos;
- revisar denuncias;
- revisar historial completo;
- administrar usuarios;
- administrar solicitudes;
- administrar servicios;
- administrar pagos;
- configurar comisiones;
- administrar contenido;
- definir reglas;
- administrar features;
- acceder al audit log.

Las operaciones destructivas o críticas deben quedar auditadas.

---

# 9. Onboarding y verificación de técnicos

El onboarding debe ser progresivo.

## Estados

```text
draft
pending_verification
needs_information
verified
active
temporarily_suspended
suspended
banned
rejected
```

NO usar un simple boolean `is_active`.

## Información posible

- nombre;
- fotografía;
- biografía;
- teléfono;
- email;
- identificación;
- dirección base;
- comunas o zonas;
- radio de cobertura;
- rubros;
- especialidades;
- experiencia;
- fotografías de trabajos;
- certificados;
- documentos;
- vehículo disponible;
- posibilidad de urgencias;
- disponibilidad;
- métodos de trabajo;
- precio referencial cuando corresponda.

Determinados rubros pueden requerir documentación específica.

---

# 10. Rubros, categorías y especialidades

Modelar dinámicamente.

Ejemplo conceptual:

```text
Hogar
 ├── Electricidad
 │    ├── Instalaciones
 │    ├── Cortocircuitos
 │    └── Tableros
 ├── Gasfitería
 │    ├── Fugas
 │    ├── Cañerías
 │    └── Instalaciones
 └── Electrodomésticos
      ├── Refrigeradores
      ├── Lavadoras
      └── Hornos

Automotriz
 ├── Mecánica
 ├── Electricidad
 ├── Baterías
 └── Diagnóstico
```

NO hardcodear esta jerarquía.

---

# 11. Perfil público del técnico

Debe funcionar como mezcla entre ficha profesional y perfil social.

Mostrar:

- foto;
- nombre;
- verificación;
- rating;
- número de servicios;
- especialidades;
- años de experiencia;
- zonas;
- disponibilidad;
- tiempo de respuesta;
- tasa de finalización;
- trabajos publicados;
- fotografías;
- evaluaciones;
- badges;
- certificaciones verificadas;
- botón de solicitar servicio;
- botón de solicitar urgencia si está disponible.

---

# 12. Red social profesional

P0 puede ser liviano, pero debe dejar arquitectura preparada.

Los técnicos podrán publicar:

- trabajos realizados;
- fotografías antes/después;
- consejos;
- casos;
- nuevas certificaciones.

Los clientes podrán:

- visualizar contenido;
- entrar al perfil;
- solicitar el servicio desde una publicación.

En fases posteriores:

- reacciones;
- guardados;
- comentarios moderados;
- seguir técnicos.

La reputación principal debe provenir de trabajos verificados dentro de la plataforma.

---

# 13. Solicitud de servicio

Un cliente puede crear una solicitud indicando:

- categoría;
- especialidad;
- descripción;
- ubicación;
- fotografías;
- disponibilidad;
- prioridad;
- fecha deseada;
- información generada durante orientación IA.

Estados:

```text
draft
submitted
matching
receiving_quotes
technician_selected
awaiting_payment
scheduled
in_progress
completed
cancelled
expired
disputed
```

Diseñar explícitamente las transiciones válidas.

---

# 14. Solicitud normal

Flujo:

```text
Cliente describe problema
→ IA ayuda a clasificar
→ sistema crea solicitud
→ matching encuentra técnicos compatibles
→ técnicos reciben oportunidad
→ técnicos envían propuesta/cotización
→ cliente compara
→ cliente selecciona
→ pago/autorización
→ agenda
→ servicio
→ finalización
→ evaluación
```

---

# 15. Modo urgencia

Debe ser una función principal.

Ejemplos:

- fuga de agua;
- corte eléctrico;
- problema de cerradura;
- panne;
- electrodoméstico crítico;
- otros configurables.

## Flujo

```text
Cliente activa "Necesito ayuda ahora"
→ describe el problema
→ IA clasifica y detecta riesgos
→ ubicación
→ sistema filtra técnicos:
   - rubro compatible
   - verificados
   - activos
   - dentro de cobertura
   - disponibilidad de urgencia
→ se envía solicitud
→ técnico apropiado acepta
→ cliente confirma
→ servicio activo
```

Evitar carreras de concurrencia donde dos técnicos puedan adjudicarse el mismo trabajo.

La aceptación debe resolverse de forma atómica/transaccional.

## Estados

```text
created
matching
broadcasting
accepted
technician_en_route
arrived
in_progress
completed
cancelled
expired
disputed
```

---

# 16. Matching

Crear un servicio desacoplado:

```text
MatchingService
```

Factores posibles:

- rubro;
- especialidad;
- distancia;
- cobertura;
- disponibilidad;
- verificación;
- rating;
- volumen de evaluaciones;
- tasa de finalización;
- cancelaciones;
- tiempo promedio de respuesta;
- precio aproximado;
- urgencias habilitadas;
- penalizaciones.

P0 puede usar scoring explícito, testeable y configurable.

Registrar el motivo de los resultados cuando sea posible.

---

# 17. Reputación

No depender solamente de un promedio simple.

Mantener:

- rating promedio;
- total de evaluaciones;
- servicios completados;
- cancelaciones;
- disputas;
- reclamos validados;
- tiempo de respuesta;
- puntualidad;
- tasa de finalización;
- antigüedad;
- documentación verificada.

Una reseña debe estar asociada a un servicio real.

---

# 18. Evaluaciones

Después de un servicio el cliente puede evaluar:

- calidad;
- puntualidad;
- comunicación;
- precio vs lo acordado;
- limpieza/orden;
- valoración general;
- comentario.

Agregar moderación.

---

# 19. Moderación y malos servicios

Tipos de incidentes:

- cobro distinto al acordado;
- trabajo defectuoso;
- técnico no se presenta;
- abandono;
- daño;
- conducta inapropiada;
- fraude;
- documentación falsa;
- seguridad;
- incumplimiento reiterado;
- manipulación del sistema;
- cliente problemático;
- otros.

Crear:

- reportes;
- evidencias;
- comentarios internos;
- historial;
- resolución;
- sanciones;
- audit logs.

## Sanciones

```text
warning
visibility_reduction
temporary_restriction
temporary_suspension
suspension
ban
```

Nunca eliminar silenciosamente evidencia histórica relevante.

---

# 20. Pagos

Diseñar mediante una capa de abstracción:

```text
PaymentProvider
```

La aplicación NO debe quedar acoplada a un único proveedor.

P0 puede usar:

```text
MockPaymentProvider
```

Conceptos:

- total;
- comisión de plataforma;
- monto para técnico;
- impuestos/configuración;
- estado de pago;
- devolución;
- ajuste;
- disputa.

## Estados

```text
pending
requires_action
authorized
paid
partially_refunded
refunded
failed
cancelled
disputed
```

El estado del servicio y el estado del pago son dominios separados.

---

# 21. Cotizaciones

Una propuesta debe guardar:

- técnico;
- solicitud;
- precio;
- moneda;
- descripción;
- materiales incluidos;
- materiales no incluidos;
- visita/diagnóstico;
- tiempo estimado;
- fecha disponible;
- condiciones;
- expiración.

Estados:

```text
draft
submitted
accepted
rejected
withdrawn
expired
```

No sobrescribir una cotización aceptada.

Guardar snapshot/versionado de información contractual relevante.

---

# 22. Chat cliente ↔ técnico

P0:

- conversación asociada a solicitud o trabajo;
- mensajes;
- timestamps;
- adjuntos;
- unread.

Diseñar preparado para Supabase Realtime.

Mensajes del sistema:

- cotización enviada;
- servicio aceptado;
- técnico en camino;
- servicio iniciado;
- servicio finalizado;
- pago confirmado.

---

# 23. Agente de IA

Crear un módulo desacoplado:

```text
AIService
AIProvider
```

Nunca llamar al modelo directamente desde componentes.

## Funciones

El agente puede:

- ayudar a describir el problema;
- identificar rubro probable;
- identificar especialidad;
- formular preguntas;
- solicitar fotografías;
- detectar información faltante;
- generar resumen estructurado;
- sugerir nivel de urgencia;
- explicar próximos pasos;
- orientar sobre el tipo de profesional requerido.

Salida estructurada validada con Zod.

Ejemplo:

```ts
{
  suggestedCategoryId,
  suggestedSpecialtyId,
  urgencyLevel,
  summary,
  questions,
  safetyFlags,
  confidence
}
```

## Seguridad del agente IA

La IA:

- no debe afirmar diagnósticos técnicos como certeza cuando no puede verificarlos;
- no debe enseñar maniobras peligrosas;
- debe detectar situaciones de riesgo;
- debe recomendar ayuda profesional cuando corresponda;
- debe diferenciar orientación de diagnóstico.

Situaciones de riesgo:

- gas;
- electricidad;
- fuego;
- monóxido;
- presión;
- estructuras;
- vehículos inseguros.

---

# 24. Modelo de datos inicial

Crear migraciones reales para las entidades P0.

Entidades sugeridas:

```text
profiles
user_roles

technician_profiles
technician_verifications
technician_documents
technician_service_areas
technician_availability
technician_emergency_settings

categories
specialties
category_specialties
technician_categories
technician_specialties

technician_portfolio_items
technician_certifications

customer_addresses

service_requests
service_request_attachments
service_request_ai_assessments

service_matches
quotes

jobs
job_status_history

conversations
conversation_participants
messages
message_attachments

payments
payment_transactions
refunds

reviews
review_dimensions

reports
report_evidence
report_actions

technician_sanctions

favorites
notifications
audit_logs
```

Agregar tablas extras solamente si existe necesidad real de dominio.

---

# 25. Relaciones y normalización

Reglas:

- no almacenar listas de foreign keys en arrays;
- usar tablas puente para N:N;
- mantener parent/child explícito;
- un único origen de verdad por concepto;
- constraints desde la base;
- índices según patrones de consulta;
- timestamps coherentes;
- separar estados de solicitud, trabajo y pago;
- no duplicar perfiles innecesariamente;
- `profiles` representa identidad común;
- `technician_profiles` extiende identidad para técnicos.

---

# 26. RLS

La seguridad debe existir desde P0.

## Cliente

Puede:

- ver/modificar sus solicitudes;
- acceder a conversaciones donde participa;
- ver sus pagos;
- generar evaluaciones válidas.

## Técnico

Puede:

- modificar su perfil permitido;
- visualizar oportunidades asignadas o compatibles;
- administrar cotizaciones propias;
- administrar trabajos donde participa;
- ver conversaciones propias.

## Administración

Capacidades sensibles deben resolverse server-side.

No confiar solamente en ocultar botones.

---

# 27. Auditoría

Registrar acciones importantes:

- aprobaciones;
- rechazo de técnicos;
- cambios manuales de estado;
- suspensiones;
- bans;
- resolución de reportes;
- reembolsos;
- modificaciones financieras;
- cambios de permisos;
- acciones administrativas críticas.

Guardar:

- actor;
- acción;
- entidad;
- entity_id;
- metadata;
- timestamp.

---

# 28. Panel cliente

P0:

- dashboard;
- solicitar técnico;
- botón de urgencia;
- solicitudes activas;
- historial;
- pagos;
- favoritos;
- perfil.

---

# 29. Panel técnico

P0:

- dashboard;
- nuevas oportunidades;
- urgencias;
- trabajos activos;
- agenda;
- cotizaciones;
- perfil profesional;
- disponibilidad;
- cobertura;
- reputación;
- pagos;
- configuración.

Métricas:

- solicitudes recibidas;
- tasa de respuesta;
- trabajos realizados;
- rating;
- ingresos demo;
- trabajos activos.

---

# 30. Panel superadmin

P0:

- dashboard;
- usuarios;
- técnicos;
- verificaciones;
- categorías;
- especialidades;
- solicitudes;
- trabajos;
- reportes;
- pagos;
- sanciones;
- audit log.

Métricas:

- técnicos activos;
- pendientes de verificar;
- solicitudes;
- urgencias;
- trabajos completados;
- GMV mock;
- comisiones mock;
- disputas abiertas.

---

# 31. Geolocalización

Diseñar una capa:

```text
LocationService
```

La base debe soportar:

- latitud;
- longitud;
- dirección normalizada;
- comuna/ciudad;
- región;
- país;
- radio;
- zonas.

No acoplar dominio a un único proveedor de mapas.

---

# 32. Notificaciones

Crear:

```text
NotificationService
```

Canales futuros:

- in-app;
- email;
- push;
- WhatsApp.

P0:

- in-app;
- mocks para externos.

Eventos:

- solicitud recibida;
- urgencia disponible;
- cotización;
- cotización aceptada;
- técnico asignado;
- técnico en camino;
- servicio iniciado;
- servicio finalizado;
- pago;
- evaluación;
- reporte.

---

# 33. Demo Mode

Debe existir:

```env
NEXT_PUBLIC_DEMO_MODE=true
```

En Demo Mode:

- no requiere Supabase;
- no requiere proveedor de pagos;
- no requiere API de IA;
- usa repositorios mock;
- usa fixtures coherentes;
- permite recorrer flujos principales.

Debe poder alternarse infraestructura sin reescribir UI.

Ejemplo:

```text
ServiceRequestRepository
├── SupabaseServiceRequestRepository
└── MockServiceRequestRepository
```

Aplicar principio similar a:

- Auth;
- pagos;
- IA;
- notificaciones;
- ubicación.

---

# 34. Datos demo

Crear datos realistas:

- al menos 12 técnicos;
- varias categorías;
- ratings distintos;
- ubicaciones;
- técnicos verificados;
- un técnico suspendido;
- solicitudes normales;
- solicitudes urgentes;
- cotizaciones;
- trabajos activos;
- trabajos completados;
- evaluaciones;
- reportes;
- pagos.

No usar lorem ipsum.

---

# 35. Home / Landing

## Hero

Concepto:

> El técnico que necesitas, cuando lo necesitas.

CTA:

- Buscar técnico
- Necesito ayuda urgente

## Secciones

- categorías populares;
- cómo funciona;
- técnicos destacados;
- confianza y verificación;
- trabajos recientes;
- urgencias;
- reputación;
- CTA para técnicos;
- FAQ.

No copiar marcas externas.

---

# 36. Buscador / Marketplace

Filtros:

- texto;
- rubro;
- especialidad;
- ubicación;
- disponibilidad;
- urgencias;
- rating;
- verificados;
- rango de precio futuro.

Orden:

- recomendado;
- mejor valorados;
- más cercanos;
- mayor experiencia;
- respuesta rápida.

El ranking no debe permitir pagar para aparentar mejor reputación.

---

# 37. UX de urgencia

La acción debe ser evidente.

Mobile-first.

```text
¿Qué está pasando?
↓
categoría o IA
↓
ubicación
↓
riesgos
↓
buscar técnicos disponibles
↓
matching
↓
técnico acepta
↓
seguimiento
```

Mostrar claramente que disponibilidad no equivale a garantía hasta existir aceptación.

---

# 38. Estados y máquinas de estado

Centralizar estados.

Crear helpers:

```ts
canTransitionJob(current, next)
```

No permitir transiciones incoherentes como:

```text
completed → in_progress
cancelled → completed
```

sin proceso administrativo explícito.

Guardar historial.

---

# 39. Seguridad

Requisitos mínimos:

- Supabase RLS;
- authorization server-side;
- inputs con Zod;
- nunca exponer service role;
- sanitizar uploads;
- validar tipos/tamaños;
- rate limiting donde corresponda;
- evitar IDOR;
- validar ownership;
- logs sin secretos;
- separar roles;
- auditar acciones administrativas;
- variables de entorno correctas.

---

# 40. Privacidad

No mostrar públicamente:

- documentos personales;
- direcciones privadas exactas;
- emails internos;
- teléfonos si la comunicación ocurre dentro de plataforma.

Documentos de verificación deben ser privados.

---

# 41. Estructura de código sugerida

```text
src/
  app/
    (public)/
    (auth)/
    (customer)/
    (technician)/
    admin/
    api/

  components/
    ui/
    shared/

  features/
    auth/
    technicians/
    categories/
    search/
    service-requests/
    emergencies/
    matching/
    quotes/
    jobs/
    chat/
    payments/
    reviews/
    reports/
    ai-assistant/
    notifications/
    admin/

  domain/
    entities/
    enums/
    policies/
    value-objects/

  services/

  repositories/
    contracts/
    mock/
    supabase/

  integrations/
    supabase/
    ai/
    payments/
    location/
    notifications/

  lib/
  hooks/
  config/
  types/
```

Adaptar si existe una mejor estructura, manteniendo separación.

---

# 42. P0 — Primera versión obligatoria

## Base

- proyecto Next.js funcionando;
- TypeScript estricto;
- Tailwind;
- shadcn;
- layout;
- navegación;
- design tokens;
- responsive;
- Demo Mode.

## Público

- landing;
- categorías;
- marketplace;
- filtros;
- perfil público.

## Cliente

- dashboard;
- creación de solicitud;
- orientación IA mock;
- solicitud normal;
- solicitud urgente;
- cotizaciones;
- trabajo activo;
- chat demo;
- historial;
- evaluación.

## Técnico

- dashboard;
- oportunidades;
- urgencias;
- enviar cotización;
- trabajo activo;
- perfil;
- disponibilidad;
- cobertura;
- reputación.

## Superadmin

- dashboard;
- técnicos;
- verificaciones;
- categorías;
- solicitudes;
- reportes;
- suspender/reactivar técnico;
- audit log demo.

## Datos

- repositorios mock;
- fixtures;
- modelos;
- contratos.

## Supabase

- esquema inicial;
- migrations;
- RLS base;
- integración desacoplada.

---

# 43. P1

- pagos reales;
- realtime chat;
- geolocalización real;
- tracking;
- push notifications;
- verificación documental;
- red social ampliada;
- matching mejorado;
- comisiones;
- reembolsos;
- disputas completas;
- agenda;
- promociones.

---

# 44. P2

- PWA avanzada / app móvil;
- membresías;
- planes premium;
- equipos/empresas;
- técnicos con empleados;
- suscripciones de mantención;
- marketplace B2B;
- garantías;
- seguros asociados;
- pricing inteligente;
- automatizaciones;
- IA para técnicos;
- predicción de demanda;
- antifraude avanzado.

---

# 45. Monetización

Preparar arquitectura para:

- comisión por trabajo;
- tarifa de servicio;
- planes premium;
- mayor visibilidad claramente etiquetada;
- suscripciones;
- servicios empresariales;
- comisión de urgencia;
- garantías opcionales.

No mezclar monetización con reputación orgánica.

---

# 46. Métricas

Preparar eventos para:

- búsqueda;
- perfil visto;
- solicitud iniciada;
- solicitud completada;
- urgencia iniciada;
- matching;
- cotización recibida;
- cotización aceptada;
- trabajo iniciado;
- trabajo completado;
- pago;
- evaluación;
- reporte.

KPIs futuros:

- tiempo hasta primer match;
- tiempo hasta primera cotización;
- conversión solicitud → trabajo;
- finalización;
- repetición;
- GMV;
- take rate;
- rating;
- disputas;
- cancelaciones.

---

# 47. Testing

Agregar:

- unit tests de lógica crítica;
- tests de transición de estados;
- tests de ranking/matching;
- tests de comisiones;
- tests de permisos;
- tests del parsing IA.

Antes de cerrar cada milestone:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Si falta un script, créalo cuando corresponda.

`npm run build` debe finalizar correctamente.

---

# 48. Definition of Done

Una funcionalidad está completa cuando:

- UI funciona;
- mobile funciona;
- loading/empty/error existen;
- tipos correctos;
- validaciones;
- permisos;
- dominio separado;
- no rompe build;
- no introduce duplicación;
- demo coherente;
- integración preparada;
- accesibilidad razonable.

---

# 49. Reglas para Codex

1. Lee este archivo completo antes de escribir código.
2. Inspecciona el repositorio antes de modificarlo.
3. No reemplaces código funcional sin razón concreta.
4. Trabaja milestone por milestone.
5. Prioriza P0.
6. No preguntes por cada decisión pequeña.
7. Si falta una credencial externa, crea adapter/mock y continúa.
8. Mantén Demo Mode operativo.
9. No hardcodees reglas de negocio en componentes.
10. Centraliza tipos, estados y reglas.
11. Mantén el design system consistente.
12. No uses `any`.
13. Mantén Supabase detrás de repositorios/servicios.
14. Toda tabla sensible debe considerar RLS.
15. Toda operación crítica debe considerar auditoría.
16. Mantén la aplicación desplegable en Vercel.
17. Ejecuta lint, typecheck, tests y build.
18. Corrige errores antes de finalizar.
19. Documenta decisiones importantes.
20. No declares una tarea terminada si el flujo principal está roto.

---

# 50. Milestones iniciales

## Milestone 0 — Foundation

- analizar repositorio;
- setup;
- arquitectura;
- design system;
- layouts;
- navegación;
- Demo Mode;
- mocks;
- configuración.

## Milestone 1 — Marketplace

- home;
- categorías;
- búsqueda;
- filtros;
- cards;
- perfil técnico.

## Milestone 2 — Cliente

- dashboard;
- solicitud;
- IA mock;
- cotizaciones;
- urgencia.

## Milestone 3 — Técnico

- dashboard;
- oportunidades;
- cotizaciones;
- urgencias;
- trabajo activo.

## Milestone 4 — Ciclo del trabajo

- aceptación;
- chat;
- timeline;
- estados;
- finalización;
- review.

## Milestone 5 — Administración

- técnicos;
- verificaciones;
- reportes;
- sanciones;
- categorías;
- auditoría.

## Milestone 6 — Supabase

- migrations;
- RLS;
- repositories;
- seed;
- integración.

## Milestone 7 — Quality Gate

- accesibilidad;
- responsive;
- tests;
- lint;
- typecheck;
- build;
- README;
- Vercel ready.

---

# 51. Objetivo de la demo

## Como cliente

1. entrar a la landing;
2. buscar técnico;
3. abrir un perfil;
4. generar solicitud;
5. usar orientación IA simulada;
6. recibir propuestas;
7. escoger técnico;
8. recorrer servicio activo;
9. finalizar;
10. evaluar.

## Como cliente con urgencia

1. tocar "Necesito ayuda urgente";
2. explicar el problema;
3. obtener clasificación;
4. simular matching;
5. encontrar técnico;
6. simular aceptación;
7. visualizar estado.

## Como técnico

1. abrir dashboard;
2. revisar oportunidades;
3. responder solicitud;
4. cotizar;
5. aceptar urgencia;
6. gestionar trabajo;
7. completar.

## Como superadmin

1. revisar técnicos;
2. aprobar uno;
3. abrir reporte;
4. suspender técnico;
5. revisar audit log.

---

# 52. Criterio de calidad

El producto debe sentirse como una aplicación real, no como pantallas aisladas.

Prioridades:

1. confianza;
2. seguridad;
3. claridad;
4. velocidad;
5. mobile-first;
6. mantenibilidad;
7. escalabilidad;
8. calidad del dato.

La plataforma debe poder crecer sin rehacer completamente la arquitectura.
