# Puntos de integración

La aplicación no importa SDKs externos desde componentes. Cada integración se incorpora detrás de su contrato y puede usar los datos locales de ejemplo mientras se construyen los proveedores reales.

## Supabase

1. Añadir el cliente server/browser en `src/integrations/supabase/`.
2. Implementar los contratos de `src/repositories/contracts/` en `src/repositories/supabase/`.
3. Reemplazar las ramas de ejemplo de `src/repositories/repository-factory.ts` cuando `NEXT_PUBLIC_USE_SAMPLE_DATA=false`.
4. Crear migraciones y políticas RLS por entidad antes de habilitar escritura real.

Nunca se debe importar el cliente Supabase desde la UI ni exponer una service role key.

## Autenticación

`AuthProvider` define el contrato y `SampleAuthProvider` habilita los tres roles para desarrollo visual. La siguiente integración debe implementar Supabase Auth detrás del mismo contrato, guardar la sesión de forma segura y reemplazar los datos locales por perfiles autorizados server-side.

## IA, pagos, ubicación y notificaciones

Los contratos en `src/integrations/` mantienen cada proveedor desacoplado. Un adapter real debe validar sus entradas/salidas, mantener los secretos exclusivamente en el servidor y no mezclar los estados de pago con los estados de trabajo.

## Realtime

Cuando se implemente chat, el repositorio de conversaciones será la fuente de verdad y Supabase Realtime será solo el mecanismo de sincronización. Las validaciones de membresía y ownership se mantienen server-side y en RLS.
