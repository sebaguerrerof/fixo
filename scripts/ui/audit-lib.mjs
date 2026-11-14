// Core of the browser UI audit. Used by audit-ui.mjs (real pages) and test-audit-ui.mjs (negative self-tests).
// Everything here is read-only: it only loads pages and inspects them.

/**
 * Route contract. An audit only counts if the page is really the one we meant to audit:
 *  - HTTP status equals `status` (default 200),
 *  - the final pathname equals `finalPath` (default: the requested path, so unexpected redirects fail),
 *  - an identifying element (`identify.selector` whose text matches `identify.text`) is present and visible.
 */
export async function auditRoute({ browser, base, route, scheme, viewport }) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: scheme });
  const page = await context.newPage();
  const failures = [];
  let checked = 0;
  let controls = 0;
  const notes = [];
  try {
    const response = await page.goto(base + route.path, { waitUntil: "networkidle" });
    const expectedStatus = route.status ?? 200;
    if (!response) failures.push("sin respuesta HTTP");
    else if (response.status() !== expectedStatus) failures.push(`estado HTTP ${response.status()}, se esperaba ${expectedStatus}`);
    const finalPath = new URL(page.url()).pathname;
    const expectedPath = route.finalPath ?? route.path;
    if (finalPath !== expectedPath) failures.push(`URL final ${finalPath}, se esperaba ${expectedPath} (redireccion inesperada)`);
    await page.evaluate(installVisibilityHelper);
    const identify = route.identify;
    if (!identify) failures.push("la ruta no declara elemento identificador");
    else {
      // Entrance animations start transparent, so give the identifier a short window to become effectively visible.
      const found = await page.waitForFunction(({ selector, text }) => [...document.querySelectorAll(selector)].some((element) => window.__auditOpacity(element) >= window.__auditMinOpacity && new RegExp(text, "i").test(element.textContent ?? "")), { selector: identify.selector, text: identify.text }, { timeout: 3000 }).then(() => true, () => false);
      if (!found) failures.push(`no aparece el elemento identificador ${identify.selector} /${identify.text}/ visible (pagina vacia, distinta u oculta por visibility/display/opacity)`);
    }
    if (failures.length === 0) {
      // Reveal everything that animates in on scroll, then measure from the top.
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 350) { window.scrollTo(0, y); await new Promise((resolve) => setTimeout(resolve, 60)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(300);
      // Measure only a settled page: wait until no finite animation or transition is running (infinite ones, like a skeleton shimmer,
      // are ignored). Measuring mid-transition would report contrast at partial opacity, so if it never settles the audit fails.
      const settled = await page.waitForFunction(() => document.getAnimations().every((animation) => animation.effect?.getComputedTiming().endTime === Infinity || animation.playState !== "running"), null, { timeout: 6000 }).then(() => true, () => false);
      if (!settled) failures.push("la pagina no termino sus animaciones o transiciones en 6 s: medicion no fiable");
      const staticResult = await page.evaluate(staticAudit, viewport.min);
      checked = staticResult.checked;
      notes.push(...staticResult.skipped);
      controls = staticResult.controls;
      failures.push(...staticResult.failures);
      failures.push(...await page.evaluate(hitTestAudit));
      // A pass must rest on real, visible content: never a green result from an audit that measured nothing.
      const minControls = route.minControls ?? 1;
      if (checked === 0) failures.push("0 textos visibles auditados: resultado no valido (pagina sin contenido visible)");
      if (controls < minControls) failures.push(`${controls} controles visibles auditados, se esperaban al menos ${minControls}`);
    }
  } finally {
    await context.close();
  }
  return { failures: [...new Set(failures)], checked, controls, notes: [...new Set(notes)] };
}


/** Installs window.__auditOpacity(element): effective opacity = product of every ancestor's opacity; 0 if the element or an ancestor is display:none, or the element is visibility:hidden/collapse or has no box. */
export function installVisibilityHelper() {
  window.__auditMinOpacity = 0.05;
  window.__auditOpacity = (element) => {
    let opacity = 1;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none") return 0;
      opacity *= parseFloat(style.opacity);
    }
    const own = getComputedStyle(element);
    if (own.visibility !== "visible") return 0;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return 0;
    return opacity;
  };
}

