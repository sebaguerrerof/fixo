# Sprint 06 — Infraestructura, servicios y preparación para producción

Estado: propuesta aprobada por el propietario en esta conversación el 13 de noviembre de 2026 (America/Santiago). Presupuesto y decisiones de entorno pendientes del inventario. Codex mantiene arquitectura y revisión; Claude Code implementa, integra y prueba el alcance aprobado.

## 1. Objetivo y autorizaciones

Dejar Fixo con infraestructura validada, servicios supervisados, recuperación ensayada y un procedimiento reproducible de liberación. Este sprint termina con preparación y validación; no con apertura comercial ni Flow productivo.

La aprobación de este plan autoriza documentarlo. No autoriza por sí sola implementar código, contratar servicios, crear o modificar recursos remotos, enviar correos externos, hacer push/merge, aplicar migraciones remotas, modificar DNS/nameservers/Auth/SMTP, activar workers ni desplegar a producción. Cada operación externa requiere autorización específica de destino y alcance; las autorizaciones históricas del Sprint 05 no se heredan. Las pruebas aisladas y la implementación se ejecutarán cuando el propietario las autorice.

Mantener pagos reales apagados y conservar registros financieros. No incluir reembolsos ejecutables, transferencias a profesionales, nuevas políticas comerciales ni cambios en Q/F/T. La preparación de infraestructura no acredita que Fixo esté listo para recibir clientes y técnicos reales.

## 2. Contexto y fuentes

Leídos: README.md, CLAUDE.md, AGENTS.md, plan aprobado y HANDOFF del Sprint 05 antes de que fueran vaciados externamente, docs/production/SPRINT_05_FLOW_IMPLEMENTATION_PLAN.md, SPRINT_05_REPORT.md, SPRINT_05_CODEX_REVIEW_PACKAGE.md, FIXO_PRODUCTION_READINESS.md, CI_VERCEL_RELEASE_PLAN.md y runbooks de SMTP, inspección y notificaciones. Revisados también .env.example, workflow CI, contratos/configuración relacionados y ejecutor de pagos existente.

El plan preliminar de Flow está superado por las decisiones aprobadas del Sprint 05; no es fuente para agregar reembolsos o recargos. El informe y paquete de cierre acreditan integración parcial Flow Sandbox, despliegue en www.soyfixo.cl y Supabase Cron activo, con pagos apagados. Son antecedentes documentados, no verificación actual de las cuentas.

Pendientes heredados: CI sin ejecución exitosa por bloqueo de facturación; orden externa Sandbox 11657296 pendiente aceptada como limitación; casos Sandbox sin evidencia real; inspector sin hosting permanente; notificaciones sólo capture; restauración integral y staging sin acreditar. README, supabase/README y readiness contienen estados históricos que deben actualizarse con evidencia.

PLAN.md y HANDOFF.md aparecieron vacíos por cambios externos durante la planificación. Este documento ocupa únicamente PLAN.md. No restaurar ni sobrescribir HANDOFF ni otros cambios ajenos. Conservar historia Sprint 05 en Git y en sus informes; antes de reemplazar este plan en el futuro, conservar una copia aprobada en docs/production/SPRINT_06_IMPLEMENTATION_PLAN.md.

## 3. Decisiones, supuestos y preguntas

Confirmado por el propietario:
- Dominio principal: https://www.soyfixo.cl; apex soyfixo.cl redirige al principal.
- Inventariar y reutilizar cuentas/servicios existentes; definir presupuesto después.
- Alcance: preparación y validación, con pagos reales apagados.

Supuestos propuestos, no decisiones de contratación:
- Conservar Supabase productivo existente y crear/reutilizar un proyecto de validación separado.
- Un host Linux pequeño para inspector y notificaciones, con usuarios, procesos y secretos separados; capacidad inicial a medir considerando ClamAV (referencia previa: 4 GiB).
- Datos sintéticos en validación; correo sólo a destinatarios autorizados. Sin copias de PII productiva.
- Canales iniciales: correo e información dentro de la app; no WhatsApp/SMS.
- Evaluar RPO 24 h y RTO 8 h como objetivos iniciales pendientes de aprobación; no presumir que sirven para cobros reales.

Resolver antes de comprometer configuración o gastos:
1. Titulares, administradores, planes, regiones, accesos y recuperación de Cloudflare, registrador, Vercel, GitHub, Supabase y Zoho; existencia de servidor Linux.
2. Casillas/alias corporativos, remitente transaccional, soporte y destinatarios de prueba.
3. Presupuesto, volumen inicial, responsable operativo, canal de alertas y cobertura de incidentes.
4. RPO/RTO, retención de backups/logs/documentos y destino externo de respaldo.
5. Admisibilidad comercial de planes, aislamiento disponible y procedimiento exacto de liberación Vercel/GitHub.

