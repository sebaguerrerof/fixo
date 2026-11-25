# Correo de SoyFixo: Zoho (casillas) + Resend (correos automáticos) + Supabase Auth

Estado: **guía sin ejecutar (NOT TESTED)**. Fecha: 2026-11-25. Los valores que muestre cada panel mandan sobre los de este documento (cambian según región y antigüedad de la cuenta). No pegues claves en chats ni en el repositorio.

Reparto: **Zoho** recibe y envía el correo de personas (`soporte@`, `privacidad@`). **Resend** envía los correos automáticos de la plataforma (`no-reply@`). Supabase Auth usa Resend por SMTP.

## 0. Antes de tocar DNS
En Cloudflare > `soyfixo.cl` > DNS, exporta la zona (Import and Export > Export). **No modifiques** los registros de la web (el `A` del dominio raíz y el `CNAME` de `www`). El 25-11 no se observaron registros MX ni TXT.

## 1. Zoho Mail
1. Crea la organización en Zoho Mail con el dominio `soyfixo.cl` y verifica la propiedad (Zoho ofrece configuración en un clic para Cloudflare; revisa qué registros va a crear).
2. Crea las casillas `soporte@soyfixo.cl` y `privacidad@soyfixo.cl` (la segunda puede ser un alias).
3. Registros en Cloudflare (confirma los valores en la consola de Zoho; dependen del centro de datos, estos son los de `.com`):

   | Tipo | Nombre | Valor | Prioridad |
   | --- | --- | --- | --- |
   | MX | `@` | `mx.zoho.com` | 10 |
   | MX | `@` | `mx2.zoho.com` | 20 |
   | MX | `@` | `mx3.zoho.com` | 50 |
   | TXT | `@` | `v=spf1 include:zohomail.com ~all` | |
   | TXT | el selector que entregue Zoho (`…._domainkey`) | la clave DKIM de Zoho | |

   Debe existir **un solo** registro SPF en `@`. Todo en "DNS only".
4. En Zoho, verifica MX, SPF y DKIM. Envía y recibe un correo de prueba desde una cuenta externa.

## 2. Resend
1. Crea la cuenta y agrega el dominio `soyfixo.cl` (Domains > Add Domain). Anota la región elegida.
2. Crea en Cloudflare **exactamente** los registros que muestre Resend (suelen ser un `MX` y un `TXT` en `send`, y un registro DKIM en `resend._domainkey`; en dominios nuevos pueden ser `CNAME`). Nube gris ("DNS only"). Usan nombres distintos a los de Zoho: **no** agregues Resend al SPF de `@`.
3. Espera el estado "Verified" (suele tardar minutos; la propagación puede tomar hasta 72 h).
4. API Keys > crea una clave con permiso **solo de envío**, limitada a `soyfixo.cl`, nombre `supabase-auth`.

## 3. DMARC (después de verificar ambos)
TXT en `_dmarc`: `v=DMARC1; p=none; rua=mailto:soporte@soyfixo.cl`

`p=none` solo observa. Endurecerlo se decide más adelante, mirando los informes.

## 4. Supabase (proyecto Fixo)
1. **Authentication > URL Configuration**
   - Site URL: `https://www.soyfixo.cl`
   - Redirect URLs: `https://www.soyfixo.cl/auth/callback`, `https://www.soyfixo.cl/auth/update-password`, `https://www.soyfixo.cl/login`
   - En Vercel, `FIXO_APP_URL` (Production) debe ser **exactamente** `https://www.soyfixo.cl`. Si es otro origen, el registro responde "Solicitud no autorizada".
2. **Authentication > Emails > SMTP Settings** (activar SMTP propio)
   - Host `smtp.resend.com`, puerto `465` (si la recuperación de contraseña falla, prueba `587`)
   - Usuario `resend`; contraseña: la API key de Resend
   - Sender email `no-reply@soyfixo.cl`; nombre `SoyFixo`
3. **Authentication > Emails > Templates**: pega el contenido de los archivos de `supabase/templates/` (versión de esta rama, con la marca SoyFixo) con estos asuntos:

   | Plantilla | Archivo | Asunto |
   | --- | --- | --- |
   | Confirm signup | `confirmation.html` | Confirma tu cuenta en SoyFixo |
   | Reset password | `recovery.html` | Recupera tu acceso a SoyFixo |
   | Invite user | `invite.html` | Te invitamos a SoyFixo |

   Los enlaces usan `{{ .SiteURL }}/auth/callback?token_hash=…`; no los reemplaces por `{{ .ConfirmationURL }}`.
4. **Authentication > Sign In / Providers > Email**: "Confirm email" activado; contraseña mínima de 12 con minúsculas, mayúsculas y números.
5. **Authentication > Rate Limits**: anota el límite de correos por hora (con SMTP propio suele partir en 30). Invita en tandas que quepan en ese límite y en el de tu plan de Resend.

## 5. Comprobaciones de solo lectura (SQL Editor de Supabase)
```sql
-- Deben aparecer 14 versiones; la última, 20261112120000
select version from supabase_migrations.schema_migrations order by version;

-- ¿Quién administra? Debe haber al menos un superadmin tuyo
select u.email, p.role from public.profiles p join auth.users u on u.id = p.id where p.role in ('superadmin','moderator');

-- Requisitos configurados por rubro
select category_id, count(*) from private.category_requirements group by category_id order by 1;
```
Si no hay superadmin o los resultados no coinciden, no cambies nada: pásame el resultado (sin correos de terceros).

## 6. Prueba completa (después de publicar la versión nueva)
Con un correo **externo** tuyo: registro en `/registro/tecnico` → llega el correo (revisa spam) → en "mostrar original", SPF y DKIM en `pass` → confirmar → completar perfil → subir un documento sintético → inspeccionarlo (`LOCAL_INSPECTION_GUIDE.md`) → verlo y revisarlo como administrador → probar "Olvidé mi contraseña". Solo entonces envía los WhatsApp, primero a 3–5 técnicos.

## Fuentes
- Resend: https://resend.com/docs/send-with-supabase-smtp · https://resend.com/docs/knowledge-base/cloudflare
- Zoho: https://www.zoho.com/mail/help/adminconsole/cloudflare.html · https://www.zoho.com/mail/help/adminconsole/spf-configuration.html
