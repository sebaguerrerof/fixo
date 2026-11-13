# Evidencia Sprint 02.5/03

Solo datos sintéticos y resultados sanitizados. No guardar aquí tokens, claves, cookies, contraseñas, URL OTP ni bases Mailpit.

- `final-state.json`: dos identidades originales, digest y cero fixtures.
- `pgtap.json`: 27 acceso, 53 identidad y 25 marketplace; 105 aserciones con rollback.
- `snapshot-proof.json`: trigger PT409 y auditoría única en Fixo real, con rollback.
- `browser-integration.json`: nueve recorridos funcionales y referencia a regresión final.
- `browser-before-badge-fix.json`: fallo detectado de hidratación conservado para trazabilidad.
- `browser-rendering.json`: cuatro vistas finales sin errores, más privacidad tras suspensión.
- `auth-email-browser.json`: seis recorridos OTP desde correos capturados; no acredita SMTP de Auth hospedado.
- `client-artifacts.json`: secretos privados ausentes en los bundles públicos.

Reproducir PostgreSQL aislado en este equipo requiere Node 24 y el tooling separado y fijado: `npm install --prefix .audit-backups/tooling/sprint03-postgres --save-exact --no-audit --no-fund embedded-postgres@17.11.0-beta.19`, después `node scripts/test-marketplace-postgres.mjs`. El script crea un directorio nuevo persistente, usa loopback/puerto 54403 y contraseña aleatoria en memoria, no crea usuarios/servicios del sistema ni borra volúmenes. Auth/Storage son fixtures de contrato de SQL. No equivale a integración JWT/HTTP de Supabase.

Los runners de integración remota exigen `FIXO_SPRINT03_AUTHORIZED` y el proyecto Fixo exacto; no deben ejecutarse por tener acceso a una clave. Cada ejecución nueva necesita entorno y alcance autorizados, especialmente migraciones o correo. La limpieza usa un único `FIXO_SPRINT03_RUN`, UUID/email/etiqueta exactos y dos fases; `users` requiere confirmación del resultado SQL de esa misma ejecución. Los tokens temporales del run documentado ya se eliminaron.
