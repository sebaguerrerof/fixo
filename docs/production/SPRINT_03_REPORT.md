# Sprint 03 — solicitudes, matching y cotizaciones persistentes

9 de noviembre de 2026. Rama local `codex/sprint-02-5-service-marketplace`, basada en `d5ccd71`. **Implementado y verificado con Fixo real; release comercial pendiente de gates operativos y autorización de publicación.** No hubo push/deploy, pagos, reset ni modificación de las dos cuentas originales.

## Funcionalidad

- `/solicitar`: sesión customer verificada en servidor, Zod estricto, prioridad normal, operación UUID estable, SQL atómico e idempotente, categoría/problema/comuna, fecha y horario preferidos, dirección/referencia/información privadas. Límite DB de diez publicaciones por cuenta en 24h. El propietario, estado y asignación nunca proceden del payload del navegador.
- `/cliente`: veinte solicitudes por página, incluidas cerradas/canceladas, total real y número de propuestas no borrador. Detalle, comparación de técnicos/propuestas, historial, cancelación de solicitudes abiertas y adjudicación. No hay contadores de pagos ficticios. La adjudicación se consulta por request ID, sin depender de un listado truncado de trabajos.
- Fotografías opcionales desde el detalle: hasta cinco, carga JPEG/PNG máximo 4 MiB, decodificación completa/recodificación JPEG y eliminación de EXIF/GPS; bucket privado. Solo propietario, admin y adjudicado actualmente habilitado pueden leerlas. API con Origin exacto y límite de streaming, descarga reautorizada sin bearer URL ni caché pública.
- `/tecnico/oportunidades`: proyección SQL sin ID/contacto/dirección del cliente, matching por comuna normalizada exacta, categoría principal revisada, cuenta activa, perfil/profesión aprobados, fingerprint vigente, requisitos/documentos actuales y solicitud comercial abierta. Declarar una categoría secundaria no la habilita.
- Cotización: un registro por técnico/solicitud, borrador persistente/reanudable, edición con versión, envío, retiro y reenvío. CLP enteros y desglose de mano de obra/materiales/diagnóstico, fechas y condiciones. Repositorio real completo; las mutaciones usan RPC con autorización vigente.
- Confirmación explícita del cliente: una sola RPC bloquea solicitud/cotización, verifica revisión/vigencia/habilitación, acepta una, rechaza alternativas, crea un trabajo y snapshot inmutable y registra al actor. Reintento devuelve el mismo trabajo; conflicto determinista PT409.
- Trabajo inicial `awarded`, pago `not_enabled`: sin avance, cobro, ejecución ni finalización habilitados. Los contratos que intentan crear trabajos fuera de la adjudicación o avanzar estados reales rechazan la operación deliberadamente.
- `/admin/solicitudes`: tabla, filtros, detalle privado, elegibles actuales, propuestas, adjudicación e historial con actor. No se añadieron dashboards financieros ni incidencias ficticias.

Se reutilizaron entidades, factories, servicios y repositorios. Mock explícito conserva los escenarios antiguos, sin fallback comercial. El layout verifica sesión/rol en servidor; se eliminó la comprobación redundante que podía dejar una actualización esperando en navegador. Badge usa span para evitar HTML inválido e hidratación fallida.

## Migraciones aplicadas con aprobación específica

| Versión | Alcance | SHA256 del archivo local |
| --- | --- | --- |
| 20261109185924 | Cola, solicitudes privadas, cuotas/idempotencia, quotes/jobs, transacciones, supervisión y fotos | 8704b4b88a73b54ac50cd1c7cd9d6387622fe5c2f863f0845e10d73018c73a9c |
| 20261109194648 | Exigir categoría principal efectivamente revisada | 0a8aebb2a76637976dfb42c513e31a95aeb25f327fa816a0cb0f399acc0a43f5 |

El conector asignó inicialmente timestamps propios; solo sus dos entradas nuevas se reconciliaron tras cotejar nombre y SQL. Ocho versiones canónicas, sin repetir el baseline. Se revocó INSERT directo de solicitudes: frontend anterior que use esa vía queda incompatible. Ver los dos planes de ejecución con impacto/rollback. No hay backup completo restaurable confirmado; copia privada de catálogo y comprobación de tablas vacías no se presentan como tal.

## Modelo y seguridad

`service_requests` mantiene los estados existentes: submitted/publicada → receiving_quotes → technician_selected, o cancelled mientras esté abierta. Las cotizaciones tienen ciclo independiente; jobs se inicia adjudicado y payment conserva no habilitado. No hay UPDATE genérico para resolver transiciones. Fechas/ownership/overposting se validan también en DB. Dirección y fotos no forman parte del feed de oportunidades.

Once tablas públicas y trece privadas con RLS. Funciones definer con search_path fijo, objetos calificados, roles/grants explícitos y comprobación de sesión/rol actual. Las tablas privadas carecen intencionalmente de políticas para acceso directo; se alcanzan mediante operaciones acotadas. Unicidad en quote aceptada, request/job y quote/job; trigger impide cambiar snapshots y cotizaciones aceptadas. Bloqueos globales compartidos con administración preservan el orden de autorización para este MVP; antes de escalar habrá que medir contención y revisar bloqueos más finos conservando invariantes.

