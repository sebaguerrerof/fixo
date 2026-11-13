# Restricción aditiva de rubro revisado

Destino Fixo `rjzyqdhotcshvbdcrgon`. Migración `20261109194648_require_category_scoped_professional_approval.sql`: **aprobación específica recibida y ejecución completada** el 9-11-2026.

La postulación revisa los requisitos y documentos del rubro principal. La primera versión del matching también admitía rubros secundarios declarados. Esta migración exige que la categoría solicitada coincida con `technician_applications.primary_category`. Los rubros secundarios podrán contratarse cuando exista revisión específica por rubro en un sprint posterior. Se conservan las verificaciones de cuenta, postulación, requisitos, documentos, cobertura y estado comercial.

Diff completo: únicamente reemplaza `private.marketplace_eligible(uuid,uuid)` y conserva sus grants restringidos. Sin tablas nuevas, cambios de datos, cuentas, SMTP ni publicación. Las adjudicaciones existentes conservan su snapshot. La elegibilidad se vuelve más restrictiva para oportunidades y propuestas nuevas.

Backup: definición anterior canónica en la migración `20261109185924`, catálogo previo privado y digest de las cuentas originales. No hay backup completo restaurable confirmado. Transacción con timeout; error antes del commit revierte. Después, detener apertura comercial y preparar reparación revisada; no restaurar automáticamente la función permisiva ni borrar adjudicaciones.

Prueba local: 19 escenarios PASS en PostgreSQL 17.11, incluida declaración de rubro secundario con perfil principal aprobado, denegación de su detalle y cotización. Plan remoto: aplicar solo esta migración tras autorización, reconciliar timestamp cotejando SQL, repetir ese caso con JWT sintético y confirmar que el rubro principal sigue habilitado. Mantener las dos cuentas originales y limpiar solo fixtures del manifiesto de esta ejecución.

Resultado remoto PASS: tres regresiones con JWT propios; timestamp del conector 20261109194957 reconciliado a 20261109194648 mediante nombre y SQL verificados. No se editaron datos ni snapshots por esta migración. Limpieza y digest original confirmados en `sprint-03-evidence/final-state.json`.
