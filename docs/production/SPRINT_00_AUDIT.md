# Fixo — Sprint 00: auditoría hacia producción

Fecha: **8 de noviembre de 2026**, zona de referencia `America/Santiago`.

Estado del sprint: **BLOCKED** por defectos críticos y pruebas comerciales pendientes. **La auditoría remota de catálogo Supabase y configuración Vercel ya fue autorizada y realizada** mediante la conexión Fixo y consultas GET; el rechazo inicial de acceso quedó resuelto. No se inició Sprint 01. Detalle de la ampliación en §14.

## 1. Dictamen ejecutivo

Fixo tiene una arquitectura reutilizable, interfaz responsive, autenticación Supabase implementada, directorio y solicitudes con adapters reales, y reglas de dominio probadas. **No hay un recorrido comercial completo con persistencia real demostrado.** Cotizaciones, trabajos y urgencias tienen adapters Supabase vacíos. Crear una solicitud combina una inserción permitida con actualizaciones que la migración prohíbe. Las oportunidades abiertas tampoco tienen una política RLS que permita verlas a técnicos elegibles.

El código compila y sus 43 pruebas pasan. Eso no acredita el funcionamiento del backend remoto: los tests existentes usan dominio y mocks. La auditoría npm detectó **20 paquetes afectados: 3 críticos, 7 altos y 10 moderados**; al omitir desarrollo quedan **5: 1 crítico y 4 altos**. Son conteos de paquetes de npm, no de incidentes ni de vulnerabilidades explotadas en el despliegue.

GitHub está vacío: la API devuelve cero ramas y HTTP 409 al listar commits. Vercel **no tiene integración Git**; sus dos despliegues son de CLI. El de producción más reciente fue creado el **17 de agosto de 2026 a las 18:44:51 de Chile** y no registra un SHA Git. Solo hay dos variables configuradas, ambas públicas de Supabase y dirigidas a producción; no hay targets preview/development. Los scripts públicos desplegados contienen la misma URL y clave pública configuradas localmente, comprobado sin conservar sus valores. `soyfixo.cl` no está asociado al proyecto y produjo `ENOTFOUND`; Cloudflare no fue auditado directamente.

La base real tiene **2 usuarios y 2 perfiles, ambos superadmin; 8 categorías; 0 técnicos, solicitudes, documentos y eventos de auditoría**. El directorio vacío tiene una causa concreta: no hay oferta técnica registrada. Existen las nueve tablas iniciales con RLS, las seis funciones y cuatro triggers; sus cuerpos de función coinciden con el SQL local. **El historial de migraciones remoto está vacío**: no repetir la migración inicial ni asumir que el historial representa el esquema existente.

Recomendación: resolver los bloqueos de seguridad y trazabilidad; después implementar un único recorrido **registro → técnico aprobado → solicitud → cotización → adjudicación única → trabajo → pago Sandbox**. Retirar contenido ficticio desde el primer paquete. Chat, IA, agenda avanzada, liquidaciones automáticas y expansión de categorías no son requisitos para completar ese recorrido.

## 2. Alcance, método y límites

- Lectura del árbol efectivo, cambios previos, documentación, factories, clientes, servicios, acciones, rutas, validaciones, estados y SQL.
- Contraste con `docs/RESUMEN_DEL_DESARROLLO.md`, `docs/FIXO_P0_GAP_ANALYSIS.md`, `docs/integrations.md`, `supabase/README.md`, `README.md` y `marketplace_tecnicos_master.md`.
- Ejecución actual de lint, typecheck, tests, build y auditorías npm completa y de producción.
- Consultas GET a GitHub mediante el conector y a las páginas públicas sin credenciales.
- Tras confirmación explícita del propietario, uso de la nueva conexión Supabase **Fixo**, cuyo proyecto coincide con la configuración local. Consultas SELECT de catálogos/conteos, migrations, advisors y logs agregados; sin consultar registros personales ni proyectos ajenos.
- GET autorizado de proyecto, despliegues, dominios y nombres/targets de variables Vercel. GET de ajustes públicos Auth y tablas/RPC de lectura anónima. Sin mostrar claves ni valores de variables.
- No se registraron usuarios, enviaron correos, insertaron solicitudes, cambiaron estados ni iniciaron cobros reales para probar funcionalidades.
- No se ejecutaron migraciones, push, deploy, cambios DNS ni escrituras a servicios externos.

Los estados describen una comprobación concreta: `PASS` comprobado; `FAIL` defecto o ausencia demostrada en el código; `BLOCKED` falta una condición necesaria para verificar; `NOT TESTED` no se ejecutó esa comprobación. Una implementación encontrada en disco no implica `PASS` de aceptación remota.

**Antecedente de acceso resuelto:** la revisión automática rechazó inicialmente una consulta por cuentas/destinos no verificados. El propietario confirmó que ambos proyectos pertenecen a Fixo y autorizó su auditoría; además conectó la cuenta Fixo. Las consultas posteriores fueron permitidas. Para Supabase se prefirió el conector; la service role local no fue necesaria. Para Vercel se usó el token local solo contra `api.vercel.com`, mediante GET y sin redirecciones. No se imprimieron valores de credenciales. No hay una solicitud de autorización de lectura pendiente.

## 3. Git, respaldo y cadena de despliegue

