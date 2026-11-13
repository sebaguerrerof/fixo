# Fixo — Pruebas aisladas de identidad

Procedimiento local preparado en el corte del 8 de noviembre, que entonces quedó **BLOCKED / NOT TESTED**. **Actualización 9 de noviembre:** el propietario autorizó la base Fixo existente y se ejecutaron pruebas reales por otra estrategia. Consultar [informe vigente](SPRINT_01_INTEGRATION_REPORT.md), [plan ejecutado](SUPABASE_EXISTING_DATABASE_EXECUTION_PLAN.md) y [Sprint 02](SPRINT_02_REPORT.md). Este procedimiento de Docker aislado sigue sin ejecutarse y no autoriza reset ni arranque sobre otra instancia.

## Seguridad y entorno

Usar una instancia nueva desechable específica de Fixo, sin datos comerciales y sin SMTP externo. Nunca el proyecto productivo ni una instancia de otro proyecto. El CLI puede limpiar sus volúmenes si falla start: obtener autorización explícita para ese comportamiento antes de usarlo. No ejecutar rm/prune/reset sobre volúmenes existentes. No reiniciar WSL/Docker ni detener procesos ajenos.

Copia preparada, sin arrancar: .audit-backups/sprint01-isolated/supabase. Antes de cualquier ejecución futura copiar nuevamente migraciones/tests/templates/config vigentes: la copia preparada no se actualiza sola. Project ID fixo-sprint01-isolated; cambiar en config solo ID y puertos API 54331, DB 54332, shadow 54330, Mailpit 54334, Studio 54333, pooler 54339. Preservar private fuera de api.schemas. Revisar directorio, puertos libres, imágenes y volúmenes antes de aprobar.

CLI examinado: 3.0.0; v2.122.1 se instaló aislado para diagnóstico y se consultó help, **no se ejecutó start de v2** por rechazo automático y posterior decisión del propietario. No degradar CLI del workflow por suposición. Revisar help/comandos y el error DNS/healthcheck antes de elegir versión.

## Secuencia futura con nueva autorización

1. Confirmar instancia nueva/vacía y ausencia de destinos remotos; revisar autorización para los recursos que el CLI puede crear/limpiar.
2. Arrancar solamente la copia dedicada. No enlazar proyecto remoto ni pasar --remote. Capturar diagnóstico saneado; resolver DNS/reachability sin un bucle de reintentos.
3. Comprobar migration list local y las tres versiones: 202608170001 (baseline histórico de doce dígitos), 20261108223021 y 20261108234902. No renombrar ni registrar la primera sin verificar su reconocimiento. No repetir baseline en producción.
4. Ejecutar pgTAP: 00_access_hardening.test.sql (27 aserciones) y 01_identity.test.sql (53). Los fixtures usan transacción/rollback, cuentas sintéticas, sesiones y JWT claims de cada actor; no usar service role para simular RLS.
5. Ejecutar lint/advisors de DB en local, revisando --help de la versión. Corregir errores de cuerpo SQL, permisos y ejecución; un parser offline no los acredita.
6. Obtener claves exclusivamente de esa instancia local y contraseña local de Postgres por un canal privado. No pegar la salida completa de status en informes.
7. Establecer en el proceso del runner los nombres siguientes, sin escribir valores al repositorio:
   - FIXO_TEST_ALLOW_WRITES=isolated-local
   - FIXO_TEST_SUPABASE_URL=http://127.0.0.1:54331
   - FIXO_TEST_ANON_KEY
   - FIXO_TEST_SERVICE_ROLE_KEY
   - FIXO_TEST_DATABASE_PASSWORD
   - FIXO_TEST_WAIT_FOR_EXPIRY=true para la espera real de expiración.
8. Ejecutar npm run test:integration con Node 24.22.2. El script exige consentimiento, URL exacta, DB loopback 54332, migraciones esperadas y cero usuarios antes de crear fixtures. No carga .env.local. No imprime tokens, credenciales, enlaces ni registros personales. **No ejecutar ahora.**
9. Los fixtures del runner se conservan en la instancia desechable: no hay borrado automático. Una repetición requiere una nueva base vacía autorizada; no eliminar volúmenes existentes para hacerlo pasar.

El runner prepara 24 escenarios, uno de ellos opt-in por la espera de URL firmada. Usa Admin API y SQL propietario solo para bootstrap sintético de roles/datos; las consultas RLS, documentos, cambios administrativos y concurrencia usan los JWT anon-key de los actores. Prueba Auth, Mailpit, REST/RPC y Storage reales. Su sintaxis JavaScript fue comprobada; su funcionamiento permanece NOT TESTED.

## E2E de aplicación y navegador, gate independiente

El runner SDK no acredita las server actions, cookies del navegador ni el recorrido visual. Después de las pruebas anteriores, iniciar Next.js contra **esa misma instancia**, con NEXT_PUBLIC_DEMO_MODE=false, FIXO_APP_URL exacto y una service role **local**. Usar HTTPS local para cookies Secure en build productivo. Invitaciones solo con opt-in local y Mailpit; no copiar secretos de producción.

Recorridos obligatorios a automatizar en browser cuando el entorno funcione:

- Registro customer inválido/válido, consentimiento, respuesta equivalente para duplicado, correo capturado, callback en segundo contexto, login y edición de perfil.
- Registro technician mínimo, pendiente fuera del directorio, edición profesional permitida; campos de revisión/rol/estado enviados por red rechazados.
- Recovery existente/inexistente, token inválido/expirado/repetido, prueba HttpOnly, contraseña distinta/reutilización, nuevo login y revocación de sesiones anteriores.
- Moderator lista/busca/filtra/pagina, ve detalle e historial operativo, invita customer/technician, suspende/reactiva; llamadas directas para modificar administradores denegadas.
- Superadmin asigna privilegios, revisa auditoría completa y administra otra cuenta; dos suspensiones/degradaciones simultáneas conservan al menos uno activo.
- Invitación duplicada, timeout/resultado incierto, reenvío explícito con cooldown, expiración/revocación y aceptación con contraseña/contacto/términos; técnico nunca publicado automáticamente.
- Mantener una sesión abierta, suspender/bloquear desde otra y probar página/action/RPC/Storage con el JWT previo. Verificar logout sin confiar en UI.
- Mobile 360 px/desktop, teclado, foco, labels, errores, pending, tabla con scroll, contrastes y ausencia de errores internos.

Browser E2E y QA visual formal **NOT TESTED**. El smoke productivo solo verifica respuestas HTTP sin sesiones reales ni escrituras Auth.

## Baseline y release

No registrar historial remoto ni aplicar SQL hasta pasar este gate, revisar drift completo/backup/restore y obtener autorización independiente. Seguir SUPABASE_BASELINE_RUNBOOK.md y CI_VERCEL_RELEASE_PLAN.md. No ejecutar push, activar Actions, conectar Vercel ni publicar para salvar este bloqueo sin aprobación exacta.