Advisors: health sin hallazgos; security conserva advertencias por funciones definer autenticadas deliberadamente autorizadas y protección de contraseñas filtradas deshabilitada. Esta última es un gate de Auth pendiente de configuración/aprobación. [Protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Los INFO de RLS sin políticas corresponden a tablas privadas cerradas. Performance: siete FK sin índice y cuatro índices sin uso informados; no se hizo una auditoría general ni cambios ajenos. Los nuevos accesos principales y FK del marketplace tienen índices.

## Evidencia ejecutada

| Verificación | Resultado |
| --- | --- |
| npm ci | PASS local; lockfile existente, sin cambios de dependencias declaradas |
| lint / typecheck / build final | PASS local |
| Vitest | PASS local: 208 pruebas / 32 archivos; incluye las 186 previas |
| npm audit / omit=dev | PASS local: cero vulnerabilidades en ambas consultas |
| Secretos | PASS local: revisión de fuentes y 85 artefactos cliente, sin secretos de servidor |
| PostgreSQL 17.11 aislado | PASS local: 20 escenarios; cadena completa, RLS/roles SQL, idempotencia, expiración/versión, concurrencia, snapshot, categoría, fotos y cola. Auth/Storage son fixtures de contrato; no equivalen a JWT verificados |
| pgTAP remoto | PASS integración: 27 acceso + 53 identidad actualizada + 25 marketplace = 105 aserciones, con rollback |
| API real | PASS integración: 16 escenarios con JWT propios + 3 regresiones de categoría. REST/RPC, relaciones, rechazo de overposting, borradores/versiones/retiro, suspensión con JWT antiguo, carrera de aceptación y reintentos |
| Snapshot en Fixo | PASS integración: intento de modificar snapshot rechazado por trigger PT409; auditoría única con actor customer correcto; rollback |
| Navegador marketplace | Nueve recorridos funcionales reales desktop/móvil; errores de hidratación corregidos y cuatro vistas finales verificadas sin errores, más revocación de foto privada por suspensión con cookie antigua |
| Correo capturado | Cuatro mensajes SMTP locales y seis recorridos OTP reales; SMTP Auth hospedado/expiración natural y PKCE válido completo pendientes |
| Smoke HTTP productivo | PASS local: cookies demo falsificadas rechazadas en seis rutas, enlaces inválidos y origen externo rechazados, sin escrituras Auth |

La suite SQL definida ahora suma 130 aserciones; se ejecutaron las 105 afectadas/pertinentes y se reutilizó la evidencia anterior de las 25 restantes. No se presenta como una nueva ejecución de toda la suite. Se adaptaron los runners históricos de creación/suspensión al contrato RPC, sin permitir otra vez INSERT directo. Los fallos detectados durante desarrollo quedan documentados en `browser-before-badge-fix.json`; el render final está en `browser-rendering.json` y `browser-integration.json`.

Las pruebas con service role solo prepararon identidades, entregaron resultados del inspector o limpiaron fixtures. El aislamiento se acreditó con JWT de actores, nunca con service role. Evidencia sanitizada en `sprint-03-evidence/`; manifiesto privado con UUID exactos bajo `.audit-backups`, contraseñas sintéticas borradas al limpiar.

## Limpieza y estado final

**PASS integración:** ocho identidades sintéticas, seis solicitudes y cuatro blobs retirados mediante un único manifiesto; SQL con guardas contra referencias ajenas. Se eliminaron tokens capturados, bases temporales Mailpit y claves de rate limit derivadas exactamente de esos correos. Restan exclusivamente las dos cuentas/perfiles originales superadmin activos y sus dos contactos privados. Digest `6c2936a71f2dff1144d2c7926e16f6f8` intacto. Cero técnicos, solicitudes, quotes/jobs, documentos, objetos Storage, criterios sintéticos, postulaciones, invitaciones, cola y eventos/recibos del marketplace. Ver `final-state.json`.

## Release y siguiente sprint

**BLOCKED apertura comercial:** proveedor SMTP y DNS reales, requisitos operativos/técnicos reales, worker permanente supervisado, staging y backup/restore, origen canónico, variables por entorno, CI/preview real, términos comerciales y autorización de publicación. El desarrollo se conserva en una rama y commit local; no se publicó ni se conectó un preview a datos comerciales. Secuencia y variables concretas en `SPRINT_03_RELEASE_PLAN.md`.

Ya es posible probar el recorrido solicitud → propuesta → adjudicación con persistencia real. Para prestar el primer servicio comercial falta cerrar los gates anteriores y aprobar Flow o un piloto sin pago integrado con condiciones explícitas. Sprint 04 puede comenzar sobre esta base para gestionar el trabajo; no se debe inferir pago o ejecución por aceptar una cotización. Ver `SPRINT_04_IMPLEMENTATION_PLAN.md`.
