# Fixo — Sprint 00.5: estabilización técnica

Fecha: **8 de noviembre de 2026**, zona `America/Santiago`. Base de trabajo: `58ba08a`, continuación del Sprint 00, sin repetir la auditoría completa.

**Estado: cambios locales implementados y verificados; cierre de DB BLOCKED.** No declarar el sprint totalmente cerrado hasta ejecutar las pruebas de la migración en Supabase aislado. No se publicó código ni se modificaron servicios externos.

## Resumen ejecutivo

Se mantuvieron Next.js 15, React 19, TypeScript estricto, Supabase y la arquitectura existente. Las auditorías npm completa y productiva pasaron de 20/5 paquetes afectados a **0/0**. El modo demo dejó de ser un fallback y no puede autorizar ni abrir infraestructura real en producción. Se retiraron reseñas, personas, movimientos, indicadores y comisiones ficticias de las rutas servidas; las funciones comerciales no disponibles se muestran de forma explícita.

Se corrigió además una condición de estabilidad concreta: las solicitudes reales ya no ejecutan dos UPDATE comerciales prohibidos después de insertarse; permanecen submitted y son visibles en el panel. Esto no implementa todavía matching, cotizaciones ni idempotencia comercial completa.

El middleware se trasladó a **`src/middleware.ts`**, junto a `src/app`: su ubicación anterior en la raíz no estaba incorporándose al build. La prueba HTTP detectó este problema, que no evidenciaban los tests de funciones. El build actual incluye Middleware y las peticiones con una cookie demo falsificada a /admin, /cliente y /tecnico redirigen antes de renderizar.

