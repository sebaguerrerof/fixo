// Self-test of the UI audit: it must PASS a healthy page and FAIL every broken one. Needs Playwright's Chromium, no app.
//   node scripts/ui/test-audit-ui.mjs
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { auditRoute } from "./audit-lib.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");

const css = `
  body{margin:0;font:16px/1.4 sans-serif;color:#000;background:#fff}
  a,button{display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:44px;margin:0 0 8px;padding:0 12px;border:1px solid #000;background:#fff;color:#000;font:inherit;text-decoration:none}
  .spacer{height:2400px}
  .wide{position:relative;height:30px;min-width:60px;padding:0;margin-bottom:60px}
  .wide::before{content:"";position:absolute;left:50%;top:50%;width:max(100%,44px);height:44px;transform:translate(-50%,-50%)}
`;
const page = (body) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>fixture</title><style>${css}</style></head><body>${body}</body></html>`;
const heading = '<h1>Pagina de prueba</h1>';

// A narrow paragraph whose link wraps over several lines, with a transparent layer placed over one of its line boxes.
function wrappedLinkPage(which) {
  const index = which === "last" ? "rects.length - 1" : "1";
  return page(`${heading}<div id="host" style="position:relative;width:120px"><p style="margin:0;width:120px"><a id="l" href="#a" style="display:inline;height:auto;min-width:0;padding:0;border:0;margin:0">enlace muy largo que ocupa varias lineas del parrafo estrecho</a> y mas texto de la frase.</p><div id="ov" style="position:absolute;background:transparent"></div></div><script>const rects=[...document.getElementById("l").getClientRects()];const host=document.getElementById("host").getBoundingClientRect();const r=rects[${index}];const ov=document.getElementById("ov");ov.style.left=(r.left-host.left)+"px";ov.style.top=(r.top-host.top)+"px";ov.style.width=r.width+"px";ov.style.height=r.height+"px";</script><a href="#b">Uno</a>`);
}

// A 300 x 120 card with a 2 px border whose link is stretched over the card (::after, inset 0), optionally with a thin transparent strip
// laid over one edge of the card's padding box: that part of the card does not reach the link.
function stretchedCardPage(stripStyle) {
  const strip = stripStyle ? `<div style="position:absolute;background:transparent;${stripStyle}"></div>` : "";
  return page(`${heading}<article style="position:relative;width:300px;height:120px;border:2px solid #000;box-sizing:border-box"><h3 style="margin:8px"><a href="#a" class="s" style="display:inline;height:auto;min-width:0;padding:0;border:0;margin:0">Camila Rojas</a></h3>${strip}</article><style>.s::after{content:"";position:absolute;inset:0}</style>`);
}

const pages = {
  "/stretched-clean": stretchedCardPage(""),
  "/stretched-bottom-10": stretchedCardPage("left:0;right:0;bottom:0;height:10px"),
  "/stretched-bottom-2": stretchedCardPage("left:0;right:0;bottom:0;height:2px"),
  "/stretched-top-10": stretchedCardPage("left:0;right:0;top:0;height:10px"),
  "/stretched-right-6": stretchedCardPage("top:0;bottom:0;right:0;width:6px"),
  "/stretched-left-3": stretchedCardPage("top:0;bottom:0;left:0;width:3px"),
  "/healthy": page(`${heading}<a href="#a">Uno</a><br><a href="#b">Dos</a><div class="spacer"></div><button type="button">Abajo</button>`),
  "/empty": page(""),
  // A control far below the fold covered by an overlay: invisible from the top, real for a user who scrolls.
  "/covered-below": page(`${heading}<div class="spacer"></div><div style="position:relative;display:inline-block"><button type="button">Bloqueado</button><div style="position:absolute;inset:0;background:transparent"></div></div>`),
  // Compact control (30 px) with a 44 px interactive area; an overlay hides only the TOP edge strip of the enlarged area.
  "/covered-edge": page(`${heading}<div style="position:relative;display:inline-block;margin-top:40px"><a class="wide" href="#x">Compacto</a><div style="position:absolute;left:-10px;right:-10px;top:-8px;height:6px;background:transparent"></div></div>`),
  "/healthy-edge": page(`${heading}<div style="position:relative;display:inline-block;margin-top:40px"><a class="wide" href="#x">Compacto</a></div>`),
  // Hidden-by-CSS pages: HTTP 200, a heading in the DOM with a box, but nothing a person could see.
  "/hidden-heading": page('<h1 style="visibility:hidden">Pagina de prueba</h1><a href="#a">Uno</a><p>texto visible</p>'),
  "/invisible-page": page(`<div style="opacity:0">${heading}<a href="#a">Uno</a><p>texto</p></div>`),
  "/display-none-ancestor": page(`<div style="display:none">${heading}<a href="#a">Uno</a></div><p>otro texto</p>`),
  "/faded-text": page(`${heading}<div style="opacity:.4"><p>Texto casi invisible por la opacidad del ancestro</p></div><a href="#a">Uno</a>`),
  "/no-controls": page(`${heading}<p>Solo texto, sin enlaces</p>`),
  // Hit testing: a control that receives no events must fail even though its container is reached.
  "/pointer-none": page(`${heading}<div style="display:inline-block"><button type="button" style="pointer-events:none">Sin eventos</button></div><br><a href="#a">Uno</a>`),
  // The only exception: the <label> that activates the control.
  "/label-covers-input": page(`${heading}<div style="position:relative;display:inline-block;width:44px;height:44px"><input id="c" type="checkbox" style="width:44px;height:44px;margin:0"><label for="c" style="position:absolute;inset:0"></label></div><br><a href="#a">Uno</a>`),
  // Group opacity dims text AND its own background: white on a half-transparent black card over white is ~3.98:1.
  "/group-opacity": page(`${heading}<div style="background:#000;color:#fff;opacity:.5;padding:12px"><p>Blanco sobre tarjeta negra semitransparente</p></div><a href="#a">Uno</a>`),
  "/group-opaque": page(`${heading}<div style="background:#000;color:#fff;padding:12px"><p>Blanco sobre tarjeta negra opaca</p></div><a href="#a">Uno</a>`),
  // Gradients: measured at every colour stop (worst case); uninterpretable ones are NOT VERIFIED (a failure), never skipped.
  "/gradient-same": page(`${heading}<p style="background:linear-gradient(#000,#000);color:#000">Negro sobre degradado negro</p><a href="#a">Uno</a>`),
  "/gradient-worst-stop": page(`${heading}<p style="background:linear-gradient(#000,#fff);color:#fff">Blanco sobre degradado negro a blanco</p><a href="#a">Uno</a>`),
  // The worst point of a gradient is not always a stop: #757575 passes at both ends of black-to-white (4.56 / 4.61) but is ~1.17:1 in the middle.
  "/gradient-middle": page(`${heading}<p style="background:linear-gradient(#000,#fff);color:#757575">Gris en el centro del degradado</p><a href="#a">Uno</a>`),
  // The base colour only counts where it can be seen through the gradient.
  "/opaque-gradient-white-base": page(`${heading}<p style="background-color:#fff;background-image:linear-gradient(#000,#000);color:#fff">Blanco sobre degradado negro opaco, base blanca</p><a href="#a">Uno</a>`),
  "/opaque-gradient-black-base": page(`${heading}<p style="background-color:#000;background-image:linear-gradient(#000,#000);color:#fff">Blanco sobre degradado negro opaco, base negra</p><a href="#a">Uno</a>`),
  "/clear-gradient-white-base": page(`${heading}<p style="background-color:#fff;background-image:linear-gradient(transparent,transparent);color:#fff">Blanco sobre degradado transparente, base blanca</p><a href="#a">Uno</a>`),
  "/clear-gradient-black-base": page(`${heading}<p style="background-color:#000;background-image:linear-gradient(transparent,transparent);color:#fff">Blanco sobre degradado transparente, base negra</p><a href="#a">Uno</a>`),
  "/half-gradient-white-base": page(`${heading}<p style="background-color:#fff;background-image:linear-gradient(rgba(0,0,0,.5),rgba(0,0,0,.5));color:#fff">Blanco sobre degradado negro al 50 por ciento, base blanca</p><a href="#a">Uno</a>`),
  "/half-gradient-black-base": page(`${heading}<p style="background-color:#000;background-image:linear-gradient(rgba(0,0,0,.5),rgba(0,0,0,.5));color:#fff">Blanco sobre degradado negro al 50 por ciento, base negra</p><a href="#a">Uno</a>`),
  // A layer that does not cover the whole box (explicit size, no-repeat) leaves the base colour visible.
  "/partial-gradient-white-base": page(`${heading}<p style="background-color:#fff;background-image:linear-gradient(#000,#000);background-size:10px 10px;background-repeat:no-repeat;color:#fff">Blanco sobre degradado parcial, base blanca</p><a href="#a">Uno</a>`),
  // WCAG 2.5.8 inline exception: a link inside a sentence is exempt from the minimum size; a stand-alone small link is not.
  "/inline-link": page(`${heading}<p>Texto largo antes del enlace <a href="#a" style="display:inline;height:auto;min-width:0;padding:0;border:0;margin:0">enlace en frase</a> y mas texto despues del enlace.</p><a href="#b">Uno</a>`),
  "/small-standalone-link": page(`${heading}<div><a href="#a" style="height:20px;min-width:0;padding:0;border:0;margin:0">Solo</a></div><a href="#b">Uno</a>`),
  // A button declared as a field adornment may sit over its input; the same layout without the declaration is an overlap.
  "/adornment-declared": page(`${heading}<div style="position:relative;width:260px"><input aria-label="clave" style="width:100%;height:44px;box-sizing:border-box"><div data-field-adornment style="position:absolute;top:0;right:0"><button type="button" style="margin:0">Ver</button></div></div><a href="#a">Uno</a>`),
  "/adornment-undeclared": page(`${heading}<div style="position:relative;width:260px"><input aria-label="clave" style="width:100%;height:44px;box-sizing:border-box"><div style="position:absolute;top:0;right:0"><button type="button" style="margin:0">Ver</button></div></div><a href="#a">Uno</a>`),
  // An inline link that wraps over two lines must be probed on its line boxes, not at the centre of the union.
  "/wrapped-inline-link": page(`${heading}<p style="width:170px;margin:0">Acepto los <a href="#a" style="display:inline;height:auto;min-width:0;padding:0;border:0;margin:0">politica de privacidad completa</a> y mas texto.</p><a href="#b">Uno</a>`),
  // Multi-line link: a transparent layer over ONE line box (second, or last) leaves that part unclickable; the first line alone is fine.
  "/wrapped-second-line-blocked": wrappedLinkPage("second"),
  "/wrapped-last-line-blocked": wrappedLinkPage("last"),
  // Inline exception: only for links inside a sentence. Navigation groups and bare link lists are not sentences.
  "/nav-small-links": page(`${heading}<nav aria-label="Principal"><a href="#1" style="height:20px;min-width:0;padding:0;border:0;margin:0 8px 8px 0">Inicio</a><a href="#2" style="height:20px;min-width:0;padding:0;border:0;margin:0 8px 8px 0">Tecnicos</a><a href="#3" style="height:20px;min-width:0;padding:0;border:0;margin:0 8px 8px 0">Contacto</a></nav>`),
  "/bare-small-links": page(`${heading}<div><a href="#1" style="height:20px;min-width:0;padding:0;border:0;margin:0 8px 8px 0">Primero</a> <a href="#2" style="height:20px;min-width:0;padding:0;border:0;margin:0 8px 8px 0">Segundo</a> <a href="#3" style="height:20px;min-width:0;padding:0;border:0;margin:0 8px 8px 0">Tercero</a></div>`),
  // A link laid out as a box (inline-flex, like a button-styled link) is not part of a sentence even if the block has text elsewhere.
  "/boxed-link-near-text": page(`${heading}<div><p>Un parrafo largo con texto narrativo en el mismo bloque que el enlace.</p><a href="#1" style="display:inline-flex;height:20px;min-width:0;padding:0;border:0;margin:0">Enlace caja</a></div>`),
  // Text that fades in over 1.5 s: grey #595959 is ~7:1 when settled but ~3:1 at 60% opacity. The audit must wait for it to settle.
  "/settling-transition": page(`${heading}<p id="t" style="color:#595959;opacity:0;transition:opacity 1500ms linear;margin:0">Texto que aparece con una transicion larga</p><a href="#a">Uno</a><script>setTimeout(function(){document.getElementById("t").style.opacity="1"},100)</script>`),
  // Infinite animations (shimmer, pulse) must not block the audit.
  "/infinite-animation": page(`${heading}<style>@keyframes pulse{50%{opacity:.9}}#p{animation:pulse 1s infinite}</style><p id="p" style="margin:0">Texto con animacion infinita</p><a href="#a">Uno</a>`),
  "/nav-with-sentence": page(`${heading}<nav aria-label="Pie"><p>Este texto largo describe el menu de la pagina <a href="#1" style="display:inline;height:auto;min-width:0;padding:0;border:0;margin:0">enlace en nav</a> y sigue.</p></nav>`),
  // Fixed bars overlay scrolling content by design: a fixed bar over a flow control is not a static overlap (reachability is proven by the
  // scroll-and-click hit test). A full-screen fixed layer that swallows clicks is still caught by that hit test.
  "/fixed-bar": page(`${heading}<div style="height:600px"></div><button type="button" style="margin:0">Control</button><div style="height:900px"></div><nav style="position:fixed;left:0;right:0;bottom:0;height:60px;background:#eee"><a href="#n" style="margin:0 8px">Fijo</a></nav>`),
  "/fixed-bar-over-control": page(`${heading}<div style="height:500px"></div><button type="button" style="margin:0">Cubierto</button><div style="height:900px"></div><div style="position:fixed;inset:0;background:transparent"></div>`),
  // WCAG 1.4.3 exempts inactive components: low-contrast text in a disabled button is not a finding, the same text enabled is.
  "/disabled-low-contrast": page(`${heading}<button type="button" disabled style="color:#bbb;margin:0">Guardar cambio</button><a href="#a">Uno</a>`),
  "/enabled-low-contrast": page(`${heading}<button type="button" style="color:#bbb;margin:0">Guardar cambio</button><a href="#a">Uno</a>`),
  // Placeholders are measured too (they are not text nodes): the browser default grey on white is 2.5:1.
  "/placeholder-low": page(`${heading}<input aria-label="q" placeholder="Busca un tecnico" style="color:#000;background:#fff;height:44px;box-sizing:border-box"><style>#low::placeholder{color:#aaa}</style><input id="low" aria-label="r" placeholder="Correo electronico" style="height:44px;box-sizing:border-box"><a href="#a">Uno</a>`),
  "/placeholder-ok": page(`${heading}<style>input::placeholder{color:#595959}</style><input aria-label="q" placeholder="Busca un tecnico" style="height:44px;box-sizing:border-box"><a href="#a">Uno</a>`),
  // Stretched link: the link text is small but its ::after covers the whole card, which is the real click area.
  "/stretched-link": page(`${heading}<article style="position:relative;width:300px;height:120px;border:1px solid #000;box-sizing:border-box"><h3 style="margin:8px"><a href="#a" style="display:inline;height:auto;min-width:0;padding:0;border:0;margin:0" class="s">Camila Rojas</a></h3></article><style>.s::after{content:"";position:absolute;inset:0}</style>`),
  "/stretched-link-covered": page(`${heading}<article style="position:relative;width:300px;height:120px;border:1px solid #000;box-sizing:border-box"><h3 style="margin:8px"><a href="#a" style="display:inline;height:auto;min-width:0;padding:0;border:0;margin:0" class="s">Camila Rojas</a></h3><div style="position:absolute;left:0;right:0;bottom:0;height:30px;background:transparent"></div></article><style>.s::after{content:"";position:absolute;inset:0}</style>`),
  // Heading order: no skipped levels. h1 -> h3 is a finding; h1 -> h2 -> h3 and going back up are fine.
  "/heading-skip": page(`<h1>Pagina de prueba</h1><h3>Salta un nivel</h3><a href="#a">Uno</a>`),
  "/heading-ok": page(`<h1>Pagina de prueba</h1><h2>Seccion</h2><h3>Sub</h3><h2>Otra seccion</h2><a href="#a">Uno</a>`),
  "/gradient-ok": page(`${heading}<p style="background:linear-gradient(#fff,#eee);color:#000">Negro sobre degradado claro</p><a href="#a">Uno</a>`),
  "/gradient-unparsable": page(`${heading}<p style="background:linear-gradient(in oklch, oklch(0.2 0 0), oklch(0.9 0 0));color:#000">Degradado en espacio oklch</p><a href="#a">Uno</a>`),
  "/redirect-source": null,
  "/redirect-target": page('<h1>Otra pagina</h1>'),
};