| Comprobación | Estado | Evidencia y consecuencia |
| --- | --- | --- |
| Checkout y rama inicial | PASS | `C:\Git\fixo`, rama `main`, HEAD inicial `87605ef1133474a9f7c3f9eb297924beb5d57f93`, un commit local. |
| Cambios anteriores a la auditoría | PASS | 48 rutas versionadas modificadas/eliminadas y numerosos archivos nuevos; no había cambios staged. Se revisaron y preservaron, sin reset ni stash. |
| Propietario Git | PASS con limitación | Git rechazó inicialmente el propietario distinto. Se utilizó `git -c safe.directory=C:/Git/fixo` por comando; no se cambió configuración global. |
| Remote origin | PASS | `https://github.com/sebaguerrerof/fixo.git`. Sin rama upstream ni referencias remotas locales. |
| GitHub accesible | PASS | Repositorio privado, rama por defecto declarada `main`, permisos administrativos de la cuenta conectada. |
| Código publicado en GitHub | FAIL | `GET /repos/sebaguerrerof/fixo/branches` devuelve `[]`; `GET /commits?per_page=3` devuelve 409 `Git Repository is empty.`. El tamaño 0 por sí solo no se usó como prueba suficiente. |
| Respaldo histórico | PASS | Bundle completo anterior a la auditoría, verificado con `git bundle verify`. |
| Respaldo del árbol efectivo | PASS | ZIP de 173 archivos fuente/configuración/documentación, incluidos archivos nuevos y `.env.example`. Excluye `.env.local`, `.vercel`, dependencias, cachés y logs. No es un respaldo de base de datos ni de secretos. |
| Commit de línea base local | PASS | `9af3a648f4de319041609a36917d8db357b9ca79`, `chore: snapshot reviewed pre-production baseline`, 122 rutas en el diff. Es una fotografía con defectos conocidos, no una versión autorizada para producción. |
| Vercel enlazado localmente | PASS local | `.vercel/project.json` identifica `fixo-marketplace`. Esta vinculación local no prueba integración Git ni rama de producción. |
| Sitio público actual | PASS HTTP | `/`, `/tecnicos` y `/login` responden HTTP 200. No demuestra escrituras ni coincide necesariamente con el checkout. |
| GitHub–Vercel, rama y commit desplegado | FAIL trazabilidad; PASS inspección | API Vercel 200: gitLink null; dos despliegues CLI; producción READY del 17/08/2026, sin SHA Git. No hay rama de producción Git configurada que pueda validarse como aprobada. |
| Push, deploy y cambios externos | PASS | No ejecutados. Requieren aprobación explícita. `main` existe localmente, pero no se presume aprobada como rama de producción. |

Respaldos locales, ignorados por Git:

- `.audit-backups/sprint00-20261108/pre-audit.bundle` — SHA256 `197A5C59D5EA40B108D1B0C63C5B35C9A0CFE97FA595942151F9FDD5ED379938`.
- `.audit-backups/sprint00-20261108/working-tree.zip` — SHA256 `F046D4AD721A1371792078E5F6CE16403390E56B2BBAC603F58BA1BA8AB33928`.
- `source-files.txt` y `git-status-before.txt` en la misma carpeta.

El ZIP conserva archivos nuevos y omite los que ya estaban eliminados; el bundle conserva su versión previa. La combinación permite reconstruir el estado inspeccionado. No hay respaldo externo verificado: copiar estos artefactos a almacenamiento del propietario queda pendiente de autorización.

## 4. Arquitectura, versiones y entorno

La cadena existente es App Router/componentes → servicios → contratos → repositorios mock o Supabase. Autenticación y administración también tienen factories separadas. No se justifica una reescritura ni sustituir Next.js/Supabase.

| Elemento | Versión efectiva / estado |
| --- | --- |
| Node / npm / Git de esta sesión | 22.14.0 / 10.9.2 / 2.48.1.windows.1 |
| Next.js | 15.5.23 |
| React / React DOM | 19.2.8 / 19.2.8 |
| TypeScript | 5.9.3; `strict: true`, `noEmit: true` |
| Supabase SSR / JS | 0.12.4 / 2.112.3 |
| Vitest / ESLint | 2.1.9 / 9.39.5 |
| Lockfile y scripts | `package-lock.json`; existen los cuatro scripts solicitados. |
| CI | No hay workflows `.github` en el árbol inspeccionado. |
| Entorno Supabase | Proyecto Fixo conectado y coincidente con configuración local; catálogo remoto y acceso anónimo de lectura verificados. Login/correo y claves privilegiadas locales no se probaron. |
| Runtime Vercel | Proyecto y despliegue productivo usan Node 24.x; el build local fue probado en Node 22.14.0. Alinear y probar runtime antes del siguiente release. |

Variables encontradas, **solo nombres**:

