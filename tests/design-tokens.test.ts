import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app", "components"];

/** Action blues that are not part of the design tokens. */
const FORBIDDEN_HEX = ["#1d4ed8", "#2563eb", "#1e40af"];

function cssModules(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...cssModules(full));
    else if (entry.endsWith(".module.css")) files.push(full);
  }
  return files;
}

describe("design token contract for action colours", () => {
  const files = ROOTS.flatMap((root) => cssModules(join(process.cwd(), root)));

  it("finds the CSS modules it is meant to audit", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("never hardcodes an action blue outside the design tokens", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8").toLowerCase();
      for (const hex of FORBIDDEN_HEX) {
        if (content.includes(hex)) offenders.push(`${relative(process.cwd(), file)} -> ${hex}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("drives the operational filter buttons from the primary token", () => {
    const file = join(process.cwd(), "components", "operational-read", "operational-read.module.css");
    const content = readFileSync(file, "utf8");
    expect(content).toContain("var(--color-primary-hover");
  });
});
