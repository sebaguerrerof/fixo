# Fixo — integración real de Sprint 01

9 de noviembre de 2026. Proyecto único: **Fixo / rjzyqdhotcshvbdcrgon**, organización fixo, ca-central-1, PostgreSQL 17.11. El propietario autorizó usar esta base existente para desarrollo e integración y después aprobó expresamente baseline, hardening, identidad y pruebas sintéticas. No es un staging separado.

## Resultado comprobado

**PASS integración SQL y APIs de identidad**. Las 27 + 53 aserciones heredadas se ejecutaron realmente con rollback, antes de Sprint 02, y volvieron a pasar después de corregir la vinculación de invitaciones. Siete aserciones nuevas cubren esa regresión. `native-integration.json` contiene 21 escenarios reales aprobados con Auth, REST/RPC y Storage; cada actor usa su JWT público para acreditar autorización. La service role se limita a bootstrap, generación de OTP sin envío, bookkeeping e inspección.

Se conservaron las dos cuentas iniciales. La limpieza final confirma dos usuarios/perfiles, ambos superadmin activos, digest de UUID/rol `6c2936a71f2dff1144d2c7926e16f6f8` sin cambios y cero fixtures/objetos Storage. Ver `sprint-02-evidence/final-state.json`. La suite final ampliada suma 105 pgTAP PASS y el navegador ocho recorridos PASS; no sustituyen los casos específicos de correo/callback que siguen pendientes.

## Matriz U01–U11

| Caso | Integración real | Alcance y pendientes |
| --- | --- | --- |
| U01 Entorno | PASS | Base existente autorizada. Crear fixo-staging falló por cuota global de dos proyectos Free; no se creó ningún recurso. Docker no fue requisito ni se arrancaron stacks. |
| U02 Estado global | PASS | Backfill real, estado actual en DB, suspensión/reactivación y auditoría con JWT anterior. |
| U03 Registro | PASS parcial | Auth Admin/GenerateLink y trigger reales; customer/technician, perfiles, rol inicial, consentimiento inválido rechazado, metadata privilegiada ignorada. Registro público y envío de confirmación con captura aislada: BLOCKED por falta de capturador/SMTP de prueba configurado. |
| U04 Confirmación | PASS parcial | OTP nativo en otro cliente y rechazo del reuso. Callback de aplicación/PKCE completo: pendiente del recorrido específico de navegador y configuración Auth; no atribuirle el PASS del SDK. |
| U05 Recuperación | PASS parcial | Recovery nativo sin correo, cambio de contraseña, rechazo de reuso y prueba propia ligada a sesión con consumo concurrente único. Entrega SMTP y expiración temporal del OTP de Auth: NOT TESTED. |
| U06 Sesiones | PASS | Login, refresh real, logout global, JWT previo rechazado tras suspensión/revocación, REST/RPC/Storage. |
| U07 Perfil | PASS | Campos permitidos persistidos, teléfono privado por RPC, lectura cruzada y escritura directa de privilegios rechazadas. |
| U08 RBAC | PASS | Dos clientes/dos técnicos/moderator/dos superadmins sintéticos; filtros, RPC directas, restricciones de moderator y aislamiento Storage con JWT propios. |
| U09 Invitaciones | PASS parcial | Reserva, duplicado, cooldown, aceptación nativa OTP sin envío y técnico pendiente; expiración/revocación probadas con pgTAP. Envío/captura y reenvío de correo real: BLOCKED. |
| U10 Administración | PASS parcial | Auditoría, roles y estados, self-change prohibido y dos suspensiones simultáneas serializadas. Caso global de un único superadmin: NOT TESTED en esta base; no se suspendieron las dos cuentas previas para fabricarlo. |
| U11 Integración/abuso | PASS parcial | SQL real + 21 escenarios API, MIME/tamaño HTTP, aislamiento y expiración del token en origen. QA de navegador se informa en `browser-integration.json`; correo aislado continúa pendiente. |

## Fallos encontrados y correcciones

1. **Invitación antes de invited_at.** Auth inserta primero la identidad y después completa `invited_at`. El trigger anterior podía exigir datos de registro a una invitación válida o dejar una reserva sin vincular. La migración `20261109141115_close_invitation_binding_window.sql` reconoce la reserva privada desde el INSERT y deniega acceso también por email reservado cuando aún no está vinculada. Prueba: FAIL antes / siete PASS después. No se usan claims de metadata para conceder permisos.
2. **Caché de URLs firmadas.** Una URL descargada seguía devolviendo 200 después de expirar su token. Se conservó la evidencia FAIL. El token expirado se rechaza en origen con `cacheNonce`; no se cambió el resultado observado de la caché a PASS. La entrega sensible ahora usa una ruta autenticada que reautoriza y envía `private, no-store`, sin exponer bearer URLs. [Comportamiento oficial de Storage/CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn).
3. El ejecutor nuevo se ajustó al nombre real `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y a stdin interactivo. Esos fallos fueron del harness, no de Auth; sus fixtures quedaron identificados para limpieza.

## Límites de aceptación

No se modificó configuración Auth/SMTP, no se llamaron endpoints de envío de correo, no hubo reset, deploy, push, DNS ni upgrades. `generateLink` genera enlaces/OTP para un proveedor propio y no demuestra entrega de email. [Referencia oficial](https://supabase.com/docs/reference/javascript/auth-admin-generatelink).

Sprint 01 tiene evidencia real de persistencia y autorización. Su aceptación completa de correo/callback y el caso singleton de superadmin siguen abiertos; no se declara listo para registros comerciales por el solo PASS del SDK.
