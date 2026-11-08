# Fixo — Reporte de entrega Sprint 00

Fecha: **8 de noviembre de 2026**, referencia `America/Santiago`.

**Estado: BLOCKED** por defectos críticos y pruebas comerciales pendientes. La lectura remota de Supabase y Vercel ya está autorizada y completada; no persiste el bloqueo inicial de acceso. Auth URL/SMTP, respaldo/restore y pruebas de flujos reales siguen sin acreditarse. No se declara el sprint ni la preparación productiva finalizados.

## Objetivo y alcance

Inspeccionar el repositorio existente y contrastar la documentación, separar persistencia real de demo, identificar P0, ejecutar verificaciones y dejar un respaldo/commit local. Solo Sprint 00. No se implementaron los sprints siguientes ni se modificaron servicios externos.

Informe principal: [SPRINT_00_AUDIT.md](SPRINT_00_AUDIT.md), con matriz funcional, seguridad/SQL, evidencia, plan de pruebas y orden de sprints.

## Estado inicial

- Checkout `C:\Git\fixo`, rama `main`, HEAD `87605ef1133474a9f7c3f9eb297924beb5d57f93`.
- Código previo parcialmente implementado, 48 rutas versionadas modificadas/eliminadas y numerosos archivos nuevos, sin staging.
- Git rechazaba propietario diferente; resuelto para cada comando con safe.directory local al proceso.
- GitHub privado accesible pero vacío, confirmado por cero ramas y HTTP 409 al listar commits.
- Enlace local Vercel existente; sitio público HTTP 200, sin correspondencia de commit/configuración acreditada.

## Cambios efectuados en esta auditoría

1. Respaldo local de historial Git y snapshot de 173 archivos fuente del árbol previo, excluyendo secretos y artefactos generados; bundle verificado y hashes registrados en el informe.
2. `.gitignore`: conservar `.env.example` como plantilla, ignorar `.audit-backups/` y logs históricos `.execution-*.log`. Se conservaron las exclusiones previas de entorno local y Vercel.
3. Normalización exclusiva de whitespace para que `git diff --cached --check` pase: documento de resumen y cuatro archivos fuente. No se alteró lógica de aplicación.
4. Commit local de línea base **`9af3a648f4de319041609a36917d8db357b9ca79`**, 122 rutas; incorpora el trabajo previo revisado. No atribuir ese desarrollo previo a esta auditoría.
5. Auditoría, reporte y evidencia saneada de verificaciones y consultas externas.
6. Aviso visible en README y en el análisis histórico para dirigir a la auditoría vigente y evitar seguir la recomendación anterior de usar demo comercialmente.
7. Ampliación después de la confirmación del propietario: conector Supabase Fixo, SELECT de catálogos/conteos, advisors, logs agregados y GET de Vercel/Auth público. Se actualizan las conclusiones y se conserva evidencia sin registros personales ni valores de variables.

No se agregaron dependencias, variables, esquemas ni funcionalidades comerciales. No se corrigieron silenciosamente los P0 de negocio: quedan explícitos y priorizados para el siguiente paquete.

## Archivos modificados por esta sesión

| Archivo/grupo | Cambio |
| --- | --- |
| `.gitignore` | Exclusiones de respaldos/logs y excepción de plantilla. |
| `README.md`, `docs/FIXO_P0_GAP_ANALYSIS.md` | Aviso de estado productivo y enlace a la auditoría vigente. |
| `docs/RESUMEN_DEL_DESARROLLO.md` | Formato de salto de línea y fin de archivo; afirmaciones históricas contrastadas en el informe de auditoría. |
| `src/app/tecnico/oportunidades/page.tsx` | Fin de archivo, sin lógica nueva. |
| `src/domain/entities/quote.ts` | Fin de archivo, sin lógica nueva. |
| `src/repositories/contracts/service-request-repository.ts` | Fin de archivo, sin lógica nueva. |
| `src/repositories/repository-factory.ts` | Fin de archivo, sin lógica nueva. |
| `docs/production/SPRINT_00_AUDIT.md` | Auditoría y plan de continuación. |
| `docs/production/SPRINT_00_REPORT.md` | Reporte de entrega. |
| `docs/production/evidence/` | Logs locales y npm; catálogo/columnas/constraints/grants/RLS/funciones/triggers/Storage/advisors Supabase; metadata Vercel; GET públicos y coincidencia booleana de backend desplegado. |
| `.audit-backups/sprint00-20261108/` | Bundle, ZIP y manifiestos locales ignorados. |

Los demás archivos del commit de línea base eran cambios anteriores al encargo; el diff del commit permite inspeccionarlos. Los logs preexistentes y `.env.local` no se publicaron ni incluyeron en el commit.