// Interpolation spaces other than sRGB paint different colours between the stops: white text on a red-to-blue gradient is fine in
// sRGB (dark purple middle) but ~2.79:1 in the middle of "in hsl longer hue" (green). The audit must not guess: NOT VERIFIED.
const otherSpaces = ["hsl", "hsl longer hue", "hsl shorter hue", "hwb", "lab", "lch", "oklab", "oklch", "oklch longer hue", "srgb-linear", "display-p3", "xyz", "xyz-d50", "a98-rgb", "rec2020", "prophoto-rgb"];
const spacePath = (space) => `/space-${space.replaceAll(" ", "-")}`;
for (const space of otherSpaces) pages[spacePath(space)] = page(`${heading}<p style="background-image:linear-gradient(in ${space}, #b40000, #0000b4);color:#fff">Blanco sobre degradado en ${space}</p><a href="#a">Uno</a>`);
pages["/space-srgb-explicit"] = page(`${heading}<p style="background-image:linear-gradient(in srgb, #b40000, #0000b4);color:#fff">Blanco sobre degradado en srgb explicito</p><a href="#a">Uno</a>`);
pages["/space-default"] = page(`${heading}<p style="background-image:linear-gradient(#b40000, #0000b4);color:#fff">Blanco sobre degradado por defecto</p><a href="#a">Uno</a>`);

