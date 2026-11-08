# Fixo — Resumen del desarrollo actual

> Corte histórico anterior a estabilización. Para el estado vigente consultar [Sprint 00.5](production/SPRINT_00_5_REPORT.md); las descripciones de fallback demo y publicación de este documento ya no son instrucciones operativas válidas.

**Corte de verificación:** 8 de noviembre de 2026

**Alcance:** estado presente en el repositorio local y comprobaciones de solo lectura realizadas sobre los servicios conectados.

## Producto y arquitectura

Fixo es un marketplace de técnicos para solicitar, cotizar y gestionar servicios domiciliarios. La aplicación está construida con:

- Next.js 15 (App Router), React 19 y TypeScript.
- Tailwind CSS, componentes UI propios, Lucide Icons y diseño responsive/mobile-first.
- React Hook Form y Zod para formularios y validaciones.
- Capa de dominio, servicios, contratos de repositorio e implementaciones de infraestructura separadas.
- Vitest para pruebas de dominio, servicios y repositorios.

La estructura permite resolver repositorios para Supabase o para el modo demo mediante una única factory. El modo demo se activa con `NEXT_PUBLIC_DEMO_MODE=true`; si Supabase no está configurado también funciona como respaldo. Con las credenciales de Supabase presentes, la aplicación usa el camino real salvo que se active explícitamente el modo demo.

## Funcionalidades desarrolladas

### Área pública

- Página de inicio, explicación del servicio y navegación responsive.
- Directorio de técnicos con búsqueda, filtros y ordenamientos.
- Perfil público de cada técnico.
- Formulario para crear solicitudes de servicio.
- Flujo de urgencias con wizard, estados, matching de técnicos y aceptación.

### Cuentas y roles

- Inicio y cierre de sesión con Supabase Auth.
- Registro de clientes.
- Registro de técnicos con información de cobertura, especialidades, experiencia, atención de urgencias y precio inicial.
- Middleware de renovación de sesión y protección de rutas en servidor.
- Roles modelados: `customer`, `technician`, `moderator` y `superadmin`.
- Paneles protegidos para cliente, técnico y administración.

### Clientes, técnicos y administración

- Panel de cliente con sus solicitudes y detalle para revisar cotizaciones.
- Panel técnico con perfil, oportunidades, creación de cotizaciones y trabajos.
- Panel administrativo con directorio de técnicos, verificaciones, cambios de estado e historial de auditoría.
- Máquina de estados para técnicos, solicitudes, cotizaciones, trabajos y urgencias.

### Cotizaciones, trabajos y urgencias

- Modelo de cotización con precio, materiales, visita de diagnóstico, condiciones, vencimiento y aceptación.
- Flujo de aceptación de cotización que rechaza las alternativas hermanas en el repositorio mock.
- Modelo y flujo de trabajos asociado a cotizaciones o urgencias.
- Flujo completo de urgencia en modo demo, incluyendo matching y adjudicación.

> Las interfaces y la lógica de cotizaciones, trabajos y urgencias existen. Su persistencia completa en Supabase aún no está cubierta por migraciones equivalentes, por lo que esos flujos se recorren íntegramente mediante los repositorios mock cuando el modo demo está activo.

## Supabase: conectado y verificado

La aplicación está conectada a Supabase mediante `@supabase/ssr` y `@supabase/supabase-js`.

- El entorno local tiene configuradas las variables públicas de URL y publishable key, además de una service role key mantenida fuera del código cliente.
- Se verificó en lectura que los endpoints REST de `profiles` y `categories` responden con HTTP `200`.
- Existen clientes Supabase para navegador y servidor, junto con middleware de sesión.
- La migración inicial está en [202608170001_initial_marketplace.sql](../supabase/migrations/202608170001_initial_marketplace.sql).

La migración modela y protege con RLS:

- Perfiles, categorías y perfiles técnicos.
- Categorías, especialidades, métricas y documentos de técnicos.
- Solicitudes de servicio y auditoría administrativa.
- Trigger de alta de usuario que crea el perfil y, si corresponde, la postulación técnica en estado pendiente de verificación.
- Función para que administración cambie el estado de un técnico y deje trazabilidad en auditoría.
- Bucket privado `technician-documents` y sus políticas de acceso.

## Despliegue en Vercel

- Proyecto Vercel enlazado localmente: `fixo-marketplace`.
- URL pública disponible: [https://fixo-marketplace.vercel.app](https://fixo-marketplace.vercel.app).
- La URL de producción fue comprobada y responde HTTP `200`.

El sitio desplegado existe y está disponible. Sin embargo, no hay evidencia de sincronización automática desde GitHub: la coincidencia entre el despliegue actual y todos los cambios locales pendientes debe validarse antes de considerar una versión como publicada.

## Git y GitHub

- Repositorio local Git en la rama `main`.
- Remote configurado: [sebaguerrerof/fixo](https://github.com/sebaguerrerof/fixo).
- El repositorio GitHub existe, es privado y la cuenta tiene permisos de administración.
- El remoto está vacío actualmente; la API reporta tamaño `0`.
- El último commit local es `87605ef` (`feat: base inicial de Fixo`, 13 de agosto de 2026).
- El árbol de trabajo local contiene cambios modificados, eliminados y nuevos que todavía no están comprometidos ni publicados en GitHub.

Por lo tanto, GitHub está enlazado, pero **no es todavía la fuente publicada del código actual**.

## Calidad verificada

La suite actual se ejecutó el 8 de noviembre de 2026:

- `npm run test`: **10 archivos y 43 pruebas aprobadas**.

Además, los registros locales de ejecución disponibles muestran éxito previo para `npm run lint`, `npm run typecheck` y `npm run build`.

## Documentación incluida

- [Configuración de Supabase](../supabase/README.md).
- [Puntos de integración](integrations.md).
- [Análisis de brechas P0](FIXO_P0_GAP_ANALYSIS.md), con el detalle técnico de lo implementado en modo demo y de las persistencias reales que faltan ampliar.