## Migraciones y variables

- Migraciones nuevas: **ninguna**.
- Migraciones remotas ejecutadas: **ninguna**.
- Migración inicial inspeccionada: `202608170001_initial_marketplace.sql`; las nueve tablas y seis cuerpos de función están en remoto, pero **el historial de migraciones devuelve cero registros**. No se conoce el mecanismo previo de aplicación; no se reejecutó SQL inicial.
- Variables nuevas: **ninguna**. Nombres existentes en §4 del informe; ningún valor secreto en la entrega.

## Validación y resultados

| Verificación | Estado | Resultado |
| --- | --- | --- |
| npm run lint | PASS | Exit 0. |
| npm run typecheck | PASS | Exit 0; TypeScript estricto. |
| npm run test | PASS | Exit 0; 10 archivos, 43 tests de dominio/mocks. |
| npm run build | PASS | Exit 0; build local Next.js. No es despliegue. |
| npm audit | FAIL | 20 paquetes: 3 critical, 7 high, 10 moderate. |
| npm audit --omit=dev | FAIL | 5 paquetes productivos: 1 critical, 4 high. |
| git diff --cached --check de baseline | PASS | Whitespace normalizado, commit local creado. |
| Bundle y snapshot | PASS | Bundle íntegro y SHA256 documentados. |
| GitHub contiene código actual | FAIL | Repo vacío; ningún push realizado. |
| HTTP público de Fixo | PASS | Inicio, directorio y login 200. |
| soyfixo.cl | BLOCKED | ENOTFOUND en esta consulta; sin auditoría Cloudflare. |
| Rutas locales sin sesión | BLOCKED | Restricciones de red entre contextos; no inferir resultado de autorización HTTP. |
| Identidad Supabase y catálogo remoto | PASS lectura | Conexión Fixo coincide con entorno local; 9 tablas con RLS, 66 columnas, 48 constraints, 16 índices, 6 funciones, 4 triggers y 12 políticas. |
| Datos comerciales remotos | FAIL preparación operativa | 2 usuarios/perfiles superadmin, 8 categorías; 0 técnicos, solicitudes, documentos, objetos Storage y auditoría. |
| Historial de migraciones | FAIL trazabilidad | Sin registros aunque el esquema existe; reconciliar antes de migraciones futuras. |
| Advisors Supabase | FAIL brechas; PASS inspección | 4 grupos de seguridad, 3 de rendimiento; health sin observaciones. Enlaces de remediación en §14 de auditoría. |
| Auth/REST anónimo | PASS lectura parcial | Email/signup habilitados; autoconfirm desactivado; tablas comerciales ausentes; helpers false/null. HEAD exact devuelve 0 perfiles visibles de 2 y 8 categorías públicas. Configuración URL/SMTP completa NOT TESTED. |
| Vercel proyecto/env/domains | PASS lectura | Sin link Git; 2 variables Supabase target production; solo dominio fixo-marketplace.vercel.app; Node 24.x. |
| Commit/branch de release en Vercel | FAIL trazabilidad | 2 despliegues CLI; último productivo 17/08/2026 18:44:51 Chile; no SHA Git registrado. |
| Backend de login público | PASS coincidencia | URL/clave pública coinciden con configuración local; solo se conservaron booleanos. No prueba paridad de todo el código. |
| Registro/correo/Flow/RLS/concurrencia reales | NOT TESTED | Sin operaciones remotas ni entorno de integración validado. |

Los logs actuales sustituyen la dependencia de registros históricos para los cuatro checks. Las normalizaciones posteriores fueron solo whitespace; no hubo cambios de comportamiento que justifiquen repetir toda la suite. Los documentos/JSON se revisan antes de guardar la entrega.

En la ampliación remota no se modificó código de aplicación, dependencias ni infraestructura. Se mantienen los resultados de lint/typecheck/43 tests/build del mismo código ya verificado; no se presentan como ejecuciones nuevas. Los nuevos JSON y enlaces del informe se validan localmente.

## Consideraciones de seguridad y riesgos