/** Contrast, target size and target overlap, measured with the page at the top. Runs in the browser. */
export function staticAudit(minTarget) {
  // ---- Contrast: composite what is really painted -------------------------------------------------------------
  // For the chain html -> element, each node paints its background (colour and/or gradient) and its whole subtree is then
  // blended with the node's own opacity (group opacity). Text and background are composited TOGETHER over the page, so a
  // semi-transparent card dims both. Gradients are measured at every colour stop AND at the colours interpolated between
  // stops (worst case over the whole gradient, which is conservative: it does not locate the text inside it); any background
  // we cannot interpret is reported as NOT VERIFIED, never skipped silently.
  const parse = (value) => {
    const rgb = value.match(/rgba?\(([^)]+)\)/);
    if (rgb) { const [r, g, b, a = 1] = rgb[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; }
    const srgb = value.match(/color\(srgb ([^)]+)\)/);
    if (srgb) { const [r, g, b, a = 1] = srgb[1].split(/[ /]+/).filter(Boolean).map(Number); return { r: r * 255, g: g * 255, b: b * 255, a }; }
    return value.trim() === "transparent" ? { r: 0, g: 0, b: 0, a: 0 } : null;
  };
  const lum = ({ r, g, b }) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mixChannel = (t, b2) => (t * top.a + b2 * bottom.a * (1 - top.a)) / a;
    return { r: mixChannel(top.r, bottom.r), g: mixChannel(top.g, bottom.g), b: mixChannel(top.b, bottom.b), a };
  };
  const withOpacity = (layer, opacity) => ({ ...layer, a: layer.a * opacity });
  const OPAQUE_WHITE = { r: 255, g: 255, b: 255, a: 1 };
  const nodeCache = new Map();
  // Linear interpolation in premultiplied sRGB, which is how CSS gradients blend between two colour stops.
  const lerp = (c1, c2, t) => {
    const a = c1.a + (c2.a - c1.a) * t;
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const channel = (k) => (c1[k] * c1.a * (1 - t) + c2[k] * c2.a * t) / a;
    return { r: channel("r"), g: channel("g"), b: channel("b"), a };
  };
  // Splits a computed multi-value property ("a, b(1, 2), c") at its top-level commas.
  const splitLayers = (value) => {
    const out = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < value.length; i++) {
      const ch = value[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "," && depth === 0) { out.push(value.slice(start, i).trim()); start = i + 1; }
    }
    out.push(value.slice(start).trim());
    return out;
  };
  // Every colour a gradient layer can show: its stops plus the colours interpolated BETWEEN consecutive stops. The worst
  // contrast is often between two stops (grey text on black-to-white is worst in the middle), so the stops alone are not enough.
  function gradientColours(layer, steps) {
    if (!/gradient\(/.test(layer) || /oklch|oklab|lab\(|lch\(|color-mix|hwb\(|var\(|url\(/.test(layer)) return null;
    // Only sRGB interpolation is implemented (the default; Chromium drops an explicit "in srgb"). Any other interpolation space
    // (hsl, hwb, lab, lch, oklab, oklch, srgb-linear, display-p3, xyz, a98-rgb, rec2020, prophoto-rgb, with or without a hue
    // method such as "longer hue") paints different colours between the stops, so it is NOT VERIFIED rather than guessed.
    const space = layer.match(/\bin\s+([a-z0-9-]+)/);
    if (space && space[1] !== "srgb") return null;
    const stops = (layer.match(/rgba?\([^)]*\)|color\(srgb [^)]*\)|\btransparent\b/g) ?? []).map(parse);
    if (stops.length === 0 || stops.some((stop) => stop === null)) return null;
    const colours = [];
    for (let i = 0; i < stops.length; i++) {
      colours.push(stops[i]);
      if (i < stops.length - 1) for (let k = 1; k < steps; k++) colours.push(lerp(stops[i], stops[i + 1], k / steps));
    }
    return colours;
  }
  // Possible paint of one node at the text position; an empty list means "cannot be interpreted".
  // The background colour counts only where it can be seen: through transparency or where a layer does not cover the box
  // (explicit size or no-repeat). An opaque full-cover gradient hides it completely.
  function nodeLayers(node) {
    if (nodeCache.has(node)) return nodeCache.get(node);
    const style = getComputedStyle(node);
    const base = parse(style.backgroundColor) ?? { r: 0, g: 0, b: 0, a: 0 };
    const opacity = parseFloat(style.opacity);
    let options = [base];
    if (style.backgroundImage !== "none") {
      const images = splitLayers(style.backgroundImage);
      const sizes = splitLayers(style.backgroundSize);
      const repeats = splitLayers(style.backgroundRepeat);
      options = [];
      for (const steps of [16, 8, 4, 2]) {
        const perLayer = images.map((image, index) => {
          if (image === "none") return [null]; // nothing painted by this layer
          const colours = gradientColours(image, steps);
          if (colours === null) return undefined;
          const coversAll = ["auto", "auto auto"].includes(sizes[index % sizes.length]) && ["repeat", "repeat repeat"].includes(repeats[index % repeats.length]);
          return coversAll ? colours : [...colours, null]; // null = the layer is absent at that point
        });
        if (perLayer.some((colours) => colours === undefined)) { options = []; break; }
        const total = perLayer.reduce((product, colours) => product * colours.length, 1);
        if (total > 400) continue;
        for (let n = 0; n < total; n++) {
          let rest = n;
          let paint = base;
          for (let l = perLayer.length - 1; l >= 0; l--) {
            const colour = perLayer[l][rest % perLayer[l].length];
            rest = Math.floor(rest / perLayer[l].length);
            if (colour) paint = over(colour, paint);
          }
          options.push(paint);
        }
        break;
      }
    }
    const result = { options, opacity };
    nodeCache.set(node, result);
    return result;
  }
  function chainOf(element) {
    const chain = [];
    for (let node = element; node; node = node.parentElement) chain.unshift(node);
    return chain;
  }
  // Worst-case contrast of `fg` text inside `element`; null when some background cannot be interpreted.
  function worstContrast(element, fg) {
    const chain = chainOf(element);
    const perNode = chain.map(nodeLayers);
    if (perNode.some((entry) => entry.options.length === 0)) return null;
    let combinations = 1;
    for (const entry of perNode) combinations *= entry.options.length;
    if (combinations > 400) return null;
    let worst = Infinity;
    const pick = new Array(chain.length).fill(0);
    for (let n = 0; n < combinations; n++) {
      let rest = n;
      for (let i = chain.length - 1; i >= 0; i--) { pick[i] = rest % perNode[i].options.length; rest = Math.floor(rest / perNode[i].options.length); }
      const render = (withText) => {
        let group = { r: 0, g: 0, b: 0, a: 0 };
        for (let i = chain.length - 1; i >= 0; i--) {
          const own = perNode[i].options[pick[i]];
          const content = i === chain.length - 1 ? (withText ? over(fg, own) : own) : over(group, own);
          group = withOpacity(content, perNode[i].opacity);
        }
        return over(group, OPAQUE_WHITE);
      };
      const [text, backdrop] = [render(true), render(false)];
      const [a, b] = [lum(text), lum(backdrop)];
      worst = Math.min(worst, (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
    }
    return worst;
  }

  const failures = [];
  const skipped = [];
  let checked = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim();
    const element = node.parentElement;
    if (!text || !element || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName)) continue;
    const style = getComputedStyle(element);
    if (window.__auditOpacity(element) < window.__auditMinOpacity) continue;
    if (element.closest("nextjs-portal, [aria-hidden='true']")) continue;
    if (style.webkitTextFillColor === "rgba(0, 0, 0, 0)" || style.webkitTextFillColor === "transparent") { skipped.push(`texto con degradado, contraste no medido: «${text.slice(0, 40)}»`); continue; }
    const fg = parse(style.color);
    const where = `«${text.slice(0, 40)}»  <${element.tagName.toLowerCase()} class="${String(element.className).slice(0, 70)}">`;
    if (!fg) { failures.push(`contraste NO VERIFICADO (color de texto ilegible: ${style.color})  ${where}`); continue; }
    const ratio = worstContrast(element, fg);
    if (ratio === null) { failures.push(`contraste NO VERIFICADO (fondo con imagen o degradado no interpretable)  ${where}`); continue; }
    const size = parseFloat(style.fontSize);
    const bold = parseInt(style.fontWeight, 10) >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    checked++;
    if (ratio < need) failures.push(`contraste ${ratio.toFixed(2)}:1 < ${need}:1  ${where}`);
  }

  const interactive = [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button]")].filter((e) => {
    return window.__auditOpacity(e) >= window.__auditMinOpacity && !e.disabled && !e.closest("nextjs-portal");
  });
  const boxes = interactive.map((element) => {
    const rect = element.getBoundingClientRect();
    const before = getComputedStyle(element, "::before");
    const extra = before.content !== "none" && before.position === "absolute";
    const w = extra ? Math.max(rect.width, parseFloat(before.width) || 0) : rect.width;
    const h = extra ? Math.max(rect.height, parseFloat(before.height) || 0) : rect.height;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return { element, left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2, w, h };
  });
  const label = (e) => `<${e.tagName.toLowerCase()}> «${(e.textContent || e.getAttribute("aria-label") || e.getAttribute("name") || "").trim().slice(0, 28)}»`;
  // WCAG 2.5.8 "inline" exception: a link inside a sentence is exempt from the minimum size. It must be laid out inline
  // (display: inline) within a sentence, which means visible NARRATIVE
  // text (>= 12 characters) in the link's own block, outside any link, button or form control; links inside navigation groups
  // (<nav>, role=navigation/menu/tablist/toolbar) are never "inline". The exemption is declared in the report notes and the
  // link is still hit-tested.
  const INTERACTIVE = "a, button, input, select, textarea, [role=button], [role=link]";
  const blockOf = (element) => {
    let node = element.parentElement;
    while (node && node !== document.body && getComputedStyle(node).display.startsWith("inline")) node = node.parentElement;
    return node ?? document.body;
  };
  const narrativeLength = (block) => {
    let length = 0;
    const textWalker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let node = textWalker.nextNode(); node; node = textWalker.nextNode()) {
      const owner = node.parentElement;
      if (!owner || owner.closest(INTERACTIVE) || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(owner.tagName)) continue;
      if (window.__auditOpacity(owner) < window.__auditMinOpacity) continue;
      length += node.textContent.replace(/\s+/g, " ").trim().length;
    }
    return length;
  };
  const isInlineLink = (element) => element.tagName === "A"
    && getComputedStyle(element).display === "inline" // a link laid out as a box (inline-flex, block...) is not part of a sentence
    && !element.closest("nav, [role=navigation], [role=menu], [role=menubar], [role=tablist], [role=toolbar]")
    && narrativeLength(blockOf(element)) >= 12;
  const inlineLinks = boxes.filter((box) => isInlineLink(box.element));
  for (const box of boxes) if (!isInlineLink(box.element) && (box.w < minTarget - 0.5 || box.h < minTarget - 0.5)) failures.push(`area tactil ${Math.round(box.w)}x${Math.round(box.h)} < ${minTarget}x${minTarget}  ${label(box.element)}`);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
      if (isInlineLink(a.element) || isInlineLink(b.element)) continue; // inline links share lines by nature
      // A control declared as a field adornment (data-field-adornment, e.g. show/hide password) sits over the field it belongs to.
      const adorned = (adornment, field) => adornment.closest("[data-field-adornment]")?.parentElement?.contains(field) && !field.closest("[data-field-adornment]");
      if (adorned(a.element, b.element) || adorned(b.element, a.element)) continue;
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapX > 1 && overlapY > 1) failures.push(`areas tactiles solapadas (${Math.round(overlapY)}px)  ${label(a.element)}  <->  ${label(b.element)}`);
    }
  }
  if (inlineLinks.length > 0) skipped.push(`${inlineLinks.length} enlace(s) dentro de texto exentos del tamano minimo (WCAG 2.5.8, excepcion inline), p. ej. «${inlineLinks[0].element.textContent.trim().slice(0, 30)}»`);
  return { checked, controls: boxes.length, failures, skipped };
}

