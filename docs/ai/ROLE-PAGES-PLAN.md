# Paginas por rol: brechas y plan de cierre

Documento vivo (2026-11-15, sobre `main` cb83630). Lista, por rol, lo que **falta o esta incompleto** en las paginas, verificado leyendo el codigo (no por suposicion). Se actualiza al cerrar cada item. No reemplaza a `PLAN.md` (que hoy cubre el Sprint 06 de infraestructura): es el plan del producto visible.

Leyenda: **[S]** pequeno, sin esquema ni dependencias; **[M]** mediano, solo codigo; **[D]** requiere decision del owner; **[E]** requiere cambio de esquema/RPC (autorizacion previa). Estado: `[ ]` pendiente, `[x]` hecho.

## Transversal (los tres roles)

- [x] **X1 [M] `/perfil` esta fuera del panel.** Es una pagina con cabecera propia (logo + "Mi panel"), no usa el shell de cada rol: al editar la cuenta se pierde la navegacion. Solo edita nombre, apellido y telefono (y, para tecnicos en borrador, los datos de la postulacion). Ahora vive dentro del shell de cada rol (cliente, tecnico, admin) y el auditor cubre las tres vistas. Limite: con datos reales el formulario solo se verifica por tests; en demo muestra "Perfil no disponible".
- [ ] **X2 [M] No se puede cambiar la contrasena con la sesion iniciada.** `/auth/update-password` solo se alcanza desde el enlace de recuperacion (`auth/callback`). Agregar "Cambiar contrasena" en la cuenta.
- [ ] **X3 [D+E] Sin eliminar ni exportar la cuenta/datos.** No hay UI ni accion. Depende de la politica de privacidad y de la retencion de datos (pagos, auditoria): decision del owner antes de disenar.
- [ ] **X4 [E] Sin notificaciones visibles.** Existe `private.notification_outbox` (migracion de operaciones de trabajos) pero ninguna pagina lista avisos al usuario.
- [ ] **X5 [D+E] Sin resenas.** No hay tabla de resenas; el sitio dice "todavia no publicamos evaluaciones" (`/como-funciona`, `/tecnicos/[slug]`). Define si entran antes del lanzamiento.

## Cliente (`/cliente`, `/solicitar`, `/urgencia`, trabajos)

- [x] **C1 [S] Navegacion inconsistente.** Hay tres menus distintos: `/cliente` (Perfil, Solicitudes, Trabajos), trabajos (`job-shell.tsx`: Solicitudes, Trabajos, Perfil) y detalle de solicitud (Resumen, Mis solicitudes, Pagos; sin Trabajos). Unificar en una sola definicion.
- [x] **C2 [S] Enlace roto `/cliente#pagos`.** El menu del detalle de solicitud apunta a un ancla que no existe en `/cliente` (solo existe `#solicitudes`).
- [ ] **C3 [M] Sin vista propia de pagos.** Los pagos solo se ven dentro de cada trabajo; no hay resumen de pagos del cliente. (Hoy es Sandbox: confirmar alcance con el owner.)
- [ ] **C4 [M] Detalle de solicitud sin migrar al design system.** Usa titulos y tarjetas sueltas (`text-xl font-bold`, `Card` crudas) y no esta en el auditor de UI; solo se reviso en escritorio.
- [x] **C5 [S] Direccion del carne partida en dos lineas** en las cotizaciones (cosmetico, PR #13).
- [ ] **C6 [D] Direcciones guardadas.** El formulario de perfil no guarda direcciones; cada solicitud pide la suya. Decidir si se quiere libreta de direcciones.

## Tecnico (`/tecnico/*`)

- [ ] **T1 [M+D] `/tecnico/perfil` es solo lectura y el perfil aprobado no se puede editar.** La edicion existe solo en `/perfil` y unicamente con estado `draft`, `pending_verification` o `needs_information`. Una vez aprobado, el tecnico no puede corregir presentacion, cobertura ni rubros. Definir el flujo de "cambios sujetos a nueva revision".
- [ ] **T2 [M] Agenda es un marcador de posicion** (`/tecnico/agenda`: "Agenda aun no disponible"). Depende de que los trabajos tengan fechas programadas; revisar que ya ofrece `job-operations` antes de disenar.
- [ ] **T3 [M] El perfil no muestra documentos ni verificaciones.** La postulacion recibe documentos (cuarentena), pero el perfil propio no los lista ni muestra su estado de revision.
- [ ] **T4 [D] Origen del "Valor ref." del carne.** El carne muestra `startingPriceClp` o "A convenir"; confirmar de donde lo declara el tecnico y si es editable.
- [ ] **T5 [S] Duplicidad `/tecnico/postulacion` vs `/tecnico/perfil` vs `/perfil`.** Tres lugares para el mismo perfil; ordenar el recorrido (estado, edicion, vista publica).
- [x] Carne propio en el panel (PR #10).

## Administrador (`/admin/*`)

- [ ] **A1 [E+D] Reportes y reclamos es un marcador de posicion** (`/admin/reportes`: "aun no disponible"). No hay tabla de reclamos; existen incidencias de trabajos (`admin/trabajos`). Decidir si reclamos = incidencias o es un modulo nuevo, y definir el canal de soporte (el propio texto lo deja como requisito de lanzamiento).
- [ ] **A2 [M] `/admin/configuracion` solo cubre pagos** (comision y verificaciones). Faltan parametros operativos si se quieren (rubros/requisitos viven en `/admin/requisitos`).
- [ ] **A3 [S] "Mi cuenta" lleva a `/perfil` fuera del shell** (ver X1).
- [ ] **A4 [M] Listas admin en modo demo muestran su estado de error** (`solicitudes`, `trabajos`, etc.); su contenido real solo se verifica con el stack local de Supabase. Agregar una verificacion con datos reales.
- [x] Carne del tecnico en el detalle (PR #13).

## Orden propuesto

1. **Ya, sin decisiones:** C1, C2, C5 (pequenos), luego X1 (cuenta dentro del shell) y X2.
2. **Despues, solo codigo:** C4, T5, T3, A3, A4.
3. **Con decision previa del owner:** X3, X5, C3, C6, T1, T4, A1, A2.
4. **Con cambio de esquema (autorizacion aparte):** X4, X5, A1.

## Limites de este analisis

Leido el codigo de las paginas y sus servicios principales; **no** se probo cada flujo con datos reales de Supabase ni se reviso la accesibilidad de las paginas nuevas que se agreguen. Los items marcados [D] son preguntas, no recomendaciones cerradas.
