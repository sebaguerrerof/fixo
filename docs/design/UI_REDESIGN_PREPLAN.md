# Preplan: rediseño UX/UI y marca SoyFixo

Estado: **PROPUESTA para aprobación**. No es el plan del sprint (`docs/ai/PLAN.md` no se toca) y no se ha implementado nada. Fecha: 2026-11-13.
Objetivo: una web minimalista, tecnológica, con animaciones sutiles, carga con skeletons y un design system central, mobile first, bajo la marca **SoyFixo**.

## 1. Diagnóstico del código actual (verificado, solo lectura)

| Tema | Hallazgo |
| --- | --- |
| Stack de estilos | Tailwind 3.4 + variables CSS HSL en `globals.css` (tokens estilo shadcn: `--primary`, `--card`, `--muted`, `--radius`…) y `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`. **La base de un design system ya existe**; no hace falta cambiar de librería. |
| Componentes base | `src/components/ui`: solo `avatar`, `badge`, `button`, `card`, `skeleton`. Faltan input, select, textarea, label, dialog, toast, tabs, tooltip, tabla, paginación, etc.: los formularios usan `<input>` y clases sueltas. |
| Valores fuera del sistema | Colores literales (`slate-950`, `emerald-50`, `amber-950`, `sky-200`, `cyan-200`…), gradientes y sombras con HSL escritos a mano en `globals.css` (`hero-shell`, `login-showcase`, `search-command`, `work-card`), `text-gradient` con `cyan-600/sky-700`. Cambiar la paleta hoy exige tocar muchos archivos. |
| Tema oscuro | `darkMode: ["class"]` declarado, pero **no hay tokens oscuros** ni conmutador. |
| Tipografía | No hay fuente cargada (sin `next/font`); se usa la del sistema. Sin escala tipográfica definida: tamaños sueltos (`text-3xl`, `text-sm`…). |
| Movimiento | Keyframes `enter`, `reveal`, `drift`, `pulse-dot` y `prefers-reduced-motion` ya respetado (bien). Sin catálogo de duraciones/easing. |
| Skeletons | Existe `ui/skeleton.tsx` y 10 `loading.tsx` (raíz, cliente, técnico, admin). Cobertura parcial; las páginas públicas (`/tecnicos`, `/como-funciona`, `/solicitar`, perfiles) y varios formularios no tienen skeleton propio. |
| Mobile | Hay `mobile-bottom-nav.tsx` y `site-header.tsx`; falta auditarlo contra un criterio mobile first (objetivos táctiles, zonas seguras, teclado en formularios). |
| Marca | "Fixo" aparece en **34 archivos / ~50 menciones** de `src` (logo en minúscula `fixo`, `<title>`, metadatos, textos legales de pagos, errores, datos demo `admin@fixo.cl`) y en scripts/tests. **No hay carpeta `public/`**: sin favicon, ícono, imagen Open Graph ni manifest. |
| Calidad visual | JSX muy denso (componentes en una sola línea larga), difícil de mantener y de testear visualmente. |
| Pruebas | Vitest + Playwright ya instalados; no hay pruebas visuales ni de accesibilidad. |

## 2. Principios de diseño

1. **Mobile first real:** se diseña y prueba primero a 360-390 px; se amplía con `sm/md/lg`. Objetivo táctil mínimo 44 px, acciones principales al alcance del pulgar, formularios con teclado correcto (`inputmode`, `autocomplete`).
2. **Minimalismo tecnológico:** mucho espacio en blanco, una sola familia tipográfica sans con números tabulares, una paleta corta (neutros + 1 color de marca + 4 semánticos), bordes finos, sombras mínimas, sin decoración que no comunique.
3. **Movimiento con propósito:** entradas suaves, transiciones de estado y microinteracciones de 150-300 ms; nada que bloquee. `prefers-reduced-motion` desactiva todo lo no esencial (ya existe la base).
4. **Percepción de velocidad:** skeletons con la forma exacta del contenido, sin saltos de layout (CLS ≈ 0); estados vacío/error/éxito diseñados.
5. **Accesibilidad:** contraste WCAG AA, foco visible, navegación por teclado, etiquetas reales, `aria-live` en avisos, sin información solo por color.
6. **Una sola fuente de verdad:** ningún color, tamaño, radio, sombra, duración o texto de marca escrito a mano en una página; todo sale de tokens.

## 3. Design system propuesto (estructura)

