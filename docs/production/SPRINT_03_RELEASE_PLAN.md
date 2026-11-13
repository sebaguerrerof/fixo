# Release Sprint 03 — preparado, sin publicar

Estado: cambios locales verificados; ocho migraciones ya aplicadas en Fixo con aprobaciones específicas. El frontend Vercel anterior sigue desplegado. No hacer push, conectar Git/Vercel, modificar Auth/DNS ni desplegar como consecuencia de este documento.

## Entornos y variables

| Variable | Aplicación | Regla |
| --- | --- | --- |
| NEXT_PUBLIC_DEMO_MODE | Next.js | false en entornos compartidos; sin fallback demo |
| NEXT_PUBLIC_SUPABASE_URL | Next.js público | Proyecto correspondiente al entorno |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Next.js público | Clave pública del mismo proyecto |
| SUPABASE_SERVICE_ROLE_KEY | Solo servidor Next.js | Auth/rate limits/pruebas de flujo y carga de fotos ya validadas; nunca navegador ni preview conectado a producción |
| FIXO_APP_URL | Servidor | Origen exacto aprobado por entorno, sin deducirlo de Host; coordinar redirect actual soyfixo.cl → www |
| FIXO_INVITATIONS_ENABLED | Servidor | false hasta completar proveedor/entrega autorizada |
| FIXO_INSPECTION_* y credenciales worker | Host del inspector | Servicio separado; no incluir ClamAV/firmas en Vercel |

SMTP se configura en Supabase Auth con el proveedor aprobado, no mediante variables SMTP inventadas en Next.js. El proyecto Vercel actual solo devolvió las dos variables públicas para production; faltan las demás configuraciones de servidor del nuevo frontend. Nunca volcar sus valores al repositorio.

## Secuencia propuesta

1. Revisar commit/SQL/evidencia y confirmar configuración operativa, backup/restore y dominio canónico. El backend actual rechaza INSERT directo de solicitudes: no considerar al frontend anterior compatible con creación.
2. Aprobar explícitamente push de la rama local y apertura/revisión del cambio. CI existente: npm ci, secretos, lint, TypeScript, Vitest, build/smoke/audits y Supabase efímero aislado con pgTAP. No usar credenciales de Fixo en GitHub Actions.
3. Resolver staging separado. El límite de dos proyectos Free del propietario impidió el staging previo; no pausar proyectos ajenos ni subir plan automáticamente. Cotización contractual pendiente. La tarifa pública permite calcular una base de USD 35/mes para dos Micro en una misma organización Pro, antes de excesos/impuestos, sin que esto constituya aprobación de gasto.
4. Aprobar integración Git/Vercel y preview protegido con **claves exclusivas de staging**, base sin datos comerciales y usuarios sintéticos. Probar URLs Auth exactas, SMTP de captura/entrega autorizada, roles, aprobación, inspector, fotos, cotización, concurrencia y limpieza.
5. Si no hay staging, CI y preview estático pueden usar configuración build-only inválida, sin service role ni acceso a Fixo. Sirve para revisión visual pública; no acredita flujos funcionales ni sustituye staging. Protección de deployment no constituye aislamiento de base de datos.
6. Autorizar producción tras validar build con las claves/origen de production, proveedor autenticado, requisitos y profesionales reales, inspector permanente y condiciones comerciales. No promover un build con NEXT_PUBLIC de staging a producción.
7. Publicar en ventana acordada, comprobar health, login/callback, permisos y un recorrido sintético autorizado; vigilar cola, errores y entregas. Mantener invitaciones deshabilitadas hasta su gate específico.

## Rollback y compatibilidad

Preferir reparación hacia adelante y detener apertura comercial ante fallos. Conservar snapshots, historial y recibos. Un rollback de frontend debe conservar el contrato RPC de solicitudes: volver a una versión que use INSERT directo no restaura esa función. No revocar controles, hacer DROP/reset ni restaurar datos de la base compartida automáticamente. Toda migración correctiva remota nueva necesita diff, impacto y aprobación específica.

No habilitar trabajos en ejecución o pagados: este sprint crea una adjudicación con pago no habilitado. Sprint 04 y un modelo Flow/piloto aprobado deben resolver esa transición.

Referencias: [entornos Vercel](https://vercel.com/docs/deployments/environments), [variables](https://vercel.com/docs/environment-variables), [deployment protection](https://vercel.com/docs/deployment-protection), [facturación Supabase](https://supabase.com/docs/guides/platform/your-monthly-invoice).
