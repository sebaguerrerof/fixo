# Fixo — Sprint 02: postulaciones profesionales

9 de noviembre de 2026. Rama `codex/supabase-integration-sprint-02`. Entorno real: Fixo existente `rjzyqdhotcshvbdcrgon`, expresamente autorizado para integración; no se creó staging separado, no hay deploy ni push.

## Implementación y pruebas

**PASS: 14 escenarios nativos reales**, registrados en `sprint-02-evidence/professional-integration.json`. Cinco actores sintéticos, JWT propios, tablas/RPC, Storage HTTP y análisis ClamAV de bytes descargados del bucket. La evidencia de navegador y los controles finales se actualizan al completar su ejecución.

| Módulo | Estado comprobado |
| --- | --- |
| Postulación | PASS API: borrador persistente, edición, rubro principal, especialidades, cobertura, experiencia, precio, disponibilidad, portafolio y envío con consentimiento. |
| Requisitos | PASS API: superadmin configura criterios internos/opcionales/legales versionados; un requisito legal sin fuente HTTPS se rechaza. Ninguna certificación legal fue precargada. Sin criterios configurados, no se puede enviar/publicar. |
| Archivos | PASS: bucket privado, máximo 10 MiB, MIME HTTP, bytes PDF/PNG/JPEG analizados, cuarentena, metadatos guardados, paths UUID inmutables, reemplazo y acceso cruzado rechazado. |
| Inspección | PASS real: PDF descargado desde Storage, parser y ClamAV 1.5.4 con firmas oficiales; documento disfrazado de PDF rechazado. Scanner ausente, firmas antiguas, timeout o error mantienen la descarga/aprobación bloqueada. No se afirma que un archivo sea limpio por el solo MIME. |
| Revisión | PASS API: moderator/superadmin revisan documentos, piden antecedentes y aprueban/rechazan con motivo, actor y fecha. Decisiones concurrentes sobre la misma revisión producen una sola aprobación. |
| Publicación | PASS API: rol technician, cuenta activa, postulación aprobada, snapshot de requisitos vigente y documentos obligatorios limpios/aprobados. Edición sensible, suspensión o cambio de requisitos retiran visibilidad. |
| Suspensión | PASS API: suspensión profesional separada de cuenta global; retira directorio y bloquea escrituras con la sesión previa. Reapertura administrativa exige nueva revisión. |
| Invitación | La aceptación del Sprint 01 crea el técnico pendiente y el trigger prepara la postulación. El envío de invitaciones sigue deshabilitado hasta correo de captura; no equivale a aprobación. |
| Navegador | PASS: ocho recorridos con build local, cookies Auth reales y server actions; Edge en contextos aislados, escritorio 1440×1000 y móvil 390×844. Incluye estado visible Aprobada, teclado, cero overflow horizontal, descarga no-store y bloqueo con sesión anterior. Resultados en `browser-integration.json`; fallos previos preservados. |

## Migraciones

Baseline `202608170001` registrado como ya aplicado, sin repetir su DDL. Hardening `20261108223021` e identidad `20261108234902` ejecutados con autorización específica. Migraciones aditivas posteriores:

- `20261109141115_close_invitation_binding_window.sql`.
- `20261109141946_professional_applications_and_document_quarantine.sql`.
- `20261109155802_stabilize_professional_review_retries.sql`.

Los timestamps generados por el complemento se reconciliaron únicamente para los registros propios recién creados. No se editaron los tres archivos originales. Los fixes posteriores son migraciones nuevas.

## Errores detectados durante ejecución real

