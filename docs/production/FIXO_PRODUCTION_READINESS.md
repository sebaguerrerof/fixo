# Fixo — production readiness

9 de noviembre de 2026, America/Santiago. **BLOCKED para apertura comercial.** PASS local acredita ejecución aislada; PASS integración acredita el servicio conectado indicado. Ninguno implica autorización de publicación. No push, deploy, cambios DNS, contratación ni Auth/SMTP durante este sprint.

| Funcionalidad | Estado real | Evidencia | Criticidad | Bloqueo / responsable | Acción siguiente |
| --- | --- | --- | --- | --- | --- |
| Esquema y contratos Sprint 04 | PASS integración | Nueve migraciones canónicas, SQL comparado; database-regression.json | Alta | Sin bloqueo técnico observado / ingeniería | Conservar contrato y migraciones, reparación hacia adelante si procede |
| Regresión SQL | PASS integración | 130 históricas + 30 nuevas, rollback | Alta | CI remoto no ejecutado / ingeniería | Ejecutar misma suite en CI efímero aislado |
| Gestión de trabajo y roles | PASS integración | 36 escenarios PostgreSQL, doce API con seis JWT | Alta | Ejecución comercial disabled / Fixo | Aprobar política comercial y proveedor o piloto comercial específico |
| Interfaces y evidencias | PASS integración | Nueve recorridos desktop/mobile/teclado, privacidad y conflictos; limpieza final comprobada | Alta | Sin bloqueo funcional observado / ingeniería | Mantener regresiones en preview aislado |
| Outbox/captura | PASS integración | Tres escenarios worker REST, leases/retries/captura | Alta | Sin proveedor comercial ni host / Fixo + operaciones | Aprobar remitente/proveedor, worker supervisado, alertas y entrega autenticada |
| Entrega de correo real | NOT TESTED | Ningún correo externo enviado | Crítica | SMTP/Auth y proveedor transaccional no verificados / Fixo | Configurar y aprobar pruebas reales de entrega |
| Pruebas y build | PASS local | npm ci, lint, TS, 221 Vitest, build, ambos audits cero | Alta | Sin CI de este código publicado / ingeniería | Push autorizado y CI con credenciales build-only |
| Flow contratos | PASS local | Orden snapshot/CLP, adapter disabled y unitarias | Crítica | Sin integración Sandbox / Fixo + ingeniería | Decisiones comerciales y autorización Sprint 05 |
| Flow Sandbox (Sprint 05) | PASS local / Sandbox real NOT TESTED | pgTAP 254, 66 checks PG, 10/10 navegador local; ver [SPRINT_05_REPORT.md](SPRINT_05_REPORT.md) | Crítica | Sin credenciales Sandbox, origen HTTPS ni destino aislado; ejecutor del worker sin decidir / Fixo + ingeniería | Autorizar destino y credenciales, decidir worker, ejecutar [runbook](SPRINT_05_FLOW_SANDBOX_RUNBOOK.md) §9 |
| Cobro, reembolso y liquidación | BLOCKED | payment_state sigue not_enabled; no API real | Crítica | Modelo comercial pendiente / Fixo + contabilidad/legal | Definir receptor, comisión, impuestos, momento de cobro y pagos al técnico |
| Backup de aplicación sintética | PASS local | restore-result.json: tablas/digests/FK/RLS | Alta | Alcance solo sintético / ingeniería | Mantener ensayo y ampliar a proveedor aislado |
| Backup/restore completo Fixo | BLOCKED / NOT TESTED | Plan de respaldo por capas | Crítica | Sin conexión DB/destino y ensayo integral / Fixo + operaciones | Obtener acceso seguro y destino separado autorizado; probar Auth/Storage/config |
| Staging y preview aislado | BLOCKED | Cuota Free previa impidió crear proyecto | Crítica | Destino/presupuesto pendientes / Fixo | Aprobar solución sin pausar proyectos ajenos; nunca preview público con DB comercial |
| GitHub sincronización / CI real | BLOCKED | Complemento no devolvió ramas/runs de referencia; solo CI local en repo | Alta | Push no autorizado / Fixo + ingeniería | Revisar commit, autorizar push, comprobar HEAD remoto y ejecución verde |
| Vercel Git / variables | BLOCKED | project.git=null; solo dos NEXT_PUBLIC production | Crítica | Nueva versión no desplegada / Fixo + ingeniería | Vínculo Git y entornos tras autorización; service role server-only/origen explícito/demo=false |
| Dominio canónico / Cloudflare | BLOCKED | Dominios verificados en Vercel; apex redirige a www; cuenta DNS no operada | Alta | Decisión de origen y acceso autorizado / Fixo | Aprobar canónico y plan DNS, cookies/redirects/Auth exactos; no cambiar registros por inferencia |
| Correo corporativo Zoho | BLOCKED | MX y TXT apex ENODATA, DMARC ENOTFOUND | Alta | Cuenta/verificación no acreditadas / Fixo | Configurar Zoho con registros exactos emitidos por proveedor, validar recepción/envío |
| Worker documental ClamAV | BLOCKED (hosting) | Pruebas locales reales Sprint 03; runbook existente | Crítica | Servicio permanente y firmas/alertas pendientes / operaciones | Host separado, supervisión, límites, actualización de firmas, monitoreo de cuarentena |
| Auth password protection | BLOCKED (revisión operativa) | Advisor WARN previo protección filtradas desactivada | Alta | Cambio Auth no autorizado / Fixo | Revisar disponibilidad/costo y autorizar configuración si procede |
| Índices / carga | NOT TESTED (producción) | Siete FK antiguas sin índice; nuevas cubiertas; muestra sintética | Media | Sin prueba de carga comercial / ingeniería | Medir planes/carga real antes de optimizar o retirar índices |