## 4. Arquitectura mínima

| Servicio | Diseño |
| --- | --- |
| DNS | Cloudflare autoritativo, conservando registrador; registros web DNS only inicialmente |
| Web | Vercel existente para producción; proyecto separado para validación protegida |
| Código | GitHub con PR, CI requerido y publicación productiva explícita |
| Datos | Supabase existente para producción y proyecto separado para validación |
| Flow | Reutilizar Supabase Cron + pg_net/Vault + endpoint actual; no añadir Vercel Cron |
| Documentos | scripts/inspection-worker.mjs con ClamAV/freshclam en Linux supervisado |
| Avisos | Outbox y leases existentes; adaptar worker a correo transaccional |
| Correo humano | Zoho Mail para casillas corporativas |
| Correo automático | Zoho CPaaS (antes ZeptoMail): SMTP de Auth y API del worker |
| Supervisión | Logs y métricas existentes, alertas y monitor externo independiente del host |
| Recuperación | Backups de DB, objetos Storage y configuración, cifrados y ensayados |

Zoho Mail excluye correos automáticos/transaccionales en su política vigente: no usar su SMTP corporativo para Auth o el outbox. Verificar aprobación, región, credenciales y capacidad de CPaaS antes de integrar. Vercel Hobby no es base admisible para lanzamiento comercial; inventariar el plan y presupuestar uno compatible. No fijar importes de proveedores sin cotización vigente.

No incorporar Kubernetes, otro backend, otra cola, un segundo reconciliador de Flow ni infraestructura como código generalista. Preferir runbooks y scripts pequeños verificables. No habilitar proxy Cloudflare, reglas de caché o desafíos adicionales por defecto: cualquier cambio exige validar Auth, IP confiable, callbacks y contenido privado.

## 5. Etapas y entregables

### Etapa 1 — Inventario y presupuesto

- Inventario de sólo lectura autorizado: servicios, planes, DNS/NS/DS/MX/TXT/CAA, dominios Vercel, enlace Git/ramas, SHA desplegado, historial de migraciones, cron, Auth/Storage y nombres de secretos (sin valores).
- Separar antecedentes del Sprint 05 de comprobaciones nuevas. No repetir baseline ni editar migraciones aplicadas.
- Presupuesto: costos fijos, asientos, compute por proyecto, correo, almacenamiento/backups, egreso, monitoreo, impuestos y sobreconsumo; alertas y límites disponibles.
- Salida: inventario fechado, responsables, desviaciones, presupuesto y decisiones pendientes. No contratar automáticamente.

### Etapa 2 — Entorno de validación

- Proyecto Supabase separado, migraciones canónicas y fixtures sintéticos; claves, Vault, buckets, correo y workers exclusivos del entorno.
- Proyecto Vercel separado, origen estable protegido; protección compatible con retorno y callback POST. Excepciones mínimas verificables, sin bypass global ni secretos en URL.
- Matriz de variables por destino: demo=false, URL/key pública correcta, service role sólo servidor, FIXO_APP_URL, remitentes, Flow Sandbox, claves de cifrado y bearer del worker independientes.
- Previews de PR no obtienen claves productivas. Forks sin secretos; no allowlists amplias de Auth hacia producción.
- Salida: pruebas positivas y negativas de aislamiento. Un preview visual con claves ficticias no acredita integración.

### Etapa 3 — GitHub y Vercel

- Resolver bloqueo de CI y ejecutar workflow existente: application, database, integración local, build, smoke y audits con versiones fijadas. No usar credenciales productivas en CI.
- Proteger rama acordada con PR y checks reales; preservar trabajo existente antes de cualquier integración de ramas.
- Vincular primero el proyecto de validación. Inventariar automatismos Vercel antes de enlazar producción: un push/merge no debe publicar sin la aprobación de release.
- Definir mecanismo manual de liberación verificable, SHA, migraciones compatibles, logs de build y despliegue anterior para rollback.
- Construir producción con sus propias variables; NEXT_PUBLIC se incorpora al build. No promover un artefacto construido con backend de validación como si fuera productivo.
- Salida: PR verde y despliegue de validación trazable; simulación del control de release.

### Etapa 4 — Cloudflare, Zoho y Auth

