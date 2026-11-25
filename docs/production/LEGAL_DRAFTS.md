# Borradores de privacidad y términos — MVP de registro de técnicos

Estado: **BORRADOR sin aprobar. No está publicado en la web.** No es asesoría legal: debe revisarlo un abogado. Fecha: 2026-11-25.

## Antes de publicar: datos que solo tú puedes dar
| Marcador | Qué es |
| --- | --- |
| `[RAZÓN SOCIAL]`, `[RUT]` | Persona natural o empresa responsable |
| `[DOMICILIO]` | Dirección para notificaciones |
| `[REPRESENTANTE]` | Representante legal, si es empresa |
| `[PLAZO DE RESPUESTA]` | Plazo para responder solicitudes de derechos (confirmar el legal) |
| `[PLAZO CUENTAS]`, `[PLAZO DOCUMENTOS]` | Cuánto se conservan cuentas inactivas y documentos de postulaciones rechazadas |

## Marco a revisar con el abogado
- **Ley 19.628**, modificada por la **Ley 21.719**, cuya entrada en vigencia estaba fijada para el **1 de diciembre de 2026**. Fuentes secundarias informan que el 17 de noviembre el Congreso despachó una postergación al 15 de octubre de 2027, pero **no se confirmó su publicación en el Diario Oficial**; sin publicación antes del 1 de diciembre, rige la fecha original. Verificar en https://www.bcn.cl/leychile/navegar?idNorma=1209272
- El artículo 14 ter exige mantener publicada en el sitio información mínima sobre el tratamiento (responsable, canal de derechos, categorías, finalidades, base de licitud, destinatarios, transferencias internacionales, plazos, seguridad). Contrastar la lista con el texto oficial.
- **Ley 19.496** (consumidor) para los términos frente a clientes.

## Límites técnicos que el texto no puede contradecir
- **No hay eliminación ni exportación de cuenta en la web** (pendiente X3): las solicitudes se atienden a mano por correo. El historial de auditoría de postulaciones referencia al técnico sin borrado en cascada, así que una eliminación requiere un procedimiento definido (anonimizar o conservar con justificación). **Decidirlo antes de invitar.**
- La base guarda la versión de términos aceptada como texto fijo `2026-11-08` (disparador `handle_new_user`). Publicar una versión nueva sin actualizarlo dejaría registrada una versión que no es la que la persona vio. Cambiarlo requiere una **migración**, que necesita tu autorización.

---

## Política de privacidad (borrador)

**SoyFixo — Política de privacidad. Versión [FECHA].**

### 1. Responsable
`[RAZÓN SOCIAL]`, RUT `[RUT]`, `[DOMICILIO]`. Contacto de privacidad: privacidad@soyfixo.cl.

### 2. Qué datos tratamos
- **Cuenta:** nombre, apellido, correo y teléfono. La contraseña la gestiona nuestro proveedor de autenticación; nadie del equipo puede verla.
- **Técnicos:** comuna base y comunas de cobertura, presentación, experiencia, rubros, especialidades, precio de referencia, disponibilidad, enlaces de portafolio y los documentos que subas (identidad, certificados, licencias).
- **Clientes:** solicitudes de servicio, comuna y, si las agregas, dirección, referencias y fotografías.
- **Operación y seguridad:** historial de decisiones sobre cuentas y postulaciones, registros técnicos y contadores para limitar abusos. Usamos cookies necesarias para mantener la sesión; no usamos cookies publicitarias ni herramientas de analítica de terceros.

### 3. Para qué y con qué base
| Finalidad | Base propuesta (confirmar con abogado) |
| --- | --- |
| Crear y administrar tu cuenta | Ejecución del servicio que pides |
| Revisar la postulación de un técnico y sus documentos | Tu consentimiento y las medidas previas a la relación |
| Publicar el perfil de un técnico aprobado | Tu consentimiento |
| Gestionar solicitudes, cotizaciones y trabajos | Ejecución del servicio |
| Enviar correos necesarios (confirmación, recuperación, avisos del servicio) | Ejecución del servicio |
| Prevenir abusos y mantener la seguridad | Interés legítimo |

