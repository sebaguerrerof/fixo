# Sprint 02.5/03: ejecución remota pendiente de autorización

Destino único: Fixo `rjzyqdhotcshvbdcrgon`, organización fixo. No staging creado. **Autorización específica recibida y ejecución completada el 9-11-2026.** La autorización histórica no se reutilizó para esta migración.

## Cambio revisable

Archivo completo: `supabase/migrations/20261109185924_inspection_queue_and_marketplace_transactions.sql`. No se modifican las seis migraciones históricas ni se reproduce el baseline. El diff y este plan están disponibles localmente para revisión antes de aplicar.

- Añade revisión a `service_requests`, índice de oportunidades, datos de dirección privados, recibos de idempotencia e historial privado.
- Crea `quotes` con desglose entero CLP y versiones, y `jobs` con una adjudicación por solicitud/cotización, snapshot inmutable, estado `awarded` y pago `not_enabled`.
- RPC con sesión viva, rol actual, RLS, requisitos profesionales vigentes, categoría y comuna. Bloqueo transaccional de solicitud/cotización y conflictos PT409. Sin UPDATE genérico.
- Retira INSERT directo de solicitudes a authenticated. **El frontend antiguo que intente INSERT dejará de crear solicitudes**; el frontend nuevo usa la RPC. Requiere release coordinado posterior, que no se ejecutará con esta aprobación.
- Bucket privado `service-request-photos`, cinco JPEG por solicitud, máximo 4 MiB por archivo; carga solo desde servidor con recodificación y lectura por propietario/administrador/adjudicado habilitado. Tabla de metadatos privada.
- Cola privada de inspección con leases de cinco minutos, SKIP LOCKED, fencing, cinco intentos máximos, backoff y cuarentena. Solo service role ejecuta claim/finish. Conserva contrato previo de inspección.
- No cambia roles/cuentas originales, Auth SMTP, DNS, facturación, pagos, ni publicación de GitHub/Vercel. No precarga requisitos normativos.

## Backup y precondiciones

1. Lectura de identidad, seis versiones remotas y catalogación de tablas/RPC/políticas/bucket. Conservar copia local privada de este resultado y SQL canónico del repositorio, con hash de migración.
2. Verificar las dos cuentas originales por UUID/rol mediante digest `6c2936a71f2dff1144d2c7926e16f6f8`; no copiar correos ni secretos al informe.
3. Exigir cero solicitudes, técnicos, documentos, postulaciones, objetos y fixtures comerciales antes de aplicar. Si aparecen datos nuevos o diverge el historial, detener y revisar alcance.
4. La copia de catálogo y la comprobación de tablas vacías **no sustituyen un backup restaurable de Auth/Postgres**. No hay PITR contratado ni copia completa restaurable confirmada. Riesgo residual explícito: cambio de grants y DDL sobre la única base. Las cuentas originales no se escriben y no hay reset ni borrado para mitigar este riesgo.

## Orden de ejecución autorizado

1. Repetir únicamente precondiciones de lectura; guardar evidencias privadas.
2. Aplicar **solo** `20261109185924_inspection_queue_and_marketplace_transactions.sql` por el complemento Fixo y reconciliar su versión canónica si el conector asigna otra marca de tiempo, sin repetir SQL.
3. Validar catálogo, grants, funciones, bucket privado, advisors y digest original.
4. Crear identidades sintéticas `@example.invalid` con etiqueta de ejecución y manifiesto privado de UUID exactos. Auth administrativo solo para bootstrap sin enviar correo; cada actor usa su JWT en REST/RPC/Storage/navegador. Service role no acredita RLS.
5. Probar creación/idempotencia, cliente A/B, elegibilidad/inhabilitación con JWT antiguo, borrador/envío/retiro, selección concurrente, snapshot único, historial, foto privada y cola/antivirus. Identidad/aprobación: regresiones específicas, sin repetir auditoría histórica completa.
6. Limpiar solo los UUID/paths del manifiesto cuya etiqueta e identidad coincidan. Conservar cuentas originales, requisitos previos y cualquier dato ajeno. Probar cero residuos y digest original.
7. Registrar PASS integración solo para pruebas realmente ejecutadas. Preparar commit local. Sin push/deploy.

## Rollback

La migración usa BEGIN/COMMIT, lock_timeout 5s y statement_timeout 30s: error antes del commit revierte el cambio completo. No reintentar a ciegas; consultar historial/catálogo.

Después del commit, preferir reparación hacia adelante. Detener el worker y no publicar el frontend nuevo si hay fallo de verificación. No ejecutar DROP, reset, TRUNCATE, ni restauración destructiva automáticamente. Un rollback de esquema requiere nueva revisión/aprobación, comprobar que no hay datos nuevos, preservar snapshots/historial y revertir dependencias en orden. El frontend previo puede seguir leyendo tablas previas; restaurar INSERT directo también requiere cambio revisado porque reabre el contrato antiguo.

## Evidencia aislada

`scripts/test-marketplace-postgres.mjs` ejecutó la cadena de siete migraciones en PostgreSQL **17.11 real**, clúster nuevo y persistente bajo `.audit-backups/sprint03-postgres`, loopback, sin Docker/servicios/usuarios del sistema. **18 escenarios PASS local**: aislamiento de roles SQL, revocación de DML, matching, suspensión, dos aceptaciones concurrentes con un solo job y PT409, snapshot, idempotencia, fotos privadas, supervisión y cola con fencing/reintentos. Auth/Storage son fixtures de contrato en esta prueba: **no es integración Supabase ni verificación criptográfica JWT**. Las ampliaciones de cobertura se registrarán en el informe final.

## Resultado

SQL aplicado una vez; versión asignada por conector 20261109192127 reconciliada a 20261109185924 tras verificar nombre y MD5 del SQL normalizado. La restricción adicional de categoría se presentó y autorizó por separado. Pruebas y limpieza completas en `SPRINT_03_REPORT.md`; las dos cuentas originales y su digest se conservaron. Sin push/deploy ni configuración SMTP/DNS. No se ejecutó rollback destructivo.