```
src/design-system/
  tokens/        colores, tipografía, espaciado, radios, sombras, movimiento, z-index, breakpoints
  styles/        tokens.css (variables claro/oscuro), base.css, utilidades de motion
  components/    primitivas (Button, Input, Select, Textarea, Checkbox, Radio, Switch, Label,
                 Field, Card, Badge, Avatar, Dialog, Sheet, Toast, Tabs, Tooltip, Skeleton,
                 Table, Pagination, Stepper, EmptyState, ErrorState, Spinner, Progress)
  patterns/      composiciones: SearchCommand, JobCard, TechnicianCard, StatusBadge,
                 PageHeader, DashboardShell, FormSection, PriceBreakdown
  brand/         Logo, marca, nombre y textos legales (única fuente de "SoyFixo")
docs/design/     guía viva del sistema y página de catálogo (/design, solo desarrollo)
```

- **Tokens en dos capas:** *primitivos* (escala de color cruda) → *semánticos* (`--color-surface`, `--color-text-muted`, `--color-brand`…). Los componentes solo usan semánticos. Cambiar la marca = cambiar primitivos en un archivo.
- **Tailwind se mantiene** y se alimenta de los tokens (`tailwind.config.ts` lee las variables); se eliminan las clases de colores literales mediante una regla de lint.
- **Marca como dato:** `brand.name = "SoyFixo"`, dominio, remitente y textos legales en un módulo; los componentes importan, no escriben "Fixo".
- **Tema oscuro:** previsto en los tokens desde el inicio (decisión de activarlo, abajo).
- **Catálogo (`/design`)** habilitado solo en desarrollo/validación para revisar cada componente en claro/oscuro, estados y breakpoints.

## 4. Dirección visual (a validar con el propietario)

- **Paleta:** neutros fríos casi blancos/casi negros; color de marca único (hoy turquesa `196 78% 34%`; se puede mantener, afinar o cambiar: ver decisiones). Semánticos éxito/aviso/error/info definidos una vez con contraste verificado.
- **Tipografía:** una familia sans moderna cargada con `next/font` (sin petición externa en runtime), escala modular de 6-7 pasos, `text-balance` en títulos, cifras tabulares para precios CLP.
- **Forma:** radios coherentes (2 valores), bordes de 1 px, sombras en 2 niveles, vidrio (`backdrop-blur`) solo en barras flotantes.
- **Movimiento:** entrada escalonada de secciones al aparecer (CSS + `IntersectionObserver`, sin librería), hover/press en botones y tarjetas, transición de páginas suave, indicador de estado en vivo, contadores y progreso en el flujo de solicitud.
- **Herramientas nuevas de UX (a priorizar):** búsqueda de técnicos con comando rápido y filtros en hoja inferior móvil; stepper del flujo de solicitud con guardado de borrador; toasts y confirmaciones no intrusivas; vista de tarjetas/tabla responsiva; estados de carga optimistas; páginas de error y vacío con acciones claras; indicador de conexión.

## 5. Rebranding "SoyFixo"

- Un solo inventario de textos con la marca (tabla archivo → cadena → tipo): **interfaz**, **metadatos/SEO**, **textos legales y de pagos** (`Comisión Fixo (F)`, avisos de revisión), **mensajes de error del servidor**, **datos demo**, **identificadores técnicos**.
- Se cambia **solo texto visible y metadatos**. **No** se renombran: nombre del paquete npm, rutas, identificadores de base de datos, secretos, nombres de funciones/tablas ni referencias en migraciones (cambiarlos rompería despliegue y datos). Los términos del dominio ("Comisión Fixo (F)") se confirman con el propietario porque son texto financiero/legal con pruebas asociadas.
- Marca nueva: logo/isotipo (SVG), favicon, ícono de app, imagen Open Graph, `manifest`; carpeta `public/` hoy inexistente.
- Los textos de correo (Auth, avisos) y el remitente cambian junto con la cuenta corporativa de `soyfixo.cl`; coordinar con Sprint 06 Etapa 4 (Zoho/Auth) para no romper plantillas.
- Pruebas que mencionan "Fixo" (4 archivos de test de `src`, varios scripts) se actualizan solo donde la cadena sea de interfaz.

## 6. Fases y entregables

