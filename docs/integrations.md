# Puntos de integración

La aplicación no importa SDKs externos desde componentes. Cada integración se incorpora detrás de su contrato y usa proveedores reales configurados por entorno.

## Demo Mode

`src/config/demo-mode.ts` decide en tiempo de ejecución si `src/repositories/repository-factory.ts` entrega repositorios `Mock*` (fixtures en `src/repositories/mock/`) o `Supabase*`. Se activa con `NEXT_PUBLIC_DEMO_MODE=true`, o automáticamente cuando faltan credenciales de Supabase. La autenticación demo (`MockAuthProvider`) usa una cookie no sensible (`fixo_demo_session`) en vez de Supabase Auth. La UI nunca cambia entre ambos modos.

## Supabase

1. El cliente server/browser vive en `src/integrations/supabase/`.
2. Los contratos de `src/repositories/contracts/` se implementan en `src/repositories/supabase/`.
3. Las migraciones y políticas RLS por entidad se mantienen en `supabase/migrations/`.
4. Las credenciales públicas se configuran en cada entorno y la service role permanece sólo en el servidor.

Nunca se debe importar el cliente Supabase desde la UI ni exponer una service role key.

## Autenticación

`AuthProvider` define el contrato y `SupabaseAuthProvider` implementa Supabase Auth. Los perfiles y roles se resuelven desde `profiles` y se validan también en el servidor para las rutas protegidas.

## IA, pagos, ubicación y notificaciones

Los contratos en `src/integrations/` mantienen cada proveedor desacoplado. Un adapter real debe validar sus entradas/salidas, mantener los secretos exclusivamente en el servidor y no mezclar los estados de pago con los estados de trabajo.

## Realtime

Cuando se implemente chat, el repositorio de conversaciones será la fuente de verdad y Supabase Realtime será solo el mecanismo de sincronización. Las validaciones de membresía y ownership se mantienen server-side y en RLS.
