import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const roots = ["app", "components"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

/**
 * A missing CSS-module class is silent at runtime: `styles.missing` is
 * `undefined` and the element loses its layout with no error. This guards the
 * class contract between components and the module they import.
 */
describe("CSS module class contract", () => {
  it("every styles.X used by a component exists in its imported module", () => {
    const missing: string[] = [];

    for (const root of roots) {
      const sources = files(root).filter((file) => /\.(tsx|ts)$/.test(file));

      for (const file of sources) {
        const source = readFileSync(file, "utf8");

        for (const match of source.matchAll(/import (\w+) from "([^"]+\.module\.css)"/g)) {
          const variable = match[1];
          const cssPath = join(dirname(file), match[2]);
          const css = readFileSync(cssPath, "utf8");
          const used = new Set(
            [...source.matchAll(new RegExp(`\\b${variable}\\.([A-Za-z_][\\w-]*)`, "g"))].map(
              (entry) => entry[1],
            ),
          );

          for (const className of used) {
            if (!new RegExp(`\\.${className}\\b`).test(css)) {
              missing.push(`${relative(".", file)} -> ${variable}.${className}`);
            }
          }
        }
      }
    }

    // Gaps that already existed before the shared visual system (verified at
    // commit a4f76a1). They are reported separately and must be fixed with
    // their own brief; new entries here are a regression.
    const allowlist = [
      "components/transfers/transfer-form.tsx -> styles.lineRow",
      "components/admin-operations/settings-manager.tsx -> styles.form",
      "components/admin-operations/users-manager.tsx -> styles.form",
      "components/admin-operations/weighed-barcode-manager.tsx -> styles.form",
    ];

    expect(missing.filter((entry) => !allowlist.includes(entry))).toEqual([]);
  });
});