| Fase | Contenido | Salida verificable |
| --- | --- | --- |
| **0. Decisiones y dirección** | Respuestas de §8; mood board y 2 propuestas de home (móvil + escritorio) en HTML estático | Dirección aprobada |
| **1. Fundaciones** | Tokens, `next/font`, tema claro (+oscuro si se aprueba), módulo `brand`, Logo SoyFixo, favicon/OG, regla de lint contra colores literales | Build verde; `/design` con tokens |
| **2. Primitivas** | Componentes del §3 con variantes, estados, a11y y skeleton propio; pruebas unitarias | Catálogo completo, axe sin errores |
| **3. Shell y navegación** | Header, bottom-nav, dashboard shells, footers, transiciones, `loading.tsx` unificados | Navegación móvil/escritorio revisada |
| **4. Páginas públicas** | Home, cómo funciona, técnicos y perfil, login/registro/recuperación, términos/privacidad | Capturas móvil/tablet/escritorio |
| **5. Flujos de cliente** | Solicitar (stepper), urgencia, trabajos, cotizaciones, pagos (textos y desglose F/Q/G sin cambiar lógica) | Flujos E2E con Playwright |
| **6. Técnico y admin** | Oportunidades, cotizar, postulación, agenda, paneles admin | Paridad funcional con hoy |
| **7. Endurecimiento** | Lighthouse móvil, CLS/LCP, contraste, teclado, lector de pantalla, pruebas visuales, limpieza de CSS huérfano | Informe de calidad y checklist |

Cada fase: rama propia desde `main`, PR con CI verde, merge con tu autorización, `HANDOFF.md` actualizado. **Sin cambios de lógica de negocio, RLS, esquema ni API pública.**

## 7. Criterios de aceptación

- Ningún color, radio, sombra, duración ni texto de marca literal fuera de los tokens/`brand` (verificado por lint o script).
- Cambiar un token de marca se refleja en toda la web (demostrado con una prueba de cambio de color en el catálogo).
- Todas las pantallas funcionan a 360 px sin scroll horizontal; objetivos táctiles ≥ 44 px.
- Lighthouse móvil objetivo (a confirmar): rendimiento ≥ 90, accesibilidad ≥ 95; CLS < 0,1.
- Toda carga relevante tiene skeleton con forma equivalente; `prefers-reduced-motion` respetado.
- `lint`, `typecheck`, `test`, `build`, `test:smoke` y el CI en verde; Playwright cubre los flujos principales.
- Sin regresión funcional en pagos, permisos y roles.

## 8. Decisiones que necesito del propietario

1. **Paleta y estilo:** ¿mantener el turquesa actual afinado, o un color nuevo? ¿Referencias que te gusten (sitios o apps)?
2. **Tema oscuro:** ¿incluirlo desde el inicio (más trabajo, mejor percepción tecnológica) o dejarlo para después?
3. **Logo:** ¿tienes isotipo/logotipo de SoyFixo, o lo diseño yo como SVG sencillo (llave/trazo) para validar?
4. **Textos de pagos y legales:** ¿"Comisión Fixo (F)" pasa a "Comisión SoyFixo (F)"? Son textos financieros con pruebas.
5. **Nuevas dependencias:** el plan por defecto usa **solo CSS + las dependencias actuales**. Posibles añadidos (requieren tu aprobación): `motion` (animaciones complejas), Radix UI (diálogos/menús accesibles), `@axe-core/playwright` (auditoría de accesibilidad). Mi recomendación: Radix y axe sí; `motion` solo si el CSS no alcanza.
6. **Orden frente al Sprint 06:** ¿este rediseño va **antes** de la Etapa 2 (como indicas) y bloquea el resto, o corre en paralelo con ramas separadas? Recomiendo paralelo con ramas separadas, para que la cuenta Supabase corporativa y el entorno de validación avancen sin esperar. El entorno de validación sirve además de vista previa protegida del rediseño.
7. **Alcance de contenido:** ¿se rescribe el copy (textos) o solo se cambia la marca y se mantiene el texto actual?

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Rediseño grande que rompa flujos de pago/permisos | Solo capa de presentación; fases pequeñas; E2E y tests existentes como red de seguridad |
| Renombrar "Fixo" en identificadores y romper despliegue/datos | Alcance limitado a texto visible; lista de exclusiones explícita (§5) |
| Animaciones que perjudican rendimiento o accesibilidad | Solo `transform`/`opacity`, `prefers-reduced-motion`, presupuesto de Lighthouse |
| Deriva visual con el tiempo | Lint contra valores literales + catálogo `/design` como referencia |
| Mezcla con el trabajo del Sprint 06 en `main` protegida | Ramas por fase, PR con CI, merge con autorización |
| Correos/Auth con marca antigua tras el cambio de cuenta corporativa | Coordinar plantillas con Sprint 06 Etapa 4 |