/**
 * Hit testing for EVERY control, wherever it is on the page: each one is scrolled into the middle of the viewport first,
 * then the centre and the four edges of its interactive area (rectangle plus any enlarged ::before area, clipped to the
 * viewport) are probed with elementFromPoint. A click at any of those points must reach the control or a descendant of it (a <label> that activates it, or a declared data-field-adornment inside its wrapper, are the only exceptions); an ancestor does not count, so pointer-events:none controls fail. Runs in the browser.
 */
export async function hitTestAudit() {
  const failures = [];
  const label = (e) => `<${e.tagName.toLowerCase()}> «${(e.textContent || e.getAttribute("aria-label") || e.getAttribute("name") || "").trim().slice(0, 28)}»`;
  const controls = [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button]")].filter((e) => !e.disabled && !e.closest("nextjs-portal"));
  for (const element of controls) {
    if (window.__auditOpacity(element) < window.__auditMinOpacity) continue;
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    // An inline element that wraps over several lines has one box per line: probe EVERY line box (a block over the second or last
    // line must be found), each at its centre and four edges. The enlarged ::before area only exists for single-box controls.
    const boxes = [...element.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (boxes.length === 0) boxes.push(element.getBoundingClientRect());
    const before = getComputedStyle(element, "::before");
    const extra = boxes.length === 1 && before.content !== "none" && before.position === "absolute";
    let blocked = false;
    for (const [lineIndex, rect] of boxes.entries()) {
      const w = extra ? Math.max(rect.width, parseFloat(before.width) || 0) : rect.width;
      const h = extra ? Math.max(rect.height, parseFloat(before.height) || 0) : rect.height;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const left = Math.max(cx - w / 2 + 1, 1), right = Math.min(cx + w / 2 - 1, innerWidth - 1);
      const top = Math.max(cy - h / 2 + 1, 1), bottom = Math.min(cy + h / 2 - 1, innerHeight - 1);
      const midX = Math.min(Math.max(cx, left), right), midY = Math.min(Math.max(cy, top), bottom);
      // Boxed controls are probed at their real edges (1 px inside). The line fragments of a wrapped inline element have ragged ends
      // (trailing space, sub-pixel advances), so there the side probes sit at 10% / 90% of the fragment and the vertical ones at 20% / 80%.
      const fragment = boxes.length > 1;
      const probes = fragment
        ? [["centro", cx, cy], ["borde izquierdo", rect.left + rect.width * 0.1, cy], ["borde derecho", rect.left + rect.width * 0.9, cy], ["borde superior", cx, rect.top + rect.height * 0.2], ["borde inferior", cx, rect.top + rect.height * 0.8]]
        : [["centro", midX, midY], ["borde izquierdo", left, midY], ["borde derecho", right, midY], ["borde superior", midX, top], ["borde inferior", midX, bottom]];
      const where = boxes.length > 1 ? ` (renglon ${lineIndex + 1} de ${boxes.length})` : "";
      for (const [name, x, y] of probes) {
        const hit = document.elementFromPoint(x, y);
        if (!hit) { failures.push(`el punto del ${name}${where} de ${label(element)} cae fuera de la pantalla`); blocked = true; break; }
        if (hit.closest("nextjs-portal")) continue;
        // The click must reach the control itself or one of its descendants. Exceptions, both explicit: the <label> that activates
        // it, and an adornment declared with data-field-adornment inside the field's own wrapper.
        const adornment = hit.closest("[data-field-adornment]");
        const reaches = element.contains(hit) || (hit.tagName === "LABEL" && hit.control === element) || (adornment !== null && adornment.parentElement?.contains(element));
        if (!reaches) { failures.push(`el clic en el ${name}${where} (${Math.round(x)},${Math.round(y)}) de ${label(element)} llega a ${label(hit)}`); blocked = true; break; }
      }
      if (blocked) break;
    }
  }
  window.scrollTo(0, 0);
  return failures;
}