## Secuencia ejecutable de publicación

1. Revisar commits locales de Sprint 04, evidencias y limpieza; conservar dos cuentas originales y ejecución disabled. Autorizar explícitamente push a `sebaguerrerof/fixo`; comprobar SHA remoto. No confundir commit local con código publicado.
2. Ejecutar `.github/workflows/ci.yml` en GitHub: Node 24/lockfile, lint/TS/unitarias/build/smoke/audits y Supabase efímero con 160 pgTAP. Sin access token/DB password/service role comercial en CI.
3. Resolver staging separado con presupuesto/acceso aprobado. Backup esquema/datos/Auth/Storage/config, restauración ensayada en destino aislado y objetivos RPO/RTO medidos. No resolver cuota pausando proyectos ajenos por cuenta propia.
4. Conectar Git/Vercel y crear preview protegido **con claves de staging**. Si se usa preview visual build-only inválido, documentar que no valida Auth ni transacciones. No adjuntar la DB comercial como atajo.
5. Configurar por entorno NEXT_PUBLIC_DEMO_MODE=false, URL/clave pública del proyecto correcto, SUPABASE_SERVICE_ROLE_KEY exclusiva de servidor, FIXO_APP_URL exacta, FIXO_INVITATIONS_ENABLED=false hasta entrega comprobada. Las variables públicas se incorporan al build: no promover un artefacto de staging con esos valores a production.
6. Aprobar origen canónico y ventana de DNS. Validar apex/www, TLS, cookies, redirects/Auth y callback URLs exactas. Configurar Zoho y correo transaccional con SPF/DKIM/DMARC del proveedor real y pruebas autorizadas. No reutilizar TXT ficticios de documentación.
7. Desplegar hosts supervisados independientes para inspector ClamAV y notificaciones/reconciliación futura, con secretos, límites, alarmas y retención sin PII en logs. Captured/accepted no acreditan entrega.
8. Cerrar política comercial y Sprint 05 Sandbox con callback/conciliación confiables; mantener disabled hasta un gate aprobado. No mezclar liquidación de técnicos con cobro al cliente.
9. Autorizar migraciones/config/deploy finales en ventana controlada; migrar antes de promover frontend compatible. Probar recorridos sintéticos/health/Auth/privacidad/cola. Mantener un frontend compatible como rollback, sin restauraciones ni retirada de controles automáticamente.
10. Aprobar apertura comercial únicamente tras cerrar bloqueos críticos y asignar soporte/incidentes/backup/worker. Un rollback de Vercel no revierte DB y el frontend antiguo que usa INSERT directo de solicitudes ya es incompatible.
