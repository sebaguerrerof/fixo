import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { brand, brandTitle } from "./brand";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sources(path) : /\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
  });
}

const normalized = (path: string) => path.replaceAll("\\", "/");
// The module that owns the name, and the wordmark that renders it as two styled spans.
const authorised = (path: string) => normalized(path).endsWith("design-system/brand.ts") || normalized(path).endsWith("shared/logo.tsx");

function offendersFor(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const file of sources("src").filter((path) => !authorised(path))) {
    readFileSync(file, "utf8").split("\n").forEach((line, index) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (pattern.test(line)) found.push(`${normalized(file)}:${index + 1}`);
    });
  }
  return found;
}

describe("SoyFixo brand", () => {
  it("exposes the product name and builds page titles from it", () => {
    expect(brand.name).toBe("SoyFixo");
    expect(brandTitle("Ingresar")).toBe("Ingresar | SoyFixo");
    expect(brandTitle()).toContain("SoyFixo");
  });

  it("is written only in design-system/brand.ts: every other file imports it (comments and technical identifiers are exempt)", () => {
    expect(offendersFor(/\bSoyFixo\b/)).toEqual([]);
  });

  it("never shows the legacy bare name in user-visible strings", () => {
    expect(offendersFor(/(?<!Soy)\bFixo\b/)).toEqual([]);
  });
});