- Preparar inventario completo de zona, diferencias por registro, TTL, ventana, responsable y rollback antes de solicitar autorización DNS.
- Si corresponde cambiar nameservers, tratar DS/DNSSEC en registrador y zona como parte de la transición, verificando resolución sin SERVFAIL. No transferir dominio como requisito.
- Configurar apex/www con valores exactos emitidos por Vercel, sin IP/CNAME genéricos. Validar TLS, redirect a www, ausencia de bucles y callbacks sobre origen canónico.
- Preparar Zoho Mail corporativo y CPaaS transaccional, usando registros y hosts exactos de cuenta/región. Un único SPF, DKIM, DMARC inicial de observación aprobado y endurecimiento posterior basado en evidencia.
- Configurar SMTP CPaaS en Supabase Auth, plantillas existentes, Site URL y callbacks exactos. Mantener invitaciones apagadas hasta comprobar entrega.
- Pruebas externas de envío/recepción sólo a destinatarios autorizados; revisar SPF/DKIM/DMARC, inbox/spam, errores y rebotes. Aceptación por SMTP no equivale a entrega.
- Salida: paquete DNS/configuración revisable; ejecución y evidencia únicamente tras autorización específica.

### Etapa 5 — Workers, correo y monitoreo

- Inspector: reutilizar plantilla systemd, usuario dedicado, límites de memoria/disco/tiempo, temporales privados y descarga TLS; freshclam separado, reinicio y apagado ordenado.
- Mantener fail-closed, leases/fencing/backoff. Firmas antiguas o motor caído nunca producen clean; clean no sustituye revisión profesional. Alertar >24 h de antigüedad de firmas y conservar corte existente a 48 h.
- Notificaciones: adaptar worker y lógica existentes al proveedor CPaaS detrás del contrato; capture sólo en pruebas. Reutilizar UUID del aviso para correlación/idempotencia si el proveedor la soporta; no asumir soporte sin comprobar contrato.
- Definir manejo de envío ambiguo, timeout y reintento antes de habilitar correo real; no prometer exactly-once. Mantener accepted separado de delivered.
- Para registrar delivered/bounce, verificar autenticación de eventos CPaaS, replay y correlación. Si no hay evidencia confiable, conservar accepted; no inventar estados finales. Cualquier extensión DB usa migración nueva y RPC estrechas.
- No ejecutar capture sobre avisos comerciales ni agotar intentos por allowlists sintéticas. Reencolado dead sólo con motivo y auditoría.
- Flow: conservar ejecutor actual, health y leases; distinguir mantenimiento con switches apagados de conciliación activa. No declarar saludable sólo por HTTP 200.
- Alertas por cron detenido, fallos internos, antigüedad/profundidad de colas, dead, cuarentenas, reinicios, firmas, memoria/disco, correo y backups. Monitor externo detecta caída del host/monitor local. Definir umbrales, receptor, escalamiento y acuse probado.
- Salida: workers supervisados y pruebas de recuperación/alertas en validación; activación productiva separadamente autorizada.

### Etapa 6 — Recuperación, seguridad y entrega

- Respaldos por capas: esquema/datos, alcance de Auth, objetos Storage y sus metadatos, configuración Auth/SMTP, DNS, cron/Vault y referencias a secretos. Claves de descifrado recuperables por canal separado del contenido.
- Cifrar, guardar fuera del host y limitar accesos/retención. No confundir backup de DB con copia de objetos Storage ni disponibilidad del proveedor con respaldo independiente.
- Restaurar en destino aislado con cron/envíos apagados: validar Auth/sesiones según alcance soportado, RPC/RLS/grants, archivos/hashes, pagos, eventos y claves; medir RPO/RTO. Documentar límites reales sin declarar recuperación integral por un restore SQL sintético.
- Revisar MFA/recuperación administrativa, buckets privados, sesiones revocadas, secrets/history scan, logs sin PII y respuesta a incidentes. No cambiar visibilidad del repositorio automáticamente.
- Verificar cabecera IP confiable en el trayecto real Vercel y posible proxy; no elevar rate limits desde cabeceras falsificables. Revisar headers/caché en rutas sensibles con regresión de Auth.
- Clave de tokens Flow: no rotar con pendientes usando una única clave. Documentar drenaje y rotación segura; llavero multiclave sólo si se justifica y aprueba como ampliación.
- Ensayar liberación/reversión de aplicación sin restauración destructiva de DB. Actualizar documentación, reporte, matriz PASS/FAIL/NOT TESTED y recomendación de preparación.

## 6. Archivos previstos