- Carrera de `invited_at`: corregida y cubierta por siete pgTAP.
- Respuestas de Storage en caché después de expirar/reemplazar un archivo: evidencia FAIL preservada; acceso vigente comprobado en origen y ruta de descarga autenticada sin caché.
- `40001` usado como conflicto de versión provocó reintentos de PostgREST 14.18. Se sustituyó por `PT409` para conflicto de negocio, con comprobación explícita de postulación inexistente. No volver a usar SQLSTATE de serialización para errores deterministas. [Supabase: diagnóstico oficial](https://github.com/orgs/supabase/discussions/50151).
- Reintentos idénticos de inspección/revisión y requisitos no borran revisiones válidas ni crean versiones sin cambios.
- Antivirus Windows instalado devolvió `0x80508023`; no se cambió su configuración. Se descargó ClamAV portátil oficial, firma PGP Talos válida, fingerprint `5BADCA2665EF59DCF8A23D8B707F0DB480836771`, zip SHA256 `0d9e0228b2674137ea1a2853566c98a0278ad52ab2582c3d6dbd75373848c395`. Herramientas/firmas quedan ignoradas en `.audit-backups`, sin instalar servicios. [Descarga oficial](https://www.clamav.net/downloads).
- QA de navegador detectó timeout del formulario bajo memoria libre extrema y un nombre accesible ambiguo en selects; se redujo paralelismo, se usó build productivo local y se corrigieron labels.
- La actualización del formulario podía conservar datos anteriores después de guardar. El cliente SSR y middleware fuerzan `cache: no-store`; formularios mantienen pending durante `router.refresh` con transición. El recorrido final confirma requisitos actualizados, documentos y decisión visible.

## Rutas y operación

Técnico: `/tecnico/postulacion`; administración: `/admin/postulaciones`, `/admin/postulaciones/[id]`, `/admin/requisitos`. Reutilizan identidades, perfiles, categorías y bucket existentes. `/api/technician-documents/[id]` comprueba sesión/propiedad o administrador, inspección y vigencia; fuerza origen y entrega attachment con no-store/nosniff/sandbox. No entrega claves privilegiadas al navegador.

`scripts/inspect-professional-document.mjs <uuid>` es un worker de servidor real. Requiere `FIXO_INSPECTION_PROJECT`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `FIXO_CLAMSCAN_PATH`, `FIXO_CLAMAV_DATABASE_DIR`; `FIXO_INSPECTION_LOAD_LOCAL=true` solo opta por leer `.env.local` en desarrollo. ClamAV debe tener firmas mantenidas con FreshClam. La key privilegiada solo vive en el worker/servidor.

**BLOCKED operación continua de inspección en hosting:** no se desplegó ni contrató un worker. Vercel no incluye el binario/firma local. Los archivos nuevos permanecen en cuarentena hasta que un worker autorizado complete la inspección. No confundir ejecución real local con servicio productivo desplegado.

## Calidad y release

Comprobado: npm ci (428 paquetes), 186 unit tests, lint, typecheck, build y smoke HTTP productivo PASS. **105 pgTAP PASS** con rollback en el esquema final (27 + 53 + 7 + 18); ambos npm audit dan cero vulnerabilidades. Secret scan: cero hallazgos; 77 archivos del bundle estático comprobados contra las dos variables privadas locales, sin coincidencias. El workflow valida con actionlint; GitHub Actions aún NOT TESTED porque no hubo push. QA browser final se conserva en su JSON y capturas.

**Limpieza final PASS:** quedan exclusivamente las dos cuentas/perfiles iniciales, ambas superadmin activas, con digest de identidades/roles sin cambios. Cero usuarios sintéticos, técnicos, solicitudes, documentos, objetos Storage, postulaciones, requisitos sintéticos, eventos e invitaciones. Se conservaron los dos contactos privados creados por el backfill. Evidencia: `sprint-02-evidence/final-state.json`.

Advisors: salud sin hallazgos; ocho tablas privadas con RLS sin policies/grants directos corresponden al diseño de denegación por defecto. Veinticuatro RPC SECURITY DEFINER autenticadas tienen guardas explícitas; el aviso no se silenció retirando funcionalidad. La protección de contraseñas filtradas sigue deshabilitada y quedan ocho hallazgos informativos de índices FK: revisar configuración/plan e índices antes de carga comercial. [Advisors y enlaces de remediación](sprint-02-evidence/advisors.json).

No publicar publicidad ni incorporar documentos personales todavía: faltan correo de captura/SMTP autorizado, callbacks completos, criterios operativos reales por categoría, operación continua del inspector y release/preview aprobados. No se configuró Preview contra la base comercial ni se envió correo a terceros.

## Archivos y Git

Inventario de cambios: [changed-files.txt](sprint-02-evidence/changed-files.txt). Incluye tres migraciones nuevas, cuatro suites SQL, formularios/rutas de técnico y administración, validaciones, descargas, worker, ejecutores de integración y evidencia. Rama `codex/supabase-integration-sprint-02`, remoto `https://github.com/sebaguerrerof/fixo.git`; main conserva el corte anterior. Entrega en commit local; sin push/deploy ni cambios de integración Git/Vercel.
