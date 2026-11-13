# Fixo — Auth, correo y activación externa

Estado: **PREPARADO; captura SMTP y proveedor real NOT TESTED**. Fecha: 8 de noviembre de 2026, America/Santiago. No se crearon casillas, cambiaron DNS ni enviaron correos reales.

## Contrato de enlaces

- Site URL de Supabase y `FIXO_APP_URL` deben ser el mismo origen controlado por entorno. Desarrollo: `http://127.0.0.1:3000`; producción propuesta: `https://soyfixo.cl`, solo después de verificar dominio/hosting. No deducir el origen desde Host/X-Forwarded-Host.
- Allowlists exactas del callback y actualización de contraseña; sin comodines que permitan hosts ajenos. No promover un build con NEXT_PUBLIC de staging a producción.
- Las tres plantillas de `supabase/templates/` usan SiteURL + /auth/callback y TokenHash, sin contraseñas ni rol en metadata. Confirmación usa type=email; recuperación recovery; invitación invite. El callback muestra una confirmación explícita antes de consumir el OTP; esto reduce consumo accidental por prefetch de lectores de correo.
- OTP en servidor permite otro navegador sin necesitar el verifier PKCE original. También se admite code PKCE para confirmación: requiere el mismo navegador con verifier y no concede una prueba de recuperación por añadir type=recovery al URL.
- Solo un OTP recovery/invite verificado genera prueba de contraseña (recovery también puede completar una invitación pendiente): hash privado persistente, sesión/usuario, cookie HttpOnly/SameSite Lax, 15 minutos y consumo único. En producción la cookie es Secure. Para pruebas de servidor productivo con navegador usar HTTPS local; el smoke HTTP no establece sesiones.
- Enlaces expirados, repetidos o revocados muestran error controlado. Si una invitación ya confirmó el correo pero se interrumpió al completar contraseña/perfil, recuperación permite retomar la misma reserva pendiente. Un reenvío explícito sobre esa identidad confirmada usa correo recovery si Auth rechaza un segundo invite; no asigna roles desde ese correo. next/redirect externos no se utilizan. La app no registra token_hash/code, cookies, contraseñas ni enlaces firmados.
- Después de cambiar la contraseña se solicita logout global y un nuevo login. Las políticas sensibles comprueban la fila actual de cuenta y auth.sessions: no se confía solo en la expiración de JWT.

## Captura local pendiente

El config utiliza Mailpit local (sección histórica inbucket del CLI). No habilitar auth.email.smtp externo en pruebas. Las plantillas ya están conectadas en config.toml; contraseña mínima 12, mayúscula/minúscula/número; OTP 3600 segundos; intervalo de correo 60 segundos; rate limits nativos conservados/configurados localmente.

El runner de integración exige la instancia dedicada en API 54331/DB 54332/Mailpit 54334, vacía y autorizada. La preparación de esa copia quedó en .audit-backups/sprint01-isolated y **no se arrancó**, por decisión expresa del propietario tras el rechazo de revisión automática. No reintentar start ni ejecutar el runner sin nueva autorización. El runner no carga .env.local ni acepta URLs remotas.

Prueba futura: confirmar plantilla capturada → abrir en otro navegador → callback → sesión real → rol/estado DB → perfil; recuperar contraseña → validar prueba → cambiar → logout; invitar → completar contraseña/contacto/términos → postulación pending. Revisar expiración, reuso, revocación, reenvío y errores. No llamar PASS a la captura por tener archivos HTML.

## Preparación Zoho / Supabase hospedado

1. Confirmar titularidad, plan y centro de datos Zoho; verificar que el plan permite SMTP autenticado y el volumen transaccional esperado. El remitente propuesto `notificaciones@soyfixo.cl` todavía no es una casilla/alias verificado.
2. Obtener el host exacto en Server Configuration Details de la cuenta. Zoho distingue tipos de cuenta y datacenters; no fijar smtp.zoho.com por suposición. La documentación ofrece SSL 465 y TLS 587 según cuenta. Confirmar compatibilidad TLS de Supabase con la modalidad elegida.
3. Crear/autorizar casilla o alias solo con aprobación. Usar credencial/app password cuando corresponda por MFA; guardar en secretos del proveedor/Supabase, sin NEXT_PUBLIC, Git, capturas ni logs.
4. En Supabase Auth configurar host, puerto, usuario, password, sender email y sender name Fixo. No se requieren variables SMTP en la aplicación Next.js. Mantener entornos aislados y destinatarios de prueba autorizados.
5. Configurar Site URL/redirects, confirmaciones obligatorias, plantillas y rate limits antes de abrir registros. Revisar protección de contraseñas filtradas, CAPTCHA y límites del plan. El gateway agrega límites por hash de correo: signup/recovery 3 por 15 minutos y login 10 por 15 minutos. Los límites nativos de Auth siguen siendo necesarios porque su API pública puede llamarse directamente.
6. Validar volumen/rate limits con tráfico desde el servidor Next.js: el proxy puede concentrar IPs. No confiar en un X-Forwarded-For arbitrario para elevar límites. Definir proxy confiable/CAPTCHA antes de apertura pública, sin relajar controles por un error de prueba.
7. Ejecutar una prueba transaccional autorizada, revisar headers SPF/DKIM/DMARC, inbox/spam y bounce. “Aceptado por Supabase” no equivale a entregado. Definir soporte y respuesta a errores; no enviar campañas comerciales desde este flujo.

## Plan DNS, sin ejecutar

- SPF: inventariar remitentes existentes y mantener **un** TXT SPF. Incorporar el include exacto indicado por Zoho para esa cuenta y cualquier proveedor transaccional aprobado; no crear un segundo SPF ni reemplazar entradas vigentes a ciegas.
- DKIM: generar selector/clave pública en Zoho Admin; publicar el TXT exacto de selector._domainkey.soyfixo.cl y verificarlo en Zoho. La clave privada no sale del proveedor.
- DMARC: acordar el buzón de informes y revisar alineación con From soyfixo.cl. Preparar _dmarc con política de observación aprobada, revisar resultados y luego acordar quarantine/reject. No inventar un destinatario rua ni cambiar políticas actuales sin inspección/aprobación.
- Registrar valores actuales, responsable, ventana y rollback de cada registro antes de cualquier cambio. Este repositorio no contiene comandos que cambien DNS.

## Gates para publicación

Pruebas aisladas verdes, revisión de migraciones/baseline/restore, textos legales definitivos aprobados, dominio/hosting y URLs verificados, remitente y SMTP aprobados, prueba de entrega autorizada, revisión de secretos e invitaciones inicialmente deshabilitadas hasta validar la configuración. Activar `FIXO_INVITATIONS_ENABLED=true` solo en el entorno aprobado; no se habilitó aquí.

Fuentes consultadas: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [plantillas locales](https://supabase.com/docs/guides/local-development/customizing-email-templates), [SSR](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [invitaciones](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [Zoho SMTP](https://www.zoho.com/mail/help/zoho-smtp.html), [SPF](https://www.zoho.com/mail/help/adminconsole/spf-configuration.html), [DKIM](https://www.zoho.com/mail/help/adminconsole/dkim-configuration.html).