Crear:
- docs/production/SPRINT_06_IMPLEMENTATION_PLAN.md (copia del plan aprobado).
- docs/production/INFRASTRUCTURE_INVENTORY.md.
- docs/production/ENVIRONMENT_MATRIX.md.
- docs/production/LAUNCH_RUNBOOK.md.
- docs/production/BACKUP_RESTORE_RUNBOOK.md.
- docs/production/MONITORING_RUNBOOK.md.
- docs/production/SPRINT_06_REPORT.md y evidencia sanitizada.
- ops/notification-worker.service; configuración/runbook de freshclam y supervisión si lo requiere el host.
- Adaptador CPaaS y pruebas bajo scripts/lib o integrations según el contrato existente; decidir ruta al revisar la implementación, sin duplicar NotificationService.
- Scripts mínimos de health/backup/restore y pruebas donde falten; definirlos tras inventario de herramientas existentes.

Modificar sólo según necesidad comprobada:
- .github/workflows/ci.yml, .env.example, src/config/server-environment.ts y pruebas relacionadas.
- scripts/notification-worker.mjs, scripts/lib/job-notification.mjs y tests actuales.
- ops/inspection-worker.service y contratos de inspección únicamente si pruebas operativas lo requieren.
- Runbooks existentes de CI/Vercel, SMTP, inspector, notificaciones y Flow.
- README.md, supabase/README.md, FIXO_PRODUCTION_READINESS.md y plan preliminar Flow (enlace a estado vigente).
- Nuevas migraciones sólo para eventos de entrega, métricas o reencolado auditado que realmente requieran esquema. No editar historia aplicada ni introducir tablas genéricas sin necesidad.

No crear vercel.json ni añadir dependencias por rutina: justificarlo por una necesidad verificada. Ningún archivo contiene secretos o datos personales reales.

## 7. Pruebas

- CI real: scripts existentes de lint, typecheck, test, build, test:smoke, secrets:check, audits y suites PostgreSQL/PostgREST. Validar comandos/versiones antes de ejecutar.
- Entornos: intentos de usar proyecto equivocado, preview/fork con secretos, callbacks no autorizados y acceso ajeno deben fallar cerrados.
- Recorrido integrado sintético sobre build desplegado: registro, confirmación, recuperación, postulación, carga/inspección/revisión documental, solicitud, cotización, trabajo y avisos; desktop/mobile/teclado.
- Correo Auth: expiración/reuso, lectores que preabren enlaces, otro navegador, recuperación y revocación; entrega y errores autorizados.
- Notificaciones: lease perdido, reinicio, timeout antes/después de aceptación, replay de eventos, bounce y proveedor caído; sin falsos delivered ni PII en logs.
- Inspector: archivo permitido, inválido/malicioso controlado, reemplazado, motor caído, firmas vencidas, descarga fallida, lease expirado y memoria/límites; fallo no publica documento.
- Flow Sandbox en validación: pago inicial y adicional, replay, conciliación sin callback y reinicio. Priorizar lagunas del Sprint 05: pérdida de respuesta, duplicado, mismatch, consulta fallida y orden callback/retorno. Casos imposibles en simulador se prueban con inyección controlada, distinguiendo evidencia real de dobles.
- DNS/TLS: NS/DS, apex/www, MX/TXT/CAA, resolución desde varios resolvers, cadena de certificados, redirects y POST de callbacks sin desafío/bloqueo accidental.
- Operación: parada de cada worker/cron, reinicio del host, fallo de proveedor y alerta; verificar recuperación y ausencia de pérdida de tareas.
- Restore aislado con archivos reales sintéticos y métricas RPO/RTO; ensayo de rollback de app y compatibilidad con esquema.
- Prueba sostenida de 24 horas propuesta en validación para reinicios, colas, firmas y alertas; ajustar duración/carga al volumen aprobado. No requiere tráfico productivo.

## 8. Riesgos principales y tratamiento

