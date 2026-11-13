# Sprint 02.5 — preparación operativa

9 de noviembre de 2026. Proyecto Fixo `rjzyqdhotcshvbdcrgon`; rama `codex/sprint-02-5-service-marketplace`. Se reutilizaron las evidencias históricas. No hubo reset, cambios SMTP/Auth de configuración, DNS, upgrades, push, conexión Git/Vercel ni deploy.

## Conexión y consistencia

**PASS integración.** PostgreSQL 17.11, seis migraciones iniciales reconciliadas antes de modificar, tablas comerciales vacías y digest de las dos identidades originales `6c2936a71f2dff1144d2c7926e16f6f8`. El catálogo previo se guardó privadamente en `.audit-backups/sprint03-native/preflight-catalog.json`. Las dos migraciones aditivas de Sprint 03 recibieron aprobaciones específicas; no se reprodujo el baseline. Ver informe Sprint 03 y planes de ejecución.

## Correo y autenticación

**PASS local:** Mailpit 1.33.1 oficial, SHA256 de ZIP `0bcf8f1e7c21005b30c206064ff2f37dac602ef66774e558379d326f5673d652`. SMTP `127.0.0.1:51025`, API `127.0.0.1:58025`, solo destinatarios `@local.invalid`, sin relay/forwarding, DNS inverso ni comprobación remota de versión. Se detuvo cada instancia propia al terminar.

Se generaron OTP reales de identidades sintéticas, se renderizaron las plantillas del repositorio y se enviaron por SMTP al capturador: confirmación, recuperación, invitación y reenvío. Cuatro mensajes capturados y comparados con el HTML original. **El remitente de esta prueba fue local; no acredita SPF/DKIM/DMARC de Fixo.**

**PASS integración:** seis recorridos reales con Edge aislado, usando los enlaces extraídos de los mensajes capturados: confirmar registro desde otro contexto sin verifier PKCE, ignorar next externo, rechazar reuso, recuperar contraseña y cerrar sesiones, rechazar recuperación falsificada mediante code PKCE, rechazar invitación anterior tras reenvío y completar contraseña/contacto/consentimiento de la invitación con rol customer. Evidencia `sprint-03-evidence/auth-email-browser.json`.

**BLOCKED / NOT TESTED:** envío desde el SMTP del Auth hospedado; registro y recuperación públicos con entrega real; expiración temporal natural de OTP de Auth; PKCE válido completo con envío de confirmación. No se modificó el reloj ni la configuración productiva para simular expiración. Las pruebas unitarias previas de contrato y pruebas SQL de prueba de contraseña conservan su evidencia, sin atribuirles entrega de correo.

La revisión automática rechazó inicialmente la generación de OTP/invitación y almacenamiento temporal de tokens por falta de aprobación específica. Se preparó el script, se solicitó ese alcance exacto y el propietario lo autorizó. La misma operación se ejecutó después. Este rechazo quedó resuelto; no se eludió.

## notificaciones@soyfixo.cl y DNS

**PREPARADO, no activado.** DNS público consultado el 9-11-2026: MX y TXT del dominio devolvieron ENODATA; `_dmarc.soyfixo.cl` ENOTFOUND. Esto describe la consulta pública, no verifica la cuenta/plan/datacenter Zoho ni una casilla existente.

| Registro/configuración | Valor observado o pendiente |
| --- | --- |
| MX de soyfixo.cl | Ninguno devuelto. Obtener servidores/prioridades exactos del Admin Console Zoho de esta cuenta. |
| SPF | Ningún TXT devuelto. Inventariar emisores y crear un solo SPF con el valor exacto del proveedor aprobado. |
| DKIM | Selector/clave pública de la cuenta desconocidos; no se inventó un registro. |
| DMARC | Sin registro devuelto. Definir buzón real de informes y política antes de redactar el TXT final. |
| SMTP | Host, datacenter, modalidad TLS, usuario y credencial pendientes de la configuración real del proveedor. |
| Remitente | Fixo `<notificaciones@soyfixo.cl>` propuesto; casilla/alias y autorización de envío no comprobados. |

Zoho Mail publica límites externos dinámicos de 50–500 mensajes/hora y deriva el uso transaccional a Zoho CPaaS. No conviene acreditar un servicio comercial con el buzón corporativo sin validar su política. [Límites oficiales, actualizados 2-11-2026](https://www.zoho.com/mail/help/adminconsole/rates-and-limits.html).

Zoho CPaaS ofrece créditos de 10.000 correos, vigencia seis meses y primer crédito gratuito; el importe monetario dinámico no fue verificable en la respuesta pública, por lo que **no se cita una tarifa pagada como confirmada**. [Proveedor](https://www.zoho.com/cpaas/pricing.html). Alternativa compatible por SMTP: Resend, plan Free con límite diario 100, dominio verificado y autenticación de remitente; validar cuota mensual/precio en la cuenta antes de adoptarlo. [Comparación oficial](https://resend.com/pricing). No se creó cuenta ni se contrató servicio. La prueba final deberá salir del Auth hospedado hacia buzones de prueba autorizados y comprobar headers/alineación/bounces.

## Inspección y requisitos

**PASS integración:** dos documentos reales sintéticos en Storage privado fueron encolados e inspeccionados mediante el worker y ClamAV real, antes de su revisión y aprobación. **PASS local:** leases, fencing, reintentos, cuarentena y confirmación idempotente en PostgreSQL 17.11.

Worker persistente implementado, template systemd y plan de hosting en `INSPECTION_WORKER_RUNBOOK.md`. **BLOCKED operación permanente:** falta contratar/aprobar el host, instalación, actualización de firmas, alertas y supervisión. No se incluyó ClamAV en Vercel. Host propuesto 4 GiB: USD 24/mes de compute según tarifa pública, antes de impuestos/extras; no contratado.

Administración conserva su interfaz de requisitos versionados y revisión profesional. La evidencia de los ocho recorridos anteriores incluye creación/modificación en UI; este sprint verificó nuevamente configuración y aprobación mediante JWT, invalidación por edición y revisión actual. No se cargaron requisitos legales. Tras limpiar fixtures no hay criterios operativos definitivos: el responsable debe definir cada rubro y sus antecedentes antes de publicar técnicos reales. Matching admite solo el rubro principal efectivamente revisado.

## Publicación

**PASS lectura:** Vercel `fixo-marketplace` Next.js, despliegues productivos anteriores READY; no vínculo Git en la respuesta del proyecto. Variables existentes solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, ambas para production; valores nunca volcados. Dominios verificados: soyfixo.cl redirige a www.soyfixo.cl; www y fixo-marketplace.vercel.app sin redirect. Acordar origen canónico antes de configurar enlaces Auth.

GitHub: el conector no listó ramas ni runs PR para el SHA local consultado; `git ls-remote` de main/rama Sprint 02 no devolvió referencias. No se acredita CI remoto ni sincronización. El release requiere autorización separada, revisión del commit, CI real y preview aislado. **No hay versión comercial publicada de este sprint.**
