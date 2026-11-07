import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, skipOnboarding } from "./helpers";

async function adjacentGaps(locator: ReturnType<import("@playwright/test").Page["getByRole"]>) {
  const count = await locator.count();
  const boxes = [];
  for (let i = 0; i < count; i++) boxes.push(await locator.nth(i).boundingBox());
  const gaps: number[] = [];
  for (let i = 1; i < boxes.length; i++) {
    const a = boxes[i - 1];
    const b = boxes[i];
    if (!a || !b) continue;
    const stacked = a.y + a.height <= b.y + 1;
    const gap = stacked
      ? b.y - (a.y + a.height)
      : b.x - (a.x + a.width);
    gaps.push(Math.round(gap * 10) / 10);
  }
  return gaps;
}

const VIEWPORTS = [
  { name: "320px", width: 320, height: 667 },
  { name: "375px", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 900 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`geometry at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("Lingo mode labels are separated and readable", async ({ page }) => {
      await page.goto("/lingo");
      await skipOnboarding(page);
      const gaps = await adjacentGaps(page.locator('button[role="radio"]'));
      expect(gaps.length).toBeGreaterThanOrEqual(2);
      for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(4);
    });

    test("Karogs mode cards do not overlap", async ({ page }) => {
      await page.goto("/karogs");
      await skipOnboarding(page);
      const gaps = await adjacentGaps(page.getByRole("radiogroup").first().locator("button"));
      for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(0);
    });

    test("nickname input has a normal height", async ({ page }) => {
      await page.goto("/karogs");
      await skipOnboarding(page);
      await page.getByRole("radio", { name: /Spēlēt ar draugu/ }).click();
      const input = page.getByPlaceholder("Spēlētājs").first();
      await expect(input).toBeVisible();
      const box = await input.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(38);
      expect(box!.height).toBeLessThanOrEqual(56);
    });

    test("no horizontal overflow on core routes", async ({ page }) => {
      for (const route of ["/", "/lingo", "/karogs", "/iestatijumi", "/statistika"]) {
        await page.goto(route);
        await skipOnboarding(page);
        await assertNoHorizontalOverflow(page);
      }
    });

    test("board is visible and interactive", async ({ page }) => {
      await page.goto("/karogs");
      await skipOnboarding(page);
      await expect(page.getByText("40/40")).toBeVisible();
      const grid = page.getByRole("grid", { name: /Tavs izvietojums/ });
      await expect(grid).toBeVisible();
      await grid.getByRole("gridcell").first().click();
    });
  });
}

test("dialogs fit the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/iestatijumi");
  await page.getByRole("button", { name: "Dzēst visus vietējos datus" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(320);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(568);
});
