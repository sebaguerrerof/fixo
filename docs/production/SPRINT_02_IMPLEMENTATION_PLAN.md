# Fixo — Sprint 02: técnicos y validación profesional

Fecha: 8 de noviembre de 2026. **Plan preparado; no iniciado.** Base de código local: Sprint 01. Su aceptación funcional permanece BLOCKED por las pruebas aisladas.

## Entrada

Se puede preparar trabajo local de Sprint 02, preservando Next.js 15/React 19/Supabase/design system. Para probar y aceptar integración: cerrar U01/U11 de Sprint 01, ejecutar 27 + 53 aserciones pgTAP y los escenarios Auth/RLS/Storage, validar correo/cookies y revisar baseline/hardening/identidad. No incorporar técnicos reales ni documentos de personas para sustituir fixtures.

## Tareas y aceptación

| ID | Tarea | Criterios de aceptación | Dependencias |
| --- | --- | --- | --- |
| T01 | Criterios de revisión por rubro | Definir identidad, contacto, credenciales obligatorias por categoría y decisión justificable; no mostrar “certificado” por el solo registro. | Responsable operativo; Auth/RBAC aceptados. |
| T02 | Postulación completa | Ampliar el perfil existente sin otra entidad de técnico; cobertura/rubros/experiencia/precio declarados, borrador y envío a revisión, límites y validación servidor/DB. | U07; T01. |
| T03 | Documentos privados | Carga con propietario/rol/estado, MIME/tamaño reales, path generado en servidor, metadatos transaccionales, sin service role para acreditar aislamiento. | RLS y Storage de Sprint 01 probados. |
| T04 | Inspección de archivos | Verificar contenido binario, extensión/MIME, cuarentena/antimalware y resultado auditable; no servir archivos no revisados en un contexto ejecutable. | T03; proveedor de análisis aprobado si es externo. |
| T05 | Revisión administrativa | Cola real, lectura firmada 60 s, aprobar/rechazar/pedir información con motivo, actor y eventos. Moderator operativo; privilegios de cuenta solo superadmin. | T01–T04; matriz RBAC vigente. |
| T06 | Publicación y revisión de cambios | Directorio solo con cuenta activa, rol technician y aprobación profesional suficiente. Cambios sensibles de identidad/rubros/documentos requieren revisión; evitar que ediciones de cuenta mantengan una verificación desactualizada. | T05; política operativa. |
| T07 | Suspensión profesional | Separar suspensión de cuenta y profesional. Bloquear nuevas operaciones/comercio y retirar directorio usando estado actual; definir efecto sobre trabajos en curso sin inventar un módulo de jobs. | U02/U06; modelo comercial de próximos sprints. |
| T08 | Incorporación por invitación | Completar comuna/rubro/documentos después de aceptar; ninguna invitación concede aprobación profesional; evitar duplicar perfiles con reintentos. | U09 aceptado; T02–T05. |
| T09 | Pruebas reales | Dos técnicos/dos clientes/admins con JWT propios, documentos cruzados, MIME/size/TTL/expiración, revisión concurrente, estados inválidos y suspensión con sesión previa. Browser E2E responsive/teclado. | T01–T08; instancia aislada. |
| T10 | Entrega y release | Informe con evidencias PASS/FAIL/BLOCKED/NOT TESTED, migraciones/rollback y preview por SHA solo después de autorización. | T09; gates de Git/Vercel/baseline. |

## Fuera del sprint

Chat, IA, Flow, cobros reales, liquidaciones, suscripciones, geolocalización avanzada, calendarios avanzados y nuevas urgencias. Solicitudes/cotizaciones/jobs completos siguen en sus sprints comerciales.

## Salida

Demostrar técnico invitado o registrado → identidad confirmada → postulación completa → documento privado revisado → aprobación auditable → directorio visible → suspensión lo retira y bloquea operaciones. Cero accesos cruzados con JWT de actor, sin datos ficticios ni tokens en cliente. No declarar listo para producción sin las pruebas reales de Sprint 01 y aprobación de publicación.
