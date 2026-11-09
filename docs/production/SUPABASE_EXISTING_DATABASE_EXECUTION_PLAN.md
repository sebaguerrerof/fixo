# Fixo — ejecución sobre la base existente

9 de noviembre de 2026. **Aprobación específica recibida y ejecución completada.** Ver migration-execution.json y los informes de integración/Sprint 02 para resultados y correcciones aditivas posteriores.

Destino único: **Fixo / rjzyqdhotcshvbdcrgon**, organización fixo / jmbhjccxstrsgywyxdeq, conexión Fixo. El propietario autorizó usar esta base para integración, dado que no tiene datos comerciales reales.

## Preflight

Dos usuarios/perfiles superadmin, ocho categorías y cero técnicos, solicitudes, documentos, auditoría y objetos Storage. Nueve tablas RLS, 66 columnas, 48 constraints, 16 índices y cuatro triggers. Tabla de historial ausente. Auth público y Admin Auth respondieron 200 por GET, sin imprimir credenciales.

## Alcance de aprobación

1. Registrar en historial **202608170001 / initial_marketplace** como baseline ya existente. **No ejecutar el SQL inicial otra vez**. SHA256 del archivo: 7e1d0ad1bf76844974e39b73ad5f8248eaa18a59949b78c8a719c5bf53904d7a.
2. Aplicar **20261108223021_harden_marketplace_access.sql**: helpers, privilegios, RLS y límites Storage; sin borrar filas ni reasignar roles.
3. Aplicar **20261108234902_identity_and_account_administration.sql**: estado global, datos privados, auditoría, invitaciones y RPC. El contrato de registro nuevo exige nombres, teléfono y consentimiento.
4. Conservar las versiones originales en historial. Si el complemento asigna timestamps propios, normalizar solo los registros recién creados, cotejados por nombre/SQL/hash; no tocar entradas ajenas.
5. Ejecutar 27 + 53 pgTAP con rollback y pruebas con actores sintéticos identificados/JWT propios; nunca usar ni modificar el acceso de las dos cuentas previas.

## Límites

Sin reset, repetición del CREATE inicial, borrado de cuentas/datos existentes, DNS, upgrade, push o deploy. Sin SMTP comercial ni mensajes a terceros. Enlaces Auth generados sin envío para OTP; entrega/captura de correo sigue pendiente de mecanismo seguro.

El frontend Vercel antiguo no envía el contrato nuevo de registro. No abrir registros comerciales/publicidad sin probar la combinación de esquema/app y aprobar release por separado.

Se conserva captura de funciones, constraints, índices, grants y digest de identidades/roles anteriores. Las correcciones son transaccionales y restrictivas. No se borran tablas ni se restaura seguridad anterior automáticamente para forzar una prueba.

## Rechazo

La revisión automática inicialmente rechazó apply_migration initial_marketplace porque registra historial y requería aprobación específica. La consulta verificaba catálogo, sin ejecutar el SQL inicial. No se eludió: se solicitó la aprobación exacta, el propietario respondió “Sí, autorizo expresamente esas operaciones” y el mismo mecanismo se ejecutó después. El rechazo quedó resuelto; no representa un bloqueo actual. Baseline, hardening e identidad quedaron en sus versiones canónicas y las dos identidades originales se conservaron. Las correcciones detectadas por pruebas reales se agregaron como migraciones posteriores; no se reescribieron los tres archivos iniciales.
