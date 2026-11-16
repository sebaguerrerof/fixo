import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { customerNavigation } from "./customer-navigation";

describe("customer navigation", () => {
  it("has unique entries and every one points to a real page (no dead anchors)", () => {
    expect(new Set(customerNavigation.map((item) => item.href)).size).toBe(customerNavigation.length);
    for (const { href } of customerNavigation) {
      expect(href).not.toContain("#");
      expect(existsSync(join(process.cwd(), "src/app", href, "page.tsx")), href).toBe(true);
    }
  });
});
