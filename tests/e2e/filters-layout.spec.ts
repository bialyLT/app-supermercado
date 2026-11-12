import { expect, test } from "@playwright/test";
import { admin, authenticateAdmin, enabled } from "./helpers/auth";

const ROUTES = [
  { path: "/admin/sales", label: "ventas" },
  { path: "/admin/cash-shifts/history", label: "historial de cajas" },
  { path: "/admin/inventory", label: "inventario" },
];

const WIDTHS = [320, 768, 1024, 1440, 2560];

test.describe("Barras de filtros sin solapamiento (KAN-10)", () => {
  test.skip(!enabled, "Requires disposable PostgreSQL gate database and runtime roles");

  test.afterAll(async () => {
    if (enabled) await admin.$disconnect();
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000);
    await authenticateAdmin(page);
  });

  for (const route of ROUTES) {
    test(`${route.label}: ningún control se solapa entre 320 y 2560 px`, async ({ page }) => {
      await page.goto(route.path);
      const filters = page.locator('form[class*="filters"]').first();
      await expect(filters).toBeVisible();

      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });

        const violations = await filters.evaluate((form) => {
          const boxes = [...form.children].map((el) => el.getBoundingClientRect());
          let overlaps = 0;
          for (let i = 0; i < boxes.length; i += 1) {
            for (let j = i + 1; j < boxes.length; j += 1) {
              const a = boxes[i];
              const b = boxes[j];
              const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (overlapX > 1 && overlapY > 1) overlaps += 1;
            }
          }
          const box = form.getBoundingClientRect();
          const overflowing = [...form.querySelectorAll("button")]
            .filter((button) => button.getBoundingClientRect().right > box.right + 1).length;
          return { overlaps, overflowing, scrollX: form.scrollWidth > form.clientWidth + 1 };
        });

        expect(violations, `${route.path} a ${width}px`).toEqual({
          overlaps: 0,
          overflowing: 0,
          scrollX: false,
        });
      }

      await page.setViewportSize({ width: 1280, height: 900 });
    });
  }
});