| Prioridad | Riesgo e impacto | Mitigación / condición de salida |
| --- | --- | --- |
| CRÍTICO | Confundir preparación con apertura: usuarios reales sin pagos productivos, soporte o políticas terminadas | Sprint termina sin apertura; gate comercial y Flow productivo en autorización posterior |
| CRÍTICO | Mezcla de validación/producción: PII expuesta, correo o cobros involuntarios | Proyectos, secretos, remitentes y switches separados; pruebas negativas y revisión de targets |
| CRÍTICO | Backup incompleto o claves perdidas: restaurar DB no recupera documentos/configuración | Respaldo por capas, copia externa cifrada y restauración comprobada con RPO/RTO aprobado |
| ALTO | Cambio DNS/DS/MX erróneo: caída web/correo o SERVFAIL | Inventario exacto, revisión de DNSSEC, ventana, pruebas y rollback; no cambios sin autorización |
| ALTO | Enlace Git/Vercel publica automáticamente o build usa backend equivocado | Validación primero; control de release probado; build por entorno; autorización de producción separada |
| ALTO | CI bloqueado o evidencia histórica tomada como nueva: regresiones sin detectar | CI real verde del SHA candidato; no sustituir por actionlint o resultados previos |
| ALTO | Workers detenidos, ClamAV sin memoria o firmas obsoletas: documentos/avisos bloqueados | Supervisión, límites y carga medida; fail-closed; heartbeat externo y alertas ensayadas |
| ALTO | Credenciales amplias de worker comprometidas | Usuarios/secretos separados, hardening del host, mínimo acceso operativo, rotación y revisión de RPC/grants; no secretos en logs |
| ALTO | Correo no permitido, duplicado o no entregado: bloqueo de registro y avisos | CPaaS transaccional aprobado; entrega real comprobada; tratamiento de ambigüedad/rebotes; accepted no equivale a delivered |
| ALTO | Rotación de clave única vuelve tokens pendientes indescifrables | Drenar pendientes y conservar capacidad de recuperación; no rotación automática; ampliación multiclave sólo aprobada |
| ALTO | Monitor alojado junto al servicio no informa su caída | Monitor externo independiente, responsable y canal probado; distinguir mantenimiento de conciliación |
| MEDIO | Presupuesto insuficiente, cuotas o sobreconsumo | Inventario y cotización previa; alertas, volumen y límites; staging nunca se sustituye por acceso productivo |
| MEDIO | Lagunas Sandbox, orden externa abierta y docs desactualizadas dan falsa sensación de cierre | Mantener limitaciones visibles, clasificar evidencia, actualizar docs y resolver/aceptar excepciones explícitamente |
| MEDIO | Un solo host concentra inspector y correo | Procesos/usuarios/límites separados, prueba de memoria, recuperación ensayada; separar hosts sólo si carga o riesgo lo justifican |

Los riesgos no se consideran resueltos por escribir este plan: el reporte asignará responsable, evidencia y estado residual a cada uno. Los bloqueos críticos impiden recomendar apertura; excepciones requieren decisión explícita, nunca PASS ficticio.

## 9. Criterios de aceptación

1. Inventario verificado, presupuesto y responsables aprobados; planes compatibles con uso previsto.
2. CI real verde del candidato y validación aislada operativa, sin secretos/PII productivos.
3. Dominio www, DNS/TLS y correo comprobados después de sus autorizaciones; si no se autoriza ejecutarlos, quedan preparados pero NOT TESTED y el sprint no se declara íntegramente validado.
4. Recorrido sintético integrado con Auth, documentos, trabajo, avisos y Flow Sandbox; sin pagos reales.
5. Workers recuperables con supervisión y alertas efectivas; fallos no producen clean/paid/delivered ficticios.
6. Backups y restore por capas ensayados; objetivos de recuperación medidos y aceptados.
7. Procedimiento de release/rollback trazable por SHA y migraciones, sin despliegue automático no autorizado.
8. Reporte distingue PASS local, PASS integración, FAIL y NOT TESTED; riesgos residuales, costos y limitaciones explícitos.
9. Documentación vigente y sin bloqueos críticos de infraestructura pendientes para recomendar el siguiente gate. No afirmar que ello habilita comercialmente el producto.
10. Pagos reales apagados, sin cambios comerciales ni acciones externas fuera de autorización.

## 10. Fuentes oficiales consultadas durante el diseño

Revalidar contrato, precios y límites de las cuentas al implementar; no actualizar dependencias por rutina.

- Cloudflare nameservers/DNS: https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/
- Vercel dominio externo: https://vercel.com/docs/domains/set-up-custom-domain
- Vercel uso de planes: https://vercel.com/docs/limits/fair-use-guidelines
- Zoho Mail, usos excluidos: https://www.zoho.com/mail/help/usage-policy.html
- Zoho CPaaS (antes ZeptoMail): https://www.zoho.com/cpaas/help/introduction.html
- CPaaS SMTP: https://www.zoho.com/cpaas/help/smtp-home.html
- CPaaS eventos: https://www.zoho.com/cpaas/help/webhooks.html
- Supabase SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase backups: https://supabase.com/docs/guides/platform/backups
- Supabase cambios vigentes: https://supabase.com/changelog.md
