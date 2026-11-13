# Fixo — propuesta de staging aislado

Fecha: 9 de noviembre de 2026. **AUTORIZADO; creación FALLÓ por cuota Free global.** El propietario confirmó organización y autorizó crear/probar fixo-staging a USD 0/mes. El proveedor rechazó la creación porque un propietario/administrador alcanzó el máximo global de dos proyectos Free activos. Se verificó después que el proyecto no se creó. No se pausan proyectos ni se activa un upgrade automáticamente.

## Recurso concreto

- Nombre: **fixo-staging**.
- Organización: **fixo**, ID `jmbhjccxstrsgywyxdeq`, conexión Supabase Fixo.
- Región propuesta: **ca-central-1**, misma región que producción para compatibilidad.
- Plan actual: **Free**. get_cost devolvió type=project, recurrence=monthly, amount=0.
- Cotización actual: **USD 0/mes**, sin upgrade, compute pagado, branch pagada, add-ons ni servicios de correo externos. Si el servidor cambia la cotización o exige pago/upgrade, detenerse antes de crear.
- Ref se asignará al crear: deberá verificarse distinto de `rjzyqdhotcshvbdcrgon`. No se reutiliza ni modifica producción.

La [tarifa pública Free](https://supabase.com/pricing) indica límite de dos proyectos activos, 500 MB de DB, 1 GB de archivos y pausa tras una semana de inactividad. La cuenta conectada muestra un proyecto; la creación sigue sujeta a la cuota real del proveedor. No se habilita facturación adicional por un error de cuota.

## Alcance solicitado para autorización

Crear únicamente ese proyecto y utilizarlo para las tres migraciones revisadas y datos sintéticos identificados; ejecutar 27 + 53 pgTAP y escenarios de Auth/RLS/RPC/Storage con JWT propios. Sin copia de información personal productiva, DNS, casillas comerciales, mensajes a terceros, push, deploy o cambios productivos.

Después de crear, comprobar salud/versión/ref y base vacía. Antes de registro/invitaciones, preparar una captura aislada de correo que impida envíos externos. El complemento no expone configuración Auth/SMTP ni claves secretas del servidor: si hacen falta ajustes de dashboard o un canal seguro de credenciales de staging, se concretarán antes de probar esos flujos. No se usará el SMTP productivo por conveniencia.

El runner heredado está limitado a loopback/Mailpit; se adaptará de forma explícita al ref de staging autorizado, con bloqueo duro del ref productivo, identidad del proyecto y prefijo/run_id sintético. No se quitarán barreras para aceptar cualquier URL.

## Riesgos y límites

Nuevo recurso externo y consumo de una plaza Free; las pausas/cuotas pueden interrumpir pruebas. Un proyecto separado reduce el riesgo para producción, pero no valida automáticamente RLS/Auth. La captura contiene secretos temporales de prueba y será privada, con acceso restringido, sin tokens en informes. El manejo de archivos requerirá cuarentena e inspección real; no se afirmará antimalware sin un mecanismo operativo.

No habrá limpieza global ni borrado de proyectos/volúmenes. Solo se eliminarán fixtures identificados si esa limpieza está autorizada y verificada; el estado de las pruebas se documentará antes de cualquier limpieza.

## Secuencia tras aprobación

1. Crear fixo-staging en la organización/región anteriores y verificar su ref.
2. Inspeccionar tabla/esquema/historial vacíos y capacidades Auth/Storage, sin datos de producción.
3. Aplicar baseline en staging limpio, hardening e identidad; registrar nombres/hashes/versiones reales. No reparar el historial de producción.
4. Ejecutar pgTAP y corregir fallos preservando seguridad; advisors y pruebas de JWT reales.
5. Configurar captura de correo aislada antes de altas/invitaciones; probar recorrido de Sprint 01 y publicar matriz U01–U11 real.
6. Solo con ese gate avanzar al módulo profesional y pruebas de Sprint 02.
7. Preparar release por SHA con aprobación separada de GitHub/Vercel/producción.

La aprobación de esta propuesta no autoriza upgrade, costos no cotizados, migraciones productivas ni publicación.