| Archivo | Nombres |
| --- | --- |
| `.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_OIDC_TOKEN` |
| `.env.example` | `NEXT_PUBLIC_DEMO_MODE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Vercel | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; ambas sensitive, target production. No hay variables preview/development. |

No se encontraron referencias de uso de `SUPABASE_SERVICE_ROLE_KEY` en el código de aplicación ni un proveedor Flow implementado. La presencia de una variable privada no significa que exista una integración que la use. No se añadieron variables.

El escaneo de coincidencias exactas con valores locales no encontró esos valores en los candidatos a commit. Un escaneo heurístico posterior de los 173 archivos versionados tampoco encontró claves privadas, tokens GitHub, secretos Supabase ni literales JWT. **No sustituye** un secret scanner dedicado ni prueba ausencia universal de secretos.

## 5. Matriz funcional: implementación, brecha y siguiente acción

Los `FAIL` de esta matriz pueden coexistir con adapters parciales útiles; no significan que deba desecharse todo el módulo.

| Funcionalidad | Estado | Evidencia | Brecha | Criticidad | Dependencias | Acción recomendada |
| --- | --- | --- | --- | --- | --- | --- |
| Inicio, navegación y UI responsive | PASS compilación; NOT TESTED UX | `src/app/page.tsx`, componentes layout, build | Sin QA móvil/accesibilidad; textos prometen chat/seguimiento inexistentes. | P1 | Recorrido MVP | Revisar contenido y UX con datos vacíos reales. |
| Categorías | PASS adapter y datos remotos | `supabase-technician-repository.ts:51`; SQL:23,300; conteo remoto 8, REST 200 | Sin CRUD/activación ni paginación. | P1 | Esquema real | Agregar solo rubros operables. |
| Búsqueda/directorio | PASS adapter; NOT TESTED con oferta real | `supabase-technician-repository.ts:79`; SQL:327; 0 técnicos remotos | No existen técnicos aprobados para probar el recorrido; filtra parcialmente en memoria. | P0 para oferta real | Auth, aprobación, RLS | Incorporar oferta real y probar pending/verified/active/suspended. |
| Perfil público | FAIL contenido | `src/app/tecnicos/[slug]/page.tsx` | Reseñas y estrellas fijas presentadas como clientes verificados. | P0 | Directorio | Eliminar reseñas ficticias; estado vacío hasta tener reseñas persistidas. |
| Registro cliente/técnico | PASS adapter; NOT TESTED integración | `supabase-auth-provider.ts:69`; SQL:156 | Formulario técnico sin teléfono, términos, documentos/fotos ni disponibilidad real. | P0/P1 según requisito | Auth remoto, términos | Completar mínimo operativo y probar el alta/trigger con datos válidos e inválidos. |
| Login/logout y sesión | PASS implementación; NOT TESTED recorrido | `supabase-auth-provider.ts`, `middleware.ts` | Confirmación/callback completo no acreditado; sin pruebas reales de revocación. | P0 de validación | Auth URL/SMTP | Probar correo, callback y renovación; no inferir sesión por UI. |
| Recuperación, perfil y estado de cuenta | FAIL | No hay rutas/acciones de recuperación; `profiles` sin estado de cuenta | Falta recuperación, edición, bloqueo/suspensión global. | P0 para operar cuentas | Matriz RBAC | Implementar con respuestas no enumerables y restricciones DB. |
| Permisos por rol | PASS parcial; NOT TESTED RLS | Layouts admin/cliente/técnico y `requireServerRole`; SQL:365 | Sin RBAC central completo ni distinción granular moderator/superadmin; demo confía cookie editable. | P0 | Auth real, políticas | Cerrar demo en producción y probar cada rol/acción directamente. |
| Postulación y aprobación técnica | PASS esquema; NOT TESTED operación | Trigger y RPC remotos coinciden con SQL:260; 0 postulaciones | No hay carga/inspección/revisión real de documentos ni credenciales como condición DB. | P0 | Storage privado, criterios operativos | Implementar validación mínima antes de publicación. |
| Invitaciones y administración de roles | FAIL | No hay implementación de invitaciones/gestión de usuarios | Sin incorporación segura directa; no hay mecanismo exclusivo de superadmin. | P1; P0 antes de habilitarlo | RBAC, correo | Superadmin invita; técnico completa y se somete a aprobación. |
| Crear solicitud | FAIL extremo a extremo | `src/app/solicitar/actions.ts:18`, `:32`; SQL:371 | INSERT seguido de UPDATE revocado; persistencia parcial y error al usuario. | P0 | RPC/transacción, RLS | Crear estado inicial autorizado de forma atómica e idempotente. |
| Panel de solicitudes cliente | FAIL para nuevas solicitudes | `customer-dashboard-service.ts:9` | Solo muestra estados activos; una solicitud atascada en submitted no aparece aunque exista. | P0 | Arreglar creación | Mostrar submitted y todos los estados relevantes con historial. |
| Oportunidades técnicas | FAIL | `listOpenForCategory`; SQL:349 | RLS solo dueño, técnico asignado activo o admin; no técnico elegible sin asignación. | P0 | Visibilidad y cobertura | Política/consulta segura con categoría, comuna, estado y técnico activo. |
| Adjuntos e historial de solicitud | FAIL | `service_requests` SQL:83 | Sin entidades/buckets de adjuntos ni historial de estados. | P1 adjuntos; P0 trazabilidad crítica | Storage y esquema | Historial transaccional; imágenes opcionales pueden diferirse. |
| Cotizaciones | FAIL real; PASS tests mock | `supabase-quote-repository.ts:4` | Todos los métodos lanzan NOT_IMPLEMENTED; sin tablas/RLS/RPC. | P0 | Solicitudes visibles | Persistir CLP, vigencia y condiciones; validar técnico activo. |
| Adjudicación única y snapshot | FAIL real; PASS parcial mock | `quote-service.ts:78`; mock accept sin await | Sin restricción DB ni transacción aceptación + solicitud + trabajo. | P0 | Quotes/jobs | RPC atómica, unicidad e idempotencia con snapshot protegido. |
| Trabajos y cierre | FAIL real | `supabase-job-repository.ts:5` | Adapter vacío; sin persistencia/historial ni pago confirmado. | P0 | Adjudicación y estados | Completar flujo y separar aceptación, cobro, ejecución y cierre. |
| Urgencias | FAIL real; PASS dominio mock | `supabase-emergency-repository.ts:5`, `ai-provider-factory.ts:6` | No persisten; creación exige IA mock; precio snapshot 0 pendiente de definición. | P0 si se ofrecen | Jobs, matching, precio acordado | Ocultar temporalmente oferta; reutilizar servicio al conectar persistencia. |
| Dashboard técnico | FAIL veracidad | `technician-dashboard-service.ts:12`, `tecnico/perfil/page.tsx` | Métricas constantes 0; perfil dice verificado/urgencias habilitadas sin derivarlo del estado. | P0 contenido / P1 agregados | Datos de trabajos | Estado real o sin datos; nunca sustituir ausencia por métricas inventadas. |
| Agenda e ingresos técnicos | FAIL | `tecnico/agenda/page.tsx`, `tecnico/pagos/page.tsx` | Nombres, horarios, ingresos y movimientos fijos en ambos modos. | P0 | Datos reales o alcance MVP | Retirar demos; diferir agenda avanzada. |
| Administración técnica y auditoría | PASS esquema/adapter; NOT TESTED operación | `supabase-admin-management-store.ts`; cuerpo RPC remoto coincide con SQL:260 | RPC bloquea fila y audita en una transacción; no cubre documentos/roles/pagos ni operación completa. | P0 validación / P1 extensión | Permisos DB | Mantener RPC; probar actor, transición, concurrencia y auditoría persistida. |
| Dashboard admin | PASS parcial adapter | `admin-dashboard-service.ts` | Solo contadores de técnicos; falta usuarios, solicitudes, trabajos y pagos. | P1 | Persistencia comercial | Agregados SQL con datos reales; sin números de relleno. |
| Reclamos/configuración admin | FAIL | `admin/reportes/page.tsx`, `admin/configuracion/page.tsx` | Reclamos ficticios; botones sin operación; comisión 12% referencial y matching mostrado activo. | P0 contenido / P1 producto | Política comercial | Estados vacíos/herramienta mínima operativa; no publicar comisión no aprobada. |
| Flow / pagos / reembolsos | FAIL | Solo `payment-provider.ts` | Sin adapter, órdenes, callbacks, validación, conciliación ni Sandbox. | P0 antes de cobrar | Snapshot, contrato Flow | Sprint 05 Sandbox; modelo de fondos validado antes de cobros reales. |
| Notificaciones y Zoho | FAIL | Solo `notification-service.ts` | Sin proveedor, plantillas, outbox, trazabilidad ni evidencia SMTP. | P0 para correo crítico | Dominio/cuenta real | Primero confirmación/recuperación/postulación; distinguir aceptado de entregado. |
| Ubicación / IA / chat | FAIL real o ausente | Contratos location/AI, proveedor AI mock; sin chat | No necesarios para el primer recorrido normal. | P2 | No bloquear MVP por IA | Comunas explícitas, sin prometer chat; diferir geocoding/IA. |
| SEO, términos, privacidad, soporte, analítica | FAIL o NOT TESTED | Metadata básica en `layout.tsx`; sin sitemap/robots/eventos | Sin documentos legales ni canales operativos acreditados; sin instrumentación. | P0 operativa mínima / P1 mejora | Modelo comercial, dominio | Completar requisitos de lanzamiento; eventos sin PII innecesaria. |

## 6. Bloqueos P0 identificados

| ID | Bloqueo y alcance | Evidencia | Criterio verificable para levantarlo |
| --- | --- | --- | --- |
| P0-01 | Dependencias de producción con alertas críticas/altas. No se afirmó explotación en Vercel. | `evidence/npm-audit-production.json`: Next, PostCSS, sharp, source-map-js, Zod. | Actualización compatible o mitigación justificada por alcance y asesoría vigente; repetir cuatro checks y npm audit. |
| P0-02 | Demo puede activarse automáticamente cuando faltan credenciales, aun en producción; acepta identidad/rol de cookie sin firma. | `demo-mode.ts:9`, `demo-session-cookie.ts:9`, `server-authentication-service.ts:16`. Reproducción local de decoder aceptó superadmin autofijado. | Producción falla cerrada si falta configuración; ninguna cookie demo autoriza operaciones productivas; tests de configuraciones. |
| P0-03 | Solicitud parcialmente persistida y reintentos duplicables. | Action INSERT → UPDATE → UPDATE; SQL revoca UPDATE. Panel excluye submitted. | Un envío crea exactamente una solicitud visible; errores/reintentos no duplican ni ocultan persistencia. |
| P0-04 | No existe acceso a oportunidades para un técnico aún no asignado. | SELECT RLS SQL:349; `TechnicianOpportunitiesService`. | Cliente ve solo sus solicitudes; técnico activo elegible ve oportunidades permitidas; ajenos/suspendidos no. |
| P0-05 | Quotes/jobs sin esquema/adapters; aceptación compuesta sin atomicidad DB. | Stubs y `quote-service.ts:92`. | Dos aceptaciones concurrentes dejan un adjudicatario y un trabajo; snapshot inmutable; rollback/reintento comprobado. |
| P0-06 | Contenido ficticio fuera de demo. | Reseñas públicas, agenda, pagos, reclamos, insignias del perfil, métricas constantes. | Sin reseñas, personas, ingresos ni afirmaciones de certificación inventadas en ninguna ruta liberada. |
| P0-07 | Historial de migraciones vacío con esquema ya existente; seguridad/configuración Auth aún requiere preparación y pruebas. El bloqueo de acceso está resuelto. | Catálogo inspeccionado: 9 tablas, 6 funciones, 4 triggers, 0 migraciones registradas; advisors detallados en §14. | Reconciliar historial sin reejecutar CREATE inicial; cerrar grants/helpers necesarios, configurar/verificar Auth URL/SMTP y ejecutar pruebas de aislamiento. |
| P0-08 | Fuente de código y despliegue sin trazabilidad. | GitHub vacío; Vercel gitLink null; despliegues CLI sin SHA. | Revisión/aprobación de rama; código aprobado respaldado en GitHub; Vercel vinculado al commit correcto; preview verificable. Push/deploy requieren aprobación. |
| P0-09 | Pagos no implementados ni modelo de fondos confirmado. | Solo contrato PaymentProvider; sin endpoints ni tablas. | Escenarios Sandbox correctos, callback consultado y validado, duplicados seguros, conciliación; contrato operativo documentado. |
| P0-10 | Validación técnica y suspensión incompletas. | RPC permite aprobación sin comprobar documentos; quotes no verifica estado activo; cuenta no tiene estado global. | Publicación y acciones sensibles condicionadas a aprobación/credenciales; suspendidos no cotizan/reciben trabajos; motivos auditados. |
| P0-11 | Inserción directa permite estados/asignación comerciales arbitrarios dentro de la solicitud propia. | INSERT RLS SQL:346 solo comprueba customer/rol; columnas status y assigned_technician_id no están restringidas para INSERT. | Probar rechazo de status completed/awaiting_payment o técnico preasignado en alta directa; transición solo por operaciones autorizadas. |
| P0-12 | No hay pruebas reales de aislamiento, concurrencia, recuperación ni pagos; falta preparación operativa mínima. | Suite solo dominio/mocks; recuperación, términos, política de reembolso y canal de soporte no implementados/acreditados. | Gates de pruebas de §10 y responsables/canales/reglas comerciales definidos antes de lanzamiento. |

P0 significa bloquear la liberación del alcance comercial solicitado. Una función opcional puede salir del alcance del MVP y retirarse de UI para dejar de bloquearlo: especialmente urgencias, agenda avanzada y reclamos automáticos. Pagos reales siguen deshabilitados hasta aprobación independiente.

## 7. Seguridad: auth, roles, acciones y API

### Autenticación y permisos

Aspectos favorables: el servidor usa `auth.getUser()` y obtiene el rol desde `profiles`, no desde un rol arbitrario enviado por el navegador. El trigger solo transforma `account_type=technician` en technician; cualquier otro valor produce customer. Los usuarios no pueden escribir `profiles.role` con los grants definidos. No se encontró un endpoint que permita al público crear moderadores o superadmins.

Brechas: `profiles` no tiene estado activo/suspendido/bloqueado de cuenta. El acceso al panel técnico depende del rol, sin considerar suspensión del perfil; `QuoteService.createDraft` comprueba categoría, pero no `canReceiveWork`, cobertura, disponibilidad ni vigencia al aceptar. Los permisos administrativos se agrupan en `is_admin()`; todavía no hay operaciones de rol/invitación exclusivas de superadmin. El registro convierte “already registered” en un mensaje que confirma existencia de cuenta; el comportamiento remoto depende de ajustes Auth. Falta recuperación de contraseña.

| Actor | Lo que implementa el código | Brecha de control |
| --- | --- | --- |
| Anónimo | Páginas públicas, registro, login, formulario de solicitud; action exige sesión. | El alta de solicitud no comprueba rol customer en la action; depende de RLS real. Demo omite esa defensa DB. |
| customer | Layout `/cliente`, solicita con ID de sesión, aceptación y lectura de cotizaciones con ownership. | Alta parcial, historial incompleto y sin transacción real. |
| technician | Layout `/tecnico`, actions de cotización y avance con rol; avance valida técnico asignado. | Suspensión/cobertura/estado no centralizados; oportunidades sin política elegible. |
| moderator | Layout admin y RPC de cambio de estado con auditoría. | No hay matriz de permisos operativos granular ni gestión completa de usuarios. |
| superadmin | Mismo grupo admin actual. | Falta capacidad exclusiva segura para roles privilegiados e invitaciones. |

Los layouts son protección de navegación, no sustituyen autorización por acción y RLS. La cookie demo es solo un mecanismo de demostración; no es una sesión confiable aunque no contenga una clave privada. La reproducción se limitó a ejecutar el decoder localmente: no se creó una sesión ni se atacó el despliegue.

La confirmación solicita redirección a `/login`; no hay una ruta explícita que intercambie el `code` PKCE mediante `exchangeCodeForSession`. El recorrido de confirmación y su configuración URL/SMTP queda **NOT TESTED**; no se declaró roto solo por esa ausencia.

### Server actions y endpoints

Se inspeccionaron actions en solicitar, urgencia, aceptación de cotización, oportunidades, cotizar y trabajos. Varias comprueban rol e identidad del servidor y usan Zod. El ID cliente de una solicitud se obtiene de la sesión. Ninguna ruta `src/app/**/route.ts` está presente: no hay callbacks Flow ni API de pagos.

Las actions suelen devolver `error.message` directamente: pueden revelar detalles internos de infraestructura. No hay rate limiting propio ni protección antispam implementada en el repositorio; no se atribuye esa ausencia a la configuración del proveedor. Los tipos TypeScript no validan entradas en runtime: revisar también IDs/estados y respuestas de operaciones, no solo formularios.

`getAssignedTechnicianAction` carece de check explícito de actor/relación y confía en RLS de `findByUserId`; revisar al activar urgencias. `EmergencyService.cancel` valida dueño para customer, pero no asignación para actor technician; la action actual de cancelación usa customer. Es un defecto latente del servicio, no evidencia de un endpoint técnico explotable hoy.

No se identificaron referencias a claves privadas en bundles mediante nombres `NEXT_PUBLIC_` privados, ni uso de la service role en código cliente. La inspección remota de ajustes y un escaneo independiente siguen pendientes.

## 8. Migraciones, RLS, funciones y Storage

Existe **una migración local**, `supabase/migrations/202608170001_initial_marketplace.sql`. No hay `supabase/config.toml`, seeds separados, tipos DB generados ni un mecanismo local de reset/test documentado y verificado. No se ejecutó ese SQL contra ningún servidor.

Inventario local:

- 4 enums: app_role, technician_status, service_request_status, service_priority.
- 9 tablas: profiles, categories, technician_profiles, technician_categories, technician_specialties, technician_metrics, technician_documents, service_requests, admin_audit_entries.
- 6 funciones: touch_updated_at, is_admin, active_technician_id, handle_new_user, technician_status_transition_allowed, change_technician_status.
- 4 triggers: updated_at en profiles/technician_profiles/service_requests y alta en auth.users.
- 3 índices explícitos además de PK/UNIQUE; RLS activado en las nueve tablas.
- 10 políticas de tablas y 2 de Storage; bucket privado technician-documents.

La RPC de estados administrativos usa `FOR UPDATE`, valida admin y transición, actualiza y registra auditoría en la misma transacción. Es un patrón útil que debe conservarse y probarse.

Hallazgos:

1. **Incompatibilidad escritura/lectura de solicitudes:** UPDATE está revocado; el repositorio lo necesita. SELECT no permite oportunidades sin asignar; INSERT no limita estado inicial/asignación. No solucionar concediendo UPDATE genérico.
2. **Grants remotos confirmados:** anon/authenticated tienen SELECT e INSERT sobre service_requests, sin UPDATE/DELETE. Las restricciones RLS siguen aplicando al INSERT. Persisten permisos amplios de REFERENCES/TRIGGER/TRUNCATE sobre tablas; RLS no protege TRUNCATE, aunque no hay evidencia de una vía PostgREST que exponga esa operación. Revisar privilegios mínimos sin presentar esto como borrado anónimo demostrado. Un HTTP 200 no demuestra aislamiento entre actores.
3. **Sin modelo comercial completo:** faltan quotes, jobs, emergencies, pagos, eventos, reembolsos, historial de solicitudes y adjuntos. No hay unicidad transaccional ni inmutabilidad de snapshot en DB.
4. **Funciones privilegiadas:** is_admin, active_technician_id, handle_new_user y change_technician_status usan SECURITY DEFINER y search_path fijo. La RPC tiene guard de admin, pero no se revoca EXECUTE a PUBLIC/anon de forma explícita. Revisar grants mínimos y esquema privado para helpers; no se encontró una elevación administrativa por el simple hecho de llamar a is_admin.
5. **Entrada del trigger:** cast de boolean/integer y expansión JSON de metadata pueden fallar con tipos o enteros fuera de rango; las validaciones del formulario no protegen el endpoint Auth directo. Probar registro malformado sin elevar roles ni exponer errores internos.
6. **Documentación técnica privada incompleta:** hay SELECT de metadatos, pero no flujo autorizado para insertar/revisar metadatos. Storage INSERT verifica solo carpeta de auth.uid, no rol técnico. El bucket no especifica allowed_mime_types ni file_size_limit; no hay carga/inspección con URLs firmadas y controles de tamaño/tipo en UI/servidor.
7. **Publicación:** verified y active son públicos tanto en SQL como en búsqueda. Debe definirse si verified ya equivale a aprobado para publicación. No hay condición de credenciales obligatorias por rubro antes de publicar.
8. **Sin protección general de cuenta suspendida:** ninguna política consulta un estado de cuenta inexistente; active_technician_id solo protege la lectura de solicitudes ya asignadas.
9. **Migración inicial no repetible sobre esquema ya creado:** CREATE TYPE/TABLE sin guard y triggers/policies nominales; el README propone pegar todo en SQL Editor. No repetirla en un proyecto existente. El backfill asigna customer a perfiles faltantes; revisar usuarios previos antes de cualquier ejecución. El upsert de categorías puede sobrescribir descripciones existentes.

**Lectura remota completada:** nueve tablas con RLS y ninguna vista/materialized view en public; 66 columnas, 48 constraints, 16 índices, cuatro enums, seis funciones, cuatro triggers y doce políticas entre tablas/Storage. Los conjuntos de nombres de tablas y columnas coinciden con el SQL local, sin faltantes ni extras; los seis cuerpos de función coinciden ignorando solo whitespace exterior. Hay cinco extensiones instaladas. Se inspeccionaron grants, bucket y advisors; el historial de migraciones está vacío. Esto no equivale a un diff semántico exhaustivo de todo el DDL ni a pruebas de aislamiento con usuarios cliente/técnico. Detalle y límites en §14.

## 9. Dependencias demo y contraste documental

`repository-factory.ts` selecciona simultáneamente los cinco repositorios. Auth y administración resuelven proveedores por separado, pero con el mismo flag. Si no se especifica el flag y faltan credenciales, el código activa demo sin distinguir producción. NEXT_PUBLIC_DEMO_MODE es configuración pública/build y debe mantenerse coherente entre servidor y navegador.

Los repositorios mock usan arrays de módulo en memoria; no persisten entre reinicios ni entre instancias serverless. El store administrativo demo conserva su propio estado de navegador, separado del repositorio de técnicos del servidor: una suspensión en UI no acredita que otra página use ese estado. El registro técnico mock solo crea cookie de identidad, no una postulación técnica persistida. No habilitar demo como solución al marketplace vacío.

Rendimiento y consistencia pendientes (P1): `TechnicianJobsService.describe` hace una consulta por trabajo; las oportunidades consultan una vez por categoría; búsqueda/featured descargan resultados para filtrar/ordenar/limitar en memoria, sin paginación. El conteo de categorías usa membresías visibles por RLS, por lo que puede variar según el actor. Los joins `!inner` excluyen técnicos sin categorías, incluso en administración; probar ese caso para no esconder postulaciones incompletas. Priorizar consultas agregadas y por lotes al implementar persistencia, sin agregar infraestructura prematuramente.

| Documento / afirmación previa | Contraste actual |
| --- | --- |
| Resumen: Supabase conectado y endpoints profiles/categories 200 | Revalidado con la conexión Fixo y GET anónimos. Conteos reales: 2 perfiles superadmin y 8 categorías; no hay técnicos ni solicitudes. No demuestra un flujo comercial. |
| Resumen: cotizaciones/trabajos/urgencias completos en mock, migraciones faltantes | Confirmado. Los adapters reales son stubs que lanzan errores. |
| Resumen: login, registro y protección de rutas | Confirmados como implementación. Falta validar correo/recuperación, permisos efectivos y suspensión en integración. |
| Resumen: GitHub vacío, despliegue no sincronizado | Vacío confirmado; Vercel carece de integración Git y usa despliegues CLI sin SHA registrado. |
| Resumen: 43 tests verdes y logs previos de build | Reejecutados ahora: 10 archivos/43 tests PASS; lint/typecheck/build PASS. |
| GAP_ANALYSIS: autenticación demo como “cookie no sensible”; activar demo en Vercel como “cero riesgo” | No apto para producción comercial: cookie editable permite afirmar rol, hay fallbacks y datos en memoria. No seguir esa recomendación. |
| GAP_ANALYSIS: RLS implementado “para lo modelado” | RLS existe, pero hay incompatibilidades concretas de creación/visibilidad e INSERT permisivo en estado. No equivale a seguridad verificada. |
| GAP_ANALYSIS: tests de urgencias “end-to-end” | Son tests de servicio con repositorios mock; no son navegador + Supabase + RLS + correo/pagos. |
| README: Supabase fuente de verdad para solicitudes y configuración de producción | Describe intención parcialmente implementada; alta de solicitud falla a mitad y no hay persistencia comercial completa. |
| integrations: la UI no importa SDKs y cookie demo no sensible | BrowserClient y SupabaseAdminManagementStore son módulos cliente de infraestructura, consumidos mediante servicios. La cookie no contiene secretos, pero sí autoridad de acceso demo. |
| Master specification: IA/chat/reputación/operación avanzada | Es una visión, no inventario de funciones terminadas. Priorizar el recorrido normal de MVP y mensajes honestos. |

## 10. Pruebas ejecutadas y plan de aceptación

| Verificación ejecutada | Resultado | Evidencia |
| --- | --- | --- |
| npm run lint | PASS, exit 0 | `evidence/lint.log` |
| npm run typecheck | PASS, exit 0 | `evidence/typecheck.log` |
| npm run test | PASS, exit 0; 10 archivos, 43 pruebas | `evidence/test.log` |
| npm run build | PASS, exit 0; Next 15.5.23, 24 páginas estáticas generadas | `evidence/build.log`; el listado incluye rutas dinámicas renderizadas por petición. |
| npm audit --json | FAIL, exit 1; 20 paquetes afectados | `evidence/npm-audit.json` |
| npm audit --omit=dev --json | FAIL, exit 1; 5 paquetes de producción afectados | `evidence/npm-audit-production.json` |
| git bundle verify / hashes ZIP | PASS | §3 y respaldo local |
| Escaneo de valores exactos locales y patrones de secretos | PASS acotado | `evidence/source-scan.json`; no es certificación de seguridad. |
| Cookie demo autofijada como superadmin | FAIL de confianza demo, reproducido en función local | Decoder aceptó objeto construido sin firma; no se envió cookie a ningún servicio. |
| Smoke HTTP local de layouts sin sesión | BLOCKED | EACCES en sandbox y ETIMEDOUT al reintentar desde otro contexto; `evidence/local-route-smoke.json`. No acredita redirects ni fallos funcionales. Servidor temporal detenido. |
| HTTP público /, /tecnicos, /login | PASS disponibilidad | `evidence/external-readonly.json` |
| Catálogo, RLS/grants configurados, bucket y advisors Supabase | PASS inspección; FAIL brechas | Evidencia `supabase-*.json`; no se crearon actores ni se probaron escrituras. |
| GET anónimos y ajustes Auth públicos | PASS lectura | Profiles/categories/technician_profiles/service_requests 200 con limit 0; quotes/jobs/emergency_requests 404; is_admin false; active_technician_id null. |
| Visibilidad anónima de perfiles existentes | PASS acotado | HEAD con count exact: 0 perfiles visibles frente a 2 en DB; 8 categorías visibles; técnicos/solicitudes/documentos/auditoría devuelven conteo 0. Sin cuerpos de respuesta personales. |
| Proyecto/deploy/env/domains Vercel y backend público | PASS inspección; FAIL trazabilidad | `vercel-readonly.json`, `production-public-config-match.json`; no integración Git ni SHA. |
| RLS entre usuarios, registro/SMTP y callbacks reales | NOT TESTED | Proyecto correcto accesible; no hay actores customer/technician ni entorno de pruebas de escritura preparado. No se crearon datos ni enviaron correos. |

Pruebas necesarias para los próximos sprints, en un entorno de prueba autorizado y separado de datos comerciales:

| # | Camino crítico | Estado actual de aceptación | Diseño de prueba mínima |
| --- | --- | --- | --- |
| 1 | Registro cliente | NOT TESTED | Alta, confirmación y perfil customer; metadata con rol admin nunca eleva permisos. |
| 2 | Postulación técnica | NOT TESTED | Registro crea pending con rubros/cobertura; metadata inválida produce error controlado; no publicación. |
| 3 | Aprobación administrativa | NOT TESTED; dominio PASS | Actor customer rechazado; moderator autorizado según matriz; motivo/auditoría y condición de credenciales. |
| 4 | Rechazo no autorizado | NOT TESTED integración | Acceder a layouts, actions, RPC y REST con cada rol; sin sesión no hay datos privados. |
| 5 | Directorio de aprobados | NOT TESTED real; mock PASS | pending/rejected/suspended ausentes; approved según estado acordado presente; sin reseñas de relleno. |
| 6 | Crear solicitud | FAIL estático | Un envío y dos reintentos con misma clave crean una fila, visible en panel y oportunidad elegible. |
| 7 | Cotizar | FAIL real | Técnico activo compatible cotiza; suspendido/otro rubro/no elegible rechazados; vigencia y CLP válidos. |
| 8 | Aceptación única | FAIL real; parcial mock PASS | Dos transacciones concurrentes contra DB, una ganadora; un job y snapshot; perdedora sin escrituras parciales. |
| 9 | Crear/cerrar trabajo | FAIL real | Identidad de ambas partes, transiciones autorizadas, historial, estado de pago separado y reintentos. |
| 10 | Flow Sandbox | FAIL ausencia | Éxito/fallo/pendiente/cancelación; monto y moneda obtenidos de snapshot validado en servidor. |
| 11 | Callback duplicado | NOT TESTED | Reenviar mismo token/evento concurrentemente; una confirmación y un evento financiero efectivo. |
| 12 | Manipular precio | NOT TESTED | Cliente envía otro monto/orden; servidor ignora/rechaza y consulta snapshot; retorno web no confirma pago. |
| 13 | Suspensión técnica | NOT TESTED real; mock parcial PASS | Suspender, refrescar directorio e intentar cotizar/aceptar con sesión anterior; bloqueo inmediato según política. |
| 14 | Recuperación | FAIL ausencia | Correo existente/inexistente dan respuesta equivalente; token expira, se usa una vez y no admite redirect ajeno. |
| 15 | RLS entre usuarios | NOT TESTED | Dos clientes y dos técnicos consultan REST/Storage con sus JWT; no filtran filas/archivos ajenos. Nunca probar aislamiento con service role. |
| 16 | Reintentos tras error | NOT TESTED DB | Cortar después de inserción/confirmación; reintentar devuelve mismo resultado sin duplicar jobs, pagos ni correos. |

No se agregaron pruebas que repliquen cambios triviales de whitespace. La suite existente no incluye integración Postgres/RLS, navegador E2E, correo ni Flow. Tampoco se verificó rendimiento móvil o accesibilidad con navegador en esta sesión.

## 11. Orden final recomendado de los siguientes sprints

Mantener la numeración del plan, pero adelantar controles esenciales y reducir funciones opcionales:

1. **Cerrar Sprint 00:** el acceso y la lectura remota ya están realizados; reconciliar el historial de migraciones vacío y preparar mitigaciones de advisors; evaluar/actualizar dependencias vulnerables; alinear Node local con Vercel 24.x y establecer preview/CI por commit. Ningún cambio remoto, push o deploy sin aprobación.
2. **Sprint 01 — identidad y permisos:** cerrar demo en producción; RBAC central, registro/confirmación/recuperación, estados de cuenta y protección en DB/actions. Adelantar eliminación de reseñas/datos ficticios desde Sprint 08. Habilitar correo crítico de Sprint 06 cuando sea necesario para probar Auth.
3. **Sprint 02 — oferta real:** postulación mínima, términos/contacto, revisión de credenciales por rubro, archivos privados con límites, aprobación y suspensión con historial. Incorporar pocos técnicos reales revisados; sin inventar oferta.
4. **Sprint 03 — solicitudes reales:** corregir alta atómica/idempotente y panel, política de visibilidad elegible, categorías/comunas, historial. Adjuntos opcionales si retrasan el primer recorrido normal.
5. **Sprint 04 — contratación y ejecución:** quotes/jobs reales, aceptación única en DB, snapshot inmutable, transiciones y cierre. Retirar urgencias del lanzamiento hasta tener persistencia/operación; no crear otro sistema paralelo.
6. **Sprint 05 — cobros:** contrato y modelo de recepción de fondos, Flow Sandbox, idempotencia, eventos, devolución/conciliación. Sin liquidaciones automáticas a técnicos no validadas.
7. **Sprint 06 — infraestructura comercial:** completar soyfixo.cl/www, valores exactos de Vercel/Zoho, callbacks, SMTP y notificaciones críticas trazables. Preparación puede avanzar antes; activación externa requiere aprobación.
8. **Sprint 07 — administración mínima operativa:** consolidar usuarios/técnicos, solicitudes/cotizaciones/trabajos, pagos/conciliación y auditoría. Las herramientas mínimas de aprobación se desarrollan ya en Sprint 02; dashboards adicionales no deben retrasar el flujo principal.
9. **Sprint 08 — gate de lanzamiento:** pruebas reales de §10, retiro de todo contenido ficticio, términos/privacidad/reembolsos, soporte, observabilidad/respaldos, SEO/accesibilidad y analítica mínima. Aprobación explícita de release y cobros reales.

No ampliar MVP con chat, IA, geocoding, agenda avanzada, payouts o dashboard de todas las métricas antes de cerrar identidad, oferta real y contratación. Un piloto de captación sin cobros podría evaluarse por separado, sin anunciar funcionalidades ausentes; no equivale a completar el marketplace comercial del plan.

## 12. Siguiente conjunto concreto de tareas

| Orden | Tarea acotada | Resultado de aceptación |
| --- | --- | --- |
| 1 | Reconciliar esquema e historial de migraciones y definir configuración de release | Lectura de cuentas ya completada; preparar baseline/adiciones sin repetir el CREATE inicial, revisar grants/advisors y proponer rama/CI/runtime/env preview. Auth URL/SMTP y respaldo/restore pendientes de verificar. |
| 2 | Remediar dependencias de producción y definir upgrades de herramientas | Lockfile revisado, advisories evaluados, checks verdes; no ejecutar npm audit fix --force de forma indiscriminada. |
| 3 | Aplicar cierre de demo y retirar contenido ficticio | Configuración incompleta en producción no activa mocks; no se aceptan sesiones demo; UI vacía honesta en perfiles/pagos/agenda/reportes. |
| 4 | Completar matriz RBAC y flujo Auth mínimo | Recuperación/confirmación probadas, usuarios bloqueados sin acceso, cambios privilegiados solo superadmin y auditados. |
| 5 | Diseñar migración aditiva de solicitudes y visibilidad | Revisión local de RPC atómica e idempotencia, estado inicial protegido, RLS customer/técnico elegible, historial. Probar local/staging antes de pedir aprobación remota. |
| 6 | Preparar CI y preview revisable | Cuatro verificaciones por commit y tests reales por etapas; propuesta de rama y release identificables. Solicitar aprobación con diff concreto antes de publicar. |

Estas tareas son una recomendación de continuación, no cambios ejecutados durante esta auditoría. El detalle de entrega, archivos, rollback y Git está en [SPRINT_00_REPORT.md](SPRINT_00_REPORT.md).

## 13. Referencias de seguridad consultadas

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): grants y políticas son controles complementarios; no asumir aislamiento a partir de HTTP 200.
- [Supabase changelog](https://supabase.com/changelog.md), consultado por GET público. [Cambio de CLI v3](https://supabase.com/changelog/supabase-cli-v3): no se instaló ni usó CLI; en la siguiente fase comprobar versión/help antes de comandos DB.
- [Aviso Next.js Windows](https://github.com/advisories/GHSA-p293-qw3h-jr36) y [aviso optimización AVIF](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4), además de URLs y rangos conservados en los JSON npm. La versión bloqueada 15.5.23 aparece en rangos afectados; el aviso de Windows no prueba que Vercel use Windows. Revisar condiciones de cada aviso al remediar.

La API Flow se investigará con su [documentación oficial](https://developers.flow.cl/api) en Sprint 05; no se implementaron contratos ni se presumieron capacidades de split o transferencias en Sprint 00.

## 14. Ampliación remota después de autorización del propietario

La conexión del complemento denominada **Fixo** corresponde al proyecto configurado localmente. El proyecto está ACTIVE_HEALTHY, PostgreSQL 17.11.0.003. Se usó exclusivamente esa conexión para catálogos, conteos y advisors. No se leyó contenido de documentos ni perfiles personales; los usuarios solo se contaron/agruparon por rol.

| Dato real | Resultado | Interpretación |
| --- | --- | --- |
| Auth users / profiles | 2 / 2; ambos perfiles superadmin | No hay customer/technician con los que validar recorridos. No se investigaron nombres ni correos. |
| Categorías / técnicos / solicitudes | 8 / 0 / 0 | El directorio vacío no requiere datos demo: falta incorporar técnicos reales aprobados. |
| Documentos / auditoría / Storage objects | 0 / 0 / 0 | No hay evidencia histórica de validaciones ni operaciones comerciales en estos datos. |
| Public tables / RLS | 9 / 9 habilitadas | RLS está configurado, pero persisten los defectos de visibilidad e INSERT señalados. |
| Funciones / triggers | 6 / 4 | Cuerpos de las seis funciones iguales al archivo local; no constituye prueba de ejecución de cada flujo. |
| Migration history | 0 registros | El esquema existe sin historia registrada; el mecanismo de aplicación previo no está acreditado. |
| Storage technician-documents | Privado; tamaño y MIME sin límites configurados | Requiere reglas de archivos y flujo de revisión antes de recibir documentación. |
| Auth público | Email habilitado; signup abierto; autoconfirm desactivado | Confirmación de correo requerida por configuración. No se probó envío/entrega, callback ni recuperación. |
| Lectura anónima de perfiles/categorías | 0 perfiles visibles / 8 categorías visibles | HEAD con count exact acredita que los dos perfiles administrativos actuales no son públicos; no sustituye aislamiento entre clientes/técnicos. |
| Vercel Git / despliegues | Sin link Git; 2 despliegues CLI READY | Último productivo 17/08/2026 18:44:51 Chile; sin SHA Git en metadata. No acreditar que contiene los cambios locales de noviembre. |
| Vercel runtime / entorno | Node 24.x; solo 2 variables Supabase en production | Alinear build local 22.x; preparar variables de preview/development antes de probar un release. La service role no es necesaria para los adapters actuales y no se recomienda agregarla por defecto. |
| Vercel dominios | Solo fixo-marketplace.vercel.app, verificado | soyfixo.cl y www no están asociados al proyecto. No se hizo cambio DNS. |
| Backend usado por login desplegado | Coincidencia de URL y clave pública con configuración local | Comprobación booleana en 13 scripts públicos, todos 200; no se conservaron valores. No verifica el resto del código desplegado. |

Los conteos son SELECT count(*) exactos de la auditoría. El campo rows del inventario de tablas devolvía estimaciones 0 aun para categorías/profiles; no se usó como conteo definitivo.

**Advisors de seguridad: cuatro grupos, diez observaciones** (las cuatro funciones aparecen por cada rol, no ocho funciones diferentes):

- Una función `technician_status_transition_allowed` con [search_path mutable](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- Cuatro SECURITY DEFINER ejecutables por [anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) y por [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable): active_technician_id, change_technician_status, handle_new_user e is_admin. La RPC administrativa conserva su guard; no se la llamó ni se demostró elevación de privilegios. Los dos helpers de lectura respondieron false/null sin sesión. Revisar exposición/grants, mantener controles y no convertir funciones a invoker sin analizar dependencias de RLS.
- [Protección contra contraseñas filtradas desactivada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); evaluar su habilitación y compatibilidad de cuenta antes de configurarla.

**Advisors de rendimiento:** seis FK sin índice de cobertura, ocho políticas que reevalúan auth por fila y tres índices sin uso registrado. No eliminar esos índices por una estadística vacía en una aplicación sin tráfico comercial. Health no devolvió observaciones. Los logs de las últimas 24 horas se consultaron solo agregados por source/severity: cuatro WARNING de Auth y un WARN de Realtime; no se inspeccionaron mensajes personales ni se atribuyó una causa sin evidencia.

**Límites aún abiertos:** Auth Site URL, allowlist de redirects, proveedor SMTP, backups/PITR y restauración no quedan acreditados por los endpoints/conector utilizados. Los ajustes públicos Auth son parciales. Falta un entorno autorizado con actores customer/technician para pruebas de aislamiento y escrituras; no se crearon cuentas de prueba dentro de una auditoría de lectura. El bloqueo de acceso ya no es un pendiente: lo pendiente es preparar y verificar la operación segura.

Evidencia reproducible: `supabase-catalog.json`, `supabase-columns.json`, `supabase-constraints-indexes.json`, `supabase-source-comparison.json`, `supabase-migrations.json`, `supabase-security.json`, `supabase-performance.json`, `supabase-health.json`, `supabase-log-counts.json`, `supabase-anonymous-readonly.json`, `vercel-readonly.json` y `production-public-config-match.json`, dentro de `evidence/`.
