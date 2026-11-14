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

const pages = {
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