No vendemos tus datos ni los usamos para publicidad de terceros.

### 4. Qué es público
Solo si tu postulación es aprobada: nombre, presentación, comuna y cobertura, rubros, especialidades, experiencia y precio de referencia. **No** se publican tu correo, teléfono ni documentos. La dirección exacta de un cliente solo la ve quien corresponde para ejecutar el trabajo.

### 5. Quién accede
El equipo administrador autorizado y los proveedores que operan el servicio por encargo nuestro: Supabase (base de datos, autenticación y archivos; Canadá), Vercel (alojamiento de la web; Estados Unidos), Resend (correos automáticos), Zoho (correo de soporte) y Cloudflare (dominio y DNS). Usar estos proveedores implica transferir datos fuera de Chile. Entregamos datos a autoridades solo cuando la ley lo exige.

### 6. Cuánto tiempo
Mientras tu cuenta esté activa. Cuentas inactivas: `[PLAZO CUENTAS]`. Documentos de postulaciones rechazadas o abandonadas: `[PLAZO DOCUMENTOS]`. Podemos conservar por más tiempo los registros de decisiones cuando una obligación legal o la defensa de derechos lo requiera.

### 7. Seguridad
Conexiones cifradas, acceso por rol, documentos en almacenamiento privado e inspección antivirus antes de que puedan abrirse. Ningún sistema es infalible; si ocurre un incidente que te afecte, te informaremos según la ley.

### 8. Tus derechos
Puedes pedir acceso, rectificación, supresión, oposición, portabilidad o bloqueo, y retirar tu consentimiento, escribiendo a privacidad@soyfixo.cl desde el correo de tu cuenta. Respondemos en `[PLAZO DE RESPUESTA]`. Puedes reclamar ante la autoridad competente.

### 9. Menores
El servicio es para personas mayores de 18 años.

### 10. Cambios
Publicaremos la versión vigente con su fecha y avisaremos los cambios importantes.

---

## Términos de uso (borrador)

**SoyFixo — Términos de uso. Versión [FECHA].**

1. **Quiénes somos.** `[RAZÓN SOCIAL]`, RUT `[RUT]`, `[DOMICILIO]`. Soporte: soporte@soyfixo.cl.
2. **Etapa actual.** SoyFixo está en una etapa inicial: recibe registros y postulaciones de técnicos y, cuando esté habilitado, solicitudes de clientes. No se realizan cobros ni pagos a través de la plataforma.
3. **Qué es SoyFixo.** Una plataforma que conecta clientes con técnicos independientes. SoyFixo no ejecuta los trabajos ni emplea a los técnicos. *(El abogado debe definir las responsabilidades frente al consumidor.)*
4. **Cuenta.** Debes ser mayor de 18 años, entregar información veraz y vigente, y proteger tu contraseña. Cada persona usa su propia cuenta.
5. **Postulación de técnicos.** Registrarte no significa estar aprobado ni publicado. Declaras que tus antecedentes y documentos son auténticos y tuyos, y que tienes las autorizaciones que exija tu oficio. Podemos pedir más antecedentes, aprobar, rechazar o suspender, indicando el motivo. Cambiar antecedentes puede retirar tu publicación hasta una nueva revisión.
6. **La verificación.** Revisamos los antecedentes que nos entregas; eso no garantiza la calidad de un trabajo ni reemplaza las certificaciones que exija la ley.
7. **Sin garantía de trabajo.** No garantizamos solicitudes, contratación ni ingresos.
8. **Costo.** El registro no tiene costo. Cualquier cobro futuro se informará antes y requerirá tu aceptación.
9. **Uso indebido.** No puedes suplantar a otros, subir archivos maliciosos, acceder a datos ajenos ni usar los datos de otras personas para fines distintos al servicio. Podemos restringir el acceso ante incumplimientos.
10. **Término.** Puedes pedir el cierre de tu cuenta en soporte@soyfixo.cl.
11. **Cambios y ley aplicable.** Avisaremos los cambios relevantes. Rige la ley chilena y los derechos irrenunciables del consumidor.