- Bloquear publicación hasta resolver fallbacks demo, solicitudes parciales, ausencia de quotes/jobs, veracidad del contenido y dependencias vulnerables.
- No habilitar NEXT_PUBLIC_DEMO_MODE como remedio al directorio vacío: usa sesiones sin firma y persistencia en memoria.
- No otorgar UPDATE genérico a solicitudes para arreglar la incompatibilidad: diseñar transición/RPC mínima y autorizada.
- No repetir la migración inicial sobre una DB existente; primero inspeccionar catálogo/drift e historial.
- No hay evidencia de aislamiento RLS real ni de controles de credenciales técnicas. Un build verde no los sustituye.
- El rechazo inicial de lectura quedó resuelto con confirmación expresa del propietario y la conexión Fixo. Las consultas nuevas fueron permitidas; para Supabase no se necesitó la service role local. No se consultaron proyectos ajenos.
- Confirmado en remoto: bucket privado sin límites MIME/tamaño, funciones SECURITY DEFINER ejecutables por anon/authenticated, search_path mutable en una función y protección de contraseñas filtradas desactivada. No se cambiaron permisos ni ajustes.
- Los grants remotos confirman ausencia de UPDATE/DELETE en solicitudes y falta de política de oportunidades elegibles. Persisten grants amplios TRUNCATE/REFERENCES/TRIGGER, sin una vía de explotación PostgREST demostrada.
- Los respaldos son locales y excluyen secretos/DB; falta validar backup y recuperación de datos con el propietario del proyecto correcto.

## Criterios de aceptación del Sprint 00

| Criterio | Estado |
| --- | --- |
| Inspeccionar código real y contraste documental | PASS |
| Inventariar dependencias demo y P0 observados | PASS |
| Matriz funcional con evidencia, brecha, criticidad, dependencias y acción | PASS |
| Verificar Git y existencia/contenido de GitHub | PASS para inspección; FAIL sincronización de código |
| Respaldar y crear línea base local revisada | PASS |
| Ejecutar lint/typecheck/tests/build | PASS |
| Inspeccionar catálogo/RLS/grants/Storage y Auth público remoto | PASS inspección; FAIL brechas; Auth URL/SMTP NOT TESTED |
| Inspeccionar configuración GitHub–Vercel | PASS inspección; FAIL integración: sin link Git ni SHA |
| Validar rama aprobada y release reproducible | BLOCKED: falta acordar/configurar release; no es un bloqueo de acceso |
| Proponer orden final de sprints y paquete concreto | PASS |
| Preparación para producción | FAIL: P0 abiertos |

## Estado de Git y recomendación

La línea base está en `main`, commit `9af3a64`, sin upstream. La primera entrega documental quedó en `465efef`. La ampliación remota se guarda en un commit local posterior `docs: verify Fixo remote production audit`; su hash se consulta con `git log -1`. La verificación final del árbol se realiza después del commit. Ninguno se ha enviado al remoto.

**Commit:** línea base y auditoría inicial creadas; guardar ampliación como commit documental local. **Push:** pendiente de aprobación del código y de la rama destino. **Deploy:** no recomendado con los bloqueos actuales; preparar preview verificable tras las correcciones. **Cobros reales:** no autorizados y no implementados.

Antes de aprobar un push que pueda disparar Vercel, confirmar producción automática/rama/preview para evitar publicar involuntariamente el baseline defectuoso. No crear una rama de producción por suposición.

## Plan de rollback y recuperación

No hay cambios remotos que revertir. Para deshacer los ajustes locales de auditoría, revisar su diff y revertir solo `.gitignore`, whitespace o documentación que se decida retirar; no ejecutar reset --hard ni borrar trabajo previo. El commit baseline preserva el desarrollo existente.

Para reconstruir el estado inicial en **otra carpeta**, clonar el bundle local y aplicar los archivos del ZIP conservando rutas, usando el manifiesto y `git-status-before.txt` para reproducir las eliminaciones previas. No extraerlo encima del checkout con trabajo nuevo. Configurar secretos por un canal privado autorizado: no están en los respaldos. Verificar SHA256 antes de restaurar.

No usar el bundle como respaldo de Supabase; la cuenta correcta ya se inspeccionó, pero su estrategia de backups/PITR/restore no queda verificada por las herramientas utilizadas. No se generó un dump remoto ni se descargaron documentos.

## Pendientes y siguiente paquete

1. Reconciliar historial de migraciones vacío con esquema existente; preparar ajustes mínimos de grants/helpers/Storage y verificar Auth URL/SMTP y backups. El acceso de lectura ya está resuelto.
2. Remediación de dependencias de producción; actualización revisada, sin upgrades forzados indiscriminados.
3. Cierre de demo en producción y eliminación temprana de reseñas/datos ficticios.
4. Sprint 01: permisos y Auth real verificable, incluida recuperación y suspensión.
5. RPC/RLS de solicitudes preparada y probada antes de aprobación de migración remota.

El siguiente conjunto y criterios detallados figuran en §12 de la auditoría. No se solicita otra confirmación de propiedad ni autorización de lectura. La autorización recibida no habilita modificaciones de servicios, migraciones remotas, push, deploy ni cobros. Estos requerirán una propuesta concreta y aprobación explícita.