Se contrastaron la [convención oficial de middleware Next.js 15](https://nextjs.org/docs/15/app/api-reference/file-conventions/middleware) y la [guía de migración Zod 4](https://zod.dev/v4/changelog). El último build se ejecutó fuera del sandbox de filesystem después de un EPERM al crear una carpeta generada en .next; no fue necesario alterar permisos globales ni cambiar lógica para resolverlo.

Se prepararon CI sin despliegues, runtime Node 24, rama local de estabilización, hardening SQL transaccional, pruebas pgTAP, servicio de URLs de documentos y planes de baseline/Auth. La base productiva sigue sin historial reparado ni hardening aplicado: **las correcciones remotas no se infieren de su preparación local**.

## Implementado

### Dependencias

| Paquete | Antes | Después | Motivo |
| --- | --- | --- | --- |
| next / eslint-config-next | 15.5.23 | 15.5.29 | Correcciones dentro de la línea 15 y alineación de tooling. |
| zod | 3.25.76 | 4.6.7 | Salir del rango vulnerable sin parche compatible en la rama instalada. |
| @hookform/resolvers | 3.10.0 | 5.9.2 | Integración de Zod 4; separar tipos input/output y validar borradores antes de enviar. |
| vitest | 2.1.9 | 5.1.0 | Retirar avisos críticos de Vitest/tinypool y dependencias antiguas de Vite. |
| vite | 5.4.21 | 8.3.6 | Peer explícito compatible con Vitest 5 y fuera de rangos afectados. |
| postcss | 8.5.26 (raíz), 8.4.31 (Next) | 8.5.32 | Override dirigido, porque Next mantiene una dependencia interna antigua. |
| sharp | 0.34.5 | 0.35.5 | Correcciones de librerías de imágenes; override dirigido al árbol Next. |
| source-map-js | 1.2.1 | 1.2.2 | Corrección de agotamiento del event loop. |
| brace-expansion | 1.1.18 afectado | 1.1.21 para rama 1 | Override acotado; otras ramas se conservan según sus rangos. |
| minimatch de typescript-estree | 10.2.6 afectado | 11.0.1 | Override solo en tooling; Node 24 y checks de compatibilidad. |

También se actualizaron las transitivas afectadas dentro de sus rangos: js-yaml, postcss-selector-parser y dependencias de @typescript-eslint. Los cambios completos por path están en `sprint-00-5-evidence/dependency-changes.json`; el cambio mayor de herramientas reemplaza parte del árbol, no son 112 nuevas dependencias directas. React/React DOM se conservaron en **19.2.8**, react-hook-form en **7.85.0**. No se ejecutó audit fix --force ni se aceptaron peers incompatibles por legacy-peer-deps.

Cada advisory inicial y su cadena quedan enumerados en [DEPENDENCY_ADVISORIES.md](sprint-00-5-evidence/DEPENDENCY_ADVISORIES.md), con URLs oficiales de avisos y evidencia npm inicial del Sprint 00. Ambos JSON posteriores muestran cero paquetes afectados a esta fecha; no es una garantía universal de seguridad ni modifica el despliegue antiguo de Vercel.

### Entorno, demo y autorización

- Configuración pública validada: URL válida HTTPS o loopback local, key pública o JWT anon; se rechazan claves secret/service-role y placeholders. Los errores no muestran valores.
- Configuración requerida comprobada en build, middleware y autenticación de servidor; respuestas controladas 503/no-store ante entorno incompleto. Demo true en producción/preview se rechaza.
- Demo local explícito solo con NODE_ENV development/test y fuera de Vercel; ninguna activación automática por ausencia de Supabase. Plantilla .env.example segura por defecto.
- Cookie demo ignorada para autorización productiva. Los clientes Supabase server/browser y el servicio documental impiden mezclar identidad demo con infraestructura real.
- Guards tempranos por ruta y guards existentes en servidor, rol consultado desde profiles, sin confiar en user_metadata. Se conserva RLS como barrera DB; esto no implementa todavía el estado global suspended/blocked de cuentas.
- Respuestas de registro más neutras y sin propagar mensajes de infraestructura. No se presenta como entrega de correo confirmada. Confirmación/recuperación completas siguen en Sprint 01.

### Contenido y estados vacíos

- Perfiles públicos: sin reseñas/estrellas de clientes inventados ni promesas de antecedentes certificados; experiencia/precios/cobertura etiquetados como declarados. Aprobación derivada del estado, sin publicar perfiles pendientes.
- Agenda, pagos y reclamos: retirados nombres, fechas, montos y casos de ejemplo; se informa que la función aún no está disponible, sin afirmar que una consulta real devuelve cero.
- Dashboard técnico: eliminadas métricas constantes y verificaciones/urgencias asumidas. Se muestra el estado real del perfil; el shell ya no desaparece cuando falta el perfil técnico.
- Configuración administrativa: retirada comisión de 12%, botones sin operación y matching presentado como activo.
- Inicio/cómo funciona/navegación: sin prometer chat, pagos, urgencias o contratación operativa. Directorio vacío orienta a postulación. Rutas antiguas sin backend quedan disponibles como avisos claros; lógica mock y negocio se conservan para desarrollo/pruebas.
- Demo aislado lleva aviso explícito tanto en páginas públicas como en paneles. Nuevo EmptyState y error de aplicación reutilizables; el error no imprime detalles internos.

## Supabase: preparado y sin aplicar

La lectura de preflight sigue mostrando nueve tablas, doce políticas, seis funciones y 48 constraints; no se detectaron cambios de definiciones de funciones/constraints desde Sprint 00. Historial de migraciones aún vacío. El esquema private no existe aún y no hay funciones en conflicto con los helpers propuestos. No se cambiaron roles, datos, buckets, funciones ni políticas remotas.

Migración nueva: **`supabase/migrations/20261108223021_harden_marketplace_access.sql`**, creada por CLI **3.0.0**, en una transacción con timeouts. El baseline inicial se preservó sin cambios.

Prepara helpers privados fuera de Data API; conserva SECURITY DEFINER donde RLS lo requiere; retira EXECUTE excesivo de helpers públicos/triggers y fija search_path; mantiene el RPC administrativo autenticado, su guard, lock y auditoría. Revoca TRUNCATE/REFERENCES/TRIGGER y aplica grants explícitos. Protege INSERT comercial contra status/asignación arbitrarios sin conceder UPDATE genérico. Restringe carga documental por dueño/rol/estado y lectura por dueño técnico o administrador; bucket privado con límite 10 MiB y PDF/JPEG/PNG.

El servicio `technician-document-service.ts` prepara URLs firmadas por 60 segundos con JWT real, ownership/rol, metadatos autorizados y path validado. Sus pruebas son unitarias con dobles de infraestructura, **no** ejecución contra Storage real. No hay UI de carga/revisión implementada aún. Las URLs ya emitidas pueden durar hasta su expiración; una suspensión posterior necesita política explícita del Sprint 01.

El [runbook](SUPABASE_BASELINE_RUNBOOK.md) documenta reparación del historial sin ejecutar de nuevo el SQL inicial, precondiciones, dry-run, verificación y rollback. La reparación cambia metadata; no es una migración de esquema ni un rollback de SQL. No se ejecutó repair/db push/db reset remoto.

## Pruebas y evidencias

| Verificación | Estado | Resultado / alcance |
| --- | --- | --- |
| Runtime | PASS | Node 24.22.2 portable oficial, SHA256 comprobado; Node global no cambiado. |
| npm ci | PASS | Instalación reproducible desde lockfile, sin force ni legacy-peer-deps. npm 11 no ejecutó el postinstall no aprobado de unrs-resolver; los checks del árbol instalado se verifican después. |
| npm run lint | PASS | Exit 0. |
| npm run typecheck | PASS | Exit 0, strict conservado. |
| npm run test | PASS | **19 archivos, 88 pruebas**; se conservan las 43 anteriores, adaptando la expectativa insegura de fallback demo. |
| npm run build | PASS | Next 15.5.29; incluye Middleware en ubicación correcta. |
| npm run test:smoke | PASS | HTTP local productivo: cookie demo superadmin rechazada con redirects en las tres áreas; urgencia real no disponible. |
| npm audit | PASS | Exit 0, cero vulnerabilidades reportadas. |
| npm audit --omit=dev | PASS | Exit 0, cero vulnerabilidades reportadas. |
| Sharp nativo | PASS local | Carga del binario, PNG, transcodificación WebP y lectura de metadata con Sharp 0.35.5 en Windows/Node 24; sin archivos de usuarios. |
| Escaneo de secretos | PASS acotado | Sin archivos sensibles ni coincidencias con valores locales o patrones de claves en candidatos; no sustituye revisión independiente del historial. |
| actionlint 1.7.12 | PASS | Sintaxis del workflow comprobada; binario oficial con SHA256. |
| Supabase local | BLOCKED | CLI pudo leer config, pero Docker Desktop/daemon no inicia. Evidencia en local-supabase-start.log. |
| pgTAP | NOT TESTED | 27 aserciones preparadas de RLS, roles, estado inicial, documentos y aprobación/auditoría. No se declara PASS por existir el archivo. |
| GitHub Actions / Vercel preview | NOT TESTED | Sin push, conexión Git ni deploy autorizados. Validación local del workflow no equivale a ejecución en GitHub. |
| Auth/Storage/correo reales | NOT TESTED | No se crearon cuentas de producción ni se enviaron correos/archivos. Callback, recuperación, entrega SMTP y expiración real quedan pendientes. |
| QA visual móvil/accesibilidad formal | NOT TESTED | Se reutilizó el design system; no se certifica una auditoría visual de navegador. |

Las pruebas nuevas cubren: modos productivo/preview/incompleto, cookie manipulada, middleware y frontera de rutas, separación demo–SDK, permisos de administradores, documentos propios/ajenos/paths/TTL, coerción y límites de formularios Zod 4, creación de solicitud sin UPDATE posterior y rechazo de actores no customer. Los logs y resultados están en `docs/production/sprint-00-5-evidence/`.

## CI, Git y Vercel

Rama local: **`codex/sprint-00-5-stabilization`**, basada en `58ba08a`; main y todos los commits del Sprint 00 se conservan. Nuevo bundle verificado en `.audit-backups/sprint00-5-20261108/pre-sprint.bundle`, además de los respaldos anteriores. La entrega se guarda en commit local de estabilización y su hash se informa al finalizar; `git log -1` permite identificarlo sin autorreferencia del documento.

`.github/workflows/ci.yml` prepara dos jobs con Node fijado, permisos contents:read y acciones oficiales fijadas por SHA. El job de aplicación valida instalación/calidad/audit/smoke; el de DB usa Supabase local sin tokens ni flags remotos. No contiene un paso de despliegue. La estrategia de ramas, protección y preview separado está en [CI_VERCEL_RELEASE_PLAN.md](CI_VERCEL_RELEASE_PLAN.md).

Vercel sigue en su estado auditado: proyecto sin integración Git, despliegues CLI y ninguna rama productiva acordada. No asumir que el primer push/enlace será seguro. El build de preview debe usar Supabase de staging y no promoverse como artefacto productivo con NEXT_PUBLIC de staging incorporadas.

## Archivos modificados y decisiones

Inventario completo de rutas: [CHANGED_FILES.md](sprint-00-5-evidence/CHANGED_FILES.md). El diff del commit es la referencia definitiva de contenido.

| Grupo | Archivos principales |
| --- | --- |
| Dependencias/runtime | package.json, package-lock.json, .node-version, .nvmrc, vitest.config.mts (renombrado desde .ts), tsconfig.json, eslint.config.mjs. |
| Seguridad de entorno/auth | src/middleware.ts (traslado desde raíz), next.config.ts, src/config/demo-mode.ts, server-environment.ts, integrations/supabase config/browser/server, mock/supabase auth providers, server-authentication-service. |
| Permisos/documentos | src/domain/auth/permissions.ts, protected-routes.ts y technician-document-service.ts. |
| Solicitudes | app/solicitar/actions.ts y customer-dashboard-service.ts; detalle real con aviso de cotizaciones no disponibles. |
| UI | Páginas inicio/cómo funciona/login, perfil público, panel/perfil/agenda/pagos/trabajos/oportunidades técnico, configuración/reportes/verificaciones admin, urgencia, cards y shells/navigation, empty-state y error.tsx. |
| Formularios | auth-provider y quote-input input/output, sign-up-forms y create-quote-form adaptados a Zod 4. |
| Tests | Nuevos archivos de entorno/middleware/SDK/roles/documentos/formularios/solicitudes; test demo existente ajustado; pgTAP 00_access_hardening.test.sql. |
| CI/scripts | .github/workflows/ci.yml, check-secrets.mjs y smoke-production.mjs. |
| Supabase local | config.toml, .gitignore generado por CLI, migración correctiva y tests; ninguna modificación al baseline inicial. |
| Documentación | README, resumen y GAP marcados históricos, supabase/README, este reporte, plan Sprint 01, runbook y plan CI/Vercel; evidencia saneada. |

Variables nuevas de aplicación: **ninguna**. NEXT_PUBLIC_DEMO_MODE cambia de política/default; la plantilla no incluye una service role activa porque no es necesaria para estos adapters. Configuración futura de origen Auth/SMTP se especifica en el plan, sin valores secretos.

## Riesgos, bloqueos y operaciones remotas pendientes

1. **BLOCKED:** ejecutar SQL/pgTAP en Supabase aislado antes de cerrar la validación DB. Resolver Docker local o ejecutar el job DB en un entorno autorizado; no sustituirlo por pruebas en producción.
2. **Pendiente de aprobación posterior:** registrar baseline y aplicar hardening remoto, con backup/restore verificados y dry-run exacto. La base comercial conserva las brechas del Sprint 00 hasta entonces.
3. **Pendiente de aprobación:** push inicial, protección de ramas, integración Git–Vercel y proyecto preview/staging. No se activaron servicios ni se incurrió en recursos remotos nuevos.
4. **NOT TESTED:** configuración Auth URL/allowlist/SMTP completa, recuperación, estados globales y administración de cuentas. No se desarrolló todo Sprint 01 ni se fingió hacerlo; tareas U01–U11 tienen criterios y dependencias en su plan.
5. **Fuera de 00.5:** cotizaciones/jobs reales, matching elegible, idempotencia comercial completa, Flow, chat, IA y DNS. Su indisponibilidad es explícita; no hay cobros reales habilitados.

## Rollback y siguiente acción

Cambios locales reversibles desde el commit base `58ba08a`; conservar la rama de estabilización y usar revert de sus commits revisados si se decide retirar cambios. No reset --hard sobre trabajo nuevo ni borrar respaldos. El baseline SQL se conserva intacto. Reversión remota de historial/ACL/políticas se describe por separado en el runbook; no usar repair como rollback de esquema.

**¿Listos para Sprint 01?** Sí para continuar su desarrollo local en una rama aislada con la base de seguridad preparada. **No** para dar por cerrada la integración DB ni operar/publicar usuarios comerciales: primero deben pasar las 27 pruebas pgTAP y revisarse el baseline/hardening. La siguiente acción concreta es habilitar una base aislada funcional, ejecutar el job DB y revisar el diff SQL antes de solicitar autorización de aplicación remota.
