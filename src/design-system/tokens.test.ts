import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");

function block(selector: string): Record<string, [number, number, number]> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("\n  }", start));
  const tokens: Record<string, [number, number, number]> = {};
  for (const match of body.matchAll(/--([a-z-]+):\s*(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%;/g)) tokens[match[1]] = [Number(match[2]), Number(match[3]), Number(match[4])];
  return tokens;
}

function luminance([h, s, l]: [number, number, number]): number {
  const sat = s / 100, light = l / 100, a = sat * Math.min(light, 1 - light);
  const f = (n: number) => { const k = (n + h / 30) % 12; return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  const [r, g, b] = [f(0), f(8), f(4)].map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Every text-on-surface pairing the components use. Each must reach WCAG AA (4.5:1) in both themes.
const pairs: ReadonlyArray<readonly [string, string]> = [
  ["foreground", "background"], ["card-foreground", "card"], ["muted-foreground", "background"], ["muted-foreground", "card"], ["muted-foreground", "muted"],
  ["primary-foreground", "primary"], ["primary", "background"], ["primary", "card"], ["secondary-foreground", "secondary"], ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"], ["destructive-soft-foreground", "destructive-soft"], ["success-soft-foreground", "success-soft"],
  ["warning-soft-foreground", "warning-soft"], ["info-soft-foreground", "info-soft"], ["success-foreground", "success"], ["info-foreground", "info"],
  ["inverse-foreground", "inverse"], ["inverse-muted", "inverse"], ["inverse-accent", "inverse"],
];

describe.each([[":root"], [".dark"]])("design tokens %s", (selector) => {
  const tokens = { ...block(":root"), ...(selector === ".dark" ? block(".dark") : {}) };

  it.each(pairs)("%s on %s reaches AA contrast (4.5:1)", (fg, bg) => {
    expect(tokens[fg], `missing token --${fg}`).toBeDefined();
    expect(tokens[bg], `missing token --${bg}`).toBeDefined();
    expect(ratio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("motion safety net", () => {
  it("neutralises animation, transitions and the scroll-reveal hiding under prefers-reduced-motion", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain("animation-duration: 1ms !important");
    expect(reduced).toContain("transition-duration: 1ms !important");
    expect(reduced).toContain('.reveal[data-armed="true"] { opacity: 1; transform: none; }');
    expect(reduced).toContain(".skeleton::after { display: none; }");
  });

  it("only hides content once a component has armed it (server HTML is never hidden by CSS alone)", () => {
    expect(css).not.toMatch(/\.js\s+\.reveal/);
    expect(css).toMatch(/\.reveal\[data-armed="true"\]\s*\{\s*opacity: 0/);
  });
});

describe("surface/text pairing in components", () => {
  it("inverse (always-dark) surfaces never use theme text tokens, which flip with the theme (text-background/foreground/muted-foreground)", () => {
    const offenders: string[] = [];
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => { const path = join(dir, entry); return statSync(path).isDirectory() ? walk(path) : path.endsWith(".tsx") && !path.includes(".test.") ? [path] : []; });
    for (const file of walk("src")) {
      readFileSync(file, "utf8").split("\n").forEach((line, index) => {
        for (const match of line.matchAll(/className="([^"]*\bbg-inverse\b[^"]*)"/g)) {
          if (/\btext-(background|foreground|muted-foreground)\b/.test(match[1])) offenders.push(`${file}:${index + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