const server = createServer((request, response) => {
  const path = new URL(request.url, "http://x").pathname;
  // Session fixtures: /demo-login has a demo account button that sets a cookie; /private needs that cookie, else redirects to the login.
  if (path === "/demo-login") { response.writeHead(200, { "content-type": "text/html" }); response.end(page(`<h1>Ingresar</h1><button type="button" onclick="document.cookie='sid=1; path=/';location.href='/private'">Cliente · Prueba</button>`)); return; }
  if (path === "/demo-login-broken") { response.writeHead(200, { "content-type": "text/html" }); response.end(page(`<h1>Ingresar</h1><button type="button">Cliente · Prueba</button>`)); return; }
  if (path === "/demo-login-nobuttons") { response.writeHead(200, { "content-type": "text/html" }); response.end(page(`<h1>Ingresar</h1><a href="#a">Uno</a>`)); return; }
  if (path === "/private") {
    if (!(request.headers.cookie ?? "").includes("sid=1")) { response.writeHead(302, { location: "/demo-login" }); response.end(); return; }
    response.writeHead(200, { "content-type": "text/html" }); response.end(page(`${heading}<a href="#a">Uno</a>`)); return;
  }
  if (path === "/hang") return; // never answers: the navigation must time out
  if (path === "/redirect-source") { response.writeHead(302, { location: "/redirect-target" }); response.end(); return; }
  if (path === "/all-404/healthy" || !(path in pages)) { response.writeHead(404, { "content-type": "text/html" }); response.end(page(`${heading}<a href="#a">Uno</a>`)); return; }
  response.writeHead(200, { "content-type": "text/html" });
  response.end(pages[path]);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const viewport = { name: "movil", width: 390, height: 700, min: 44 };
const identify = { selector: "h1", text: "Pagina de prueba" };

const cases = [
  { name: "pagina sana pasa", route: { path: "/healthy", identify }, expect: (f) => f.length === 0 },
  { name: "control compacto con area ampliada libre pasa", route: { path: "/healthy-edge", identify }, expect: (f) => f.length === 0 },
  { name: "404 en la ruta falla (aunque el HTML parezca valido)", route: { path: "/missing", identify }, expect: (f) => f.some((x) => /estado HTTP 404/.test(x)) },
  { name: "redireccion inesperada falla", route: { path: "/redirect-source", identify: { selector: "h1", text: "Otra pagina" } }, expect: (f) => f.some((x) => /redireccion inesperada/.test(x)) },
  { name: "redireccion esperada (finalPath declarado) pasa", route: { path: "/redirect-source", finalPath: "/redirect-target", identify: { selector: "h1", text: "Otra pagina" }, minControls: 0 }, expect: (f) => f.length === 0 },
  { name: "200 vacio falla por falta del elemento identificador", route: { path: "/empty", identify }, expect: (f) => f.some((x) => /elemento identificador/.test(x)) },
  { name: "ruta sin elemento identificador declarado falla", route: { path: "/healthy" }, expect: (f) => f.some((x) => /no declara elemento identificador/.test(x)) },
  { name: "control cubierto bajo el pliegue falla", route: { path: "/covered-below", identify }, expect: (f) => f.some((x) => /«Bloqueado»/.test(x) && /llega a/.test(x)) },
  { name: "encabezado identificador con visibility:hidden falla", route: { path: "/hidden-heading", identify }, expect: (f) => f.some((x) => /elemento identificador/.test(x)) },
  { name: "pagina completa con opacity:0 falla", route: { path: "/invisible-page", identify }, expect: (f) => f.some((x) => /elemento identificador/.test(x)) },
  { name: "identificador dentro de un ancestro display:none falla", route: { path: "/display-none-ancestor", identify }, expect: (f) => f.some((x) => /elemento identificador/.test(x)) },
  { name: "la opacidad acumulada de un ancestro cuenta en el contraste", route: { path: "/faded-text", identify }, expect: (f) => f.some((x) => /contraste/.test(x) && /Texto casi invisible/.test(x)) },
  { name: "sin controles visibles el resultado no es valido", route: { path: "/no-controls", identify }, expect: (f) => f.some((x) => /0 controles visibles auditados/.test(x)) },
  { name: "una pagina sin controles pasa solo si la ruta lo declara (minControls: 0)", route: { path: "/no-controls", identify, minControls: 0 }, expect: (f) => f.length === 0 },
  { name: "boton con pointer-events:none falla aunque el clic llegue a su contenedor", route: { path: "/pointer-none", identify }, expect: (f) => f.some((x) => /«Sin eventos»/.test(x) && /llega a/.test(x)) },
  { name: "un label asociado que cubre al control es la unica excepcion permitida", route: { path: "/label-covers-input", identify }, expect: (f) => !f.some((x) => /llega a/.test(x)) },
  { name: "opacidad de grupo: texto Y fondo semitransparente se componen juntos (3,98:1 falla)", route: { path: "/group-opacity", identify }, expect: (f) => f.some((x) => /contraste 3\.\d\d:1/.test(x) && /Blanco sobre tarjeta negra/.test(x)) },
  { name: "la misma tarjeta opaca pasa (sin falso positivo)", route: { path: "/group-opaque", identify }, expect: (f) => !f.some((x) => /contraste/.test(x)) },
  { name: "texto negro sobre degradado negro falla con 1:1", route: { path: "/gradient-same", identify }, expect: (f) => f.some((x) => /contraste 1\.00:1/.test(x)) },
  { name: "degradado de negro a blanco: el peor tramo (texto blanco sobre blanco) falla", route: { path: "/gradient-worst-stop", identify }, expect: (f) => f.some((x) => /contraste 1\.00:1/.test(x)) },
  { name: "gris #757575 sobre negro-blanco: pasa en los extremos pero falla en el centro interpolado (~1,2:1)", route: { path: "/gradient-middle", identify }, expect: (f) => f.some((x) => /contraste 1\.\d\d:1/.test(x) && /Gris en el centro/.test(x)) },
  { name: "degradado negro opaco cubre la base blanca: blanco sobre negro pasa (21:1, sin falso 1:1)", route: { path: "/opaque-gradient-white-base", identify }, expect: (f) => !f.some((x) => /contraste/.test(x)) },
  { name: "degradado negro opaco con base negra pasa igual (la base no cambia el resultado)", route: { path: "/opaque-gradient-black-base", identify }, expect: (f) => !f.some((x) => /contraste/.test(x)) },
  { name: "degradado transparente deja ver la base blanca: blanco sobre blanco falla", route: { path: "/clear-gradient-white-base", identify }, expect: (f) => f.some((x) => /contraste 1\.00:1/.test(x)) },
  { name: "degradado transparente con base negra: blanco sobre negro pasa", route: { path: "/clear-gradient-black-base", identify }, expect: (f) => !f.some((x) => /contraste/.test(x)) },
  { name: "degradado negro al 50% sobre base blanca (gris) falla", route: { path: "/half-gradient-white-base", identify }, expect: (f) => f.some((x) => /contraste 3\.\d\d:1/.test(x)) },
  { name: "degradado negro al 50% sobre base negra pasa", route: { path: "/half-gradient-black-base", identify }, expect: (f) => !f.some((x) => /contraste/.test(x)) },
  { name: "capa de degradado que no cubre toda la caja deja ver la base: falla", route: { path: "/partial-gradient-white-base", identify }, expect: (f) => f.some((x) => /contraste 1\.00:1/.test(x)) },
  { name: "un enlace dentro de una frase queda exento del tamano minimo (y se declara en notas)", route: { path: "/inline-link", identify }, expect: (f) => !f.some((x) => /area tactil/.test(x)) },
  { name: "un enlace pequeno que esta solo NO queda exento", route: { path: "/small-standalone-link", identify }, expect: (f) => f.some((x) => /area tactil/.test(x) && /«Solo»/.test(x)) },
  { name: "un adorno de campo declarado (data-field-adornment) puede cubrir el input", route: { path: "/adornment-declared", identify }, expect: (f) => !f.some((x) => /solapadas|llega a/.test(x)) },
  { name: "el mismo boton sobre el input SIN declararlo es un solape y un clic desviado", route: { path: "/adornment-undeclared", identify }, expect: (f) => f.some((x) => /solapadas/.test(x)) && f.some((x) => /llega a/.test(x)) },
  { name: "un enlace en linea partido en dos renglones se sondea por renglon (sin falso positivo)", route: { path: "/wrapped-inline-link", identify }, expect: (f) => !f.some((x) => /llega a/.test(x)) },
  { name: "enlace multilinea con el SEGUNDO renglon bloqueado falla (indica el renglon)", route: { path: "/wrapped-second-line-blocked", identify }, expect: (f) => f.some((x) => /renglon 2 de/.test(x) && /llega a/.test(x)) },
  { name: "enlace multilinea con el ULTIMO renglon bloqueado falla (indica el renglon)", route: { path: "/wrapped-last-line-blocked", identify }, expect: (f) => f.some((x) => /renglon \d+ de (\d+)/.test(x) && /llega a/.test(x)) },
  { name: "varios enlaces pequenos dentro de un <nav> NO quedan exentos", route: { path: "/nav-small-links", identify }, expect: (f) => ["Inicio", "Tecnicos", "Contacto"].every((name) => f.some((x) => /area tactil/.test(x) && x.includes(`«${name}»`))) },
  { name: "varios enlaces pequenos en el mismo contenedor, sin frase, NO quedan exentos", route: { path: "/bare-small-links", identify }, expect: (f) => ["Primero", "Segundo", "Tercero"].every((name) => f.some((x) => /area tactil/.test(x) && x.includes(`«${name}»`))) },
  { name: "una transicion larga se espera a que termine: no se mide a media opacidad", route: { path: "/settling-transition", identify }, expect: (f) => f.length === 0 },
  { name: "una animacion infinita no bloquea ni invalida la auditoria", route: { path: "/infinite-animation", identify }, expect: (f) => f.length === 0 },
  { name: "pagina protegida sin sesion redirige al login y falla (URL final)", route: { path: "/private", identify }, expect: (f) => f.some((x) => /redireccion inesperada/.test(x)) },
  { name: "con sesion demo (as: customer) la pagina protegida se audita y pasa", route: { path: "/private", identify, as: "customer", loginPath: "/demo-login" }, expect: (f) => f.length === 0 },
  { name: "si el boton demo no inicia sesion, se informa (no se audita la pagina de login por error)", route: { path: "/private", identify, as: "customer", loginPath: "/demo-login-broken" }, expect: (f) => f.some((x) => /no salio de/.test(x)) },
  { name: "sin boton de cuenta demo se explica la causa (falta NEXT_PUBLIC_DEMO_MODE)", route: { path: "/private", identify, as: "customer", loginPath: "/demo-login-nobuttons" }, expect: (f) => f.some((x) => /NEXT_PUBLIC_DEMO_MODE/.test(x)) },
  { name: "si el login no responde se informa como fallo de la ruta (no aborta la corrida)", route: { path: "/private", identify, as: "customer", loginPath: "/hang", timeout: 1500, attempts: 1 }, expect: (f) => f.some((x) => /no se pudo iniciar sesion/.test(x)) },
  { name: "rol de sesion desconocido falla", route: { path: "/private", identify, as: "invitado", loginPath: "/demo-login" }, expect: (f) => f.some((x) => /rol de sesion desconocido/.test(x)) },
  { name: "una navegacion que no responde se informa como fallo de esa ruta (no aborta la corrida)", route: { path: "/hang", identify, timeout: 1500, attempts: 1 }, expect: (f) => f.some((x) => /no se pudo cargar la ruta/.test(x)) },
  { name: "una barra fija sobre contenido que hace scroll no cuenta como solape (y los controles siguen alcanzables)", route: { path: "/fixed-bar", identify }, expect: (f) => !f.some((x) => /solapadas|llega a/.test(x)) },
  { name: "una capa fija a pantalla completa que traga clics SI se detecta (hit test)", route: { path: "/fixed-bar-over-control", identify }, expect: (f) => f.some((x) => /llega a/.test(x)) },
  { name: "texto de bajo contraste en un boton deshabilitado no es hallazgo (WCAG 1.4.3, inactivo)", route: { path: "/disabled-low-contrast", identify }, expect: (f) => !f.some((x) => /contraste/.test(x)) },
  { name: "el mismo texto en un boton habilitado SI es hallazgo", route: { path: "/enabled-low-contrast", identify }, expect: (f) => f.some((x) => /contraste/.test(x) && /Guardar cambio/.test(x)) },
  { name: "un placeholder de bajo contraste es hallazgo (no es un nodo de texto, se mide aparte)", route: { path: "/placeholder-low", identify }, expect: (f) => f.some((x) => /contraste/.test(x) && /placeholder «Correo electronico»/.test(x)) },
  { name: "un placeholder con contraste suficiente pasa", route: { path: "/placeholder-ok", identify }, expect: (f) => !f.some((x) => /placeholder/.test(x)) },
  { name: "un enlace estirado (::after inset 0) se mide por el area real de la tarjeta, no por su texto", route: { path: "/stretched-link", identify, minControls: 1 }, expect: (f) => !f.some((x) => /area tactil/.test(x)) },
  { name: "tarjeta estirada con borde de 2 px y nada encima pasa (el borde del contenedor no es parte del area del ::after)", route: { path: "/stretched-clean", identify }, expect: (f) => !f.some((x) => /llega a|area tactil/.test(x)) },
  { name: "franja bloqueadora de 10 px abajo se detecta (borde inferior)", route: { path: "/stretched-bottom-10", identify }, expect: (f) => f.some((x) => /borde inferior/.test(x) && /llega a/.test(x)) },
  { name: "franja bloqueadora de solo 2 px abajo se detecta", route: { path: "/stretched-bottom-2", identify }, expect: (f) => f.some((x) => /borde inferior/.test(x) && /llega a/.test(x)) },
  { name: "franja bloqueadora de 10 px arriba se detecta (borde superior)", route: { path: "/stretched-top-10", identify }, expect: (f) => f.some((x) => /borde superior/.test(x) && /llega a/.test(x)) },
  { name: "franja bloqueadora de 6 px a la derecha se detecta (borde derecho)", route: { path: "/stretched-right-6", identify }, expect: (f) => f.some((x) => /borde derecho/.test(x) && /llega a/.test(x)) },
  { name: "franja bloqueadora de 3 px a la izquierda se detecta (borde izquierdo)", route: { path: "/stretched-left-3", identify }, expect: (f) => f.some((x) => /borde izquierdo/.test(x) && /llega a/.test(x)) },
  { name: "un enlace estirado cuyo borde inferior esta cubierto se detecta en el hit test", route: { path: "/stretched-link-covered", identify }, expect: (f) => f.some((x) => /llega a/.test(x) && /Camila Rojas/.test(x)) },
  { name: "un h1 seguido de un h3 es un salto de encabezado", route: { path: "/heading-skip", identify }, expect: (f) => f.some((x) => /salto de encabezado: h3/.test(x)) },
  { name: "h1, h2, h3 y volver a h2 no es salto", route: { path: "/heading-ok", identify }, expect: (f) => !f.some((x) => /salto de encabezado/.test(x)) },
  { name: "un enlace con caja (inline-flex) junto a texto narrativo NO queda exento", route: { path: "/boxed-link-near-text", identify }, expect: (f) => f.some((x) => /area tactil/.test(x) && /Enlace caja/.test(x)) },
  { name: "un enlace dentro de una frase en un <nav> tampoco se exime (los grupos de navegacion nunca son en linea)", route: { path: "/nav-with-sentence", identify }, expect: (f) => f.some((x) => /area tactil/.test(x) && /enlace en nav/.test(x)) },
  { name: "degradado claro con texto negro pasa", route: { path: "/gradient-ok", identify }, expect: (f) => !f.some((x) => /contraste/.test(x)) },
  { name: "degradado no interpretable se informa como NO VERIFICADO", route: { path: "/gradient-unparsable", identify }, expect: (f) => f.some((x) => /NO VERIFICADO/.test(x)) },
  { name: "cobertura solo del borde superior del area ampliada falla", route: { path: "/covered-edge", identify }, expect: (f) => f.some((x) => /borde superior/.test(x) && /«Compacto»/.test(x)) },
];

for (const space of otherSpaces) cases.push({ name: `interpolacion "in ${space}" se informa como NO VERIFICADO (no se interpola como sRGB)`, route: { path: spacePath(space), identify }, expect: (f) => f.some((x) => /NO VERIFICADO/.test(x)) });
cases.push({ name: 'interpolacion "in srgb" explicita si esta soportada: se mide y pasa (centro purpura oscuro)', route: { path: "/space-srgb-explicit", identify }, expect: (f) => f.length === 0 });
cases.push({ name: "interpolacion por defecto (sRGB) se mide y pasa", route: { path: "/space-default", identify }, expect: (f) => f.length === 0 });

let failed = 0;
for (const testCase of cases) {
  const { failures } = await auditRoute({ browser, base, route: testCase.route, scheme: "light", viewport });
  const ok = testCase.expect(failures);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${testCase.name}${ok ? "" : "\n      hallazgos: " + JSON.stringify(failures)}`);
}
await browser.close();
server.close();
console.log(failed === 0 ? `\n${cases.length}/${cases.length} autopruebas del auditor OK` : `\n${failed} autopruebas FALLARON`);
process.exit(failed === 0 ? 0 : 1);
