# Inspección de documentos desde tu equipo (solución temporal del MVP)

Estado: **preparado, NOT TESTED** (ClamAV no está instalado en el equipo de desarrollo y no se ejecutó contra producción). Mientras no haya un servidor (ver `INSPECTION_WORKER_RUNBOOK.md`), los documentos que suben los técnicos quedan "En cuarentena" hasta que ejecutes esta inspección. Un documento sin inspeccionar no se puede descargar ni aprobar.

## Una sola vez
1. **Node 24 o superior** y el repositorio con `npm install` ejecutado.
2. **ClamAV para Windows**: descarga el instalador oficial (`.msi`) desde https://www.clamav.net/downloads.
3. Configura las firmas, con permisos de administrador, en la carpeta de ClamAV (normalmente `C:\Program Files\ClamAV`):
   - Copia `conf_examples\freshclam.conf.sample` a `freshclam.conf` y borra (o comenta con `#`) la línea `Example`.
   - Crea una carpeta de firmas en la que tu usuario pueda escribir: `C:\Users\<tu-usuario>\.soyfixo\clamav-db`.
4. Crea el archivo `C:\Users\<tu-usuario>\.soyfixo\inspeccion.env` con estas cinco líneas:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref-del-proyecto>.supabase.co
   FIXO_INSPECTION_PROJECT=<ref-del-proyecto>
   SUPABASE_SERVICE_ROLE_KEY=<clave secreta: Supabase > Project Settings > API Keys>
   FIXO_CLAMSCAN_PATH=C:\Program Files\ClamAV\clamscan.exe
   FIXO_CLAMAV_DATABASE_DIR=C:\Users\<tu-usuario>\.soyfixo\clamav-db
   ```
   **Cuidado:** esa clave da acceso total a la base de datos. No la pegues en chats, correos ni en el repositorio; no sincronices la carpeta `.soyfixo` con la nube; usa un equipo con tu usuario protegido y disco cifrado.
5. Comprueba sin tocar la cola (desde la carpeta del repositorio):
   ```
   powershell -ExecutionPolicy Bypass -File scripts\ops\inspeccionar-documentos.ps1 -SoloComprobar
   ```
   La primera descarga de firmas tarda varios minutos.

## Cada día (o cuando un técnico te avise)
```
powershell -ExecutionPolicy Bypass -File scripts\ops\inspeccionar-documentos.ps1
```
Cada documento procesado imprime una línea `inspection_finished` con `clean`, `unsafe` o `error`; al final, `queue_empty`. Después revisa las postulaciones en `/admin/verificaciones`.

- `unsafe`: el contenido se rechazó; pide al técnico otro archivo.
- `error`: se reintenta en una ejecución posterior (máximo 5 intentos por documento).
- No marques un documento como limpio por SQL.

## Límites
Depende de que tu equipo esté encendido y de que lo ejecutes: no hay alertas. Sirve para la primera tanda de técnicos; para operar de forma continua hace falta el servidor del runbook.
