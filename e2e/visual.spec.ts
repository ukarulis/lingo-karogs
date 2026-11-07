import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./helpers";

// Visual regression suite. Baselines live next to this file in
// `visual.spec.ts-snapshots/` and are updated intentionally with:
//   npx playwright test e2e/visual.spec.ts --update-snapshots

test.describe("visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("homepage game cards", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { name: "Lingo & Karogs" }).waitFor();
    await expect(
      page
        .locator("div.grid")
        .filter({ has: page.getByRole("link", { name: /Atmini piecu burtu/ }) }),
    ).toHaveScreenshot("home-cards.png");
  });

  test("lingo board", async ({ page }) => {
    await page.goto("/lingo");
    await skipOnboarding(page);
    await expect(page.getByRole("group", { name: "Spēles laukums" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Spēles laukums" })).toHaveScreenshot(
      "lingo-board.png",
    );
  });

  test("karogs formation picker and board", async ({ page }) => {
    await page.goto("/karogs");
    await skipOnboarding(page);
    await page.getByRole("button", { name: "Izvēlēties formāciju" }).click();
    await page.getByRole("button", { name: /Sabalansētā/ }).first().click();
    await expect(page.getByText("40/40")).toBeVisible();
    await expect(page.getByRole("grid", { name: /Tavs izvietojums/ })).toHaveScreenshot(
      "karogs-setup.png",
    );
    await expect(page.locator('[aria-label="Gatavās formācijas"]')).toHaveScreenshot(
      "karogs-formations.png",
    );
  });

  test("statistics page", async ({ page }) => {
    await page.goto("/statistika");
    await page.getByRole("heading", { name: "Statistika" }).waitFor();
    await expect(page.locator('section[aria-labelledby="lingo-stats-title"]')).toHaveScreenshot("statistika-lingo.png", {
      maxDiffPixels: 400,
    });
    await expect(page.locator('section[aria-labelledby="karogs-stats-title"]')).toHaveScreenshot(
      "statistika-karogs.png",
      { maxDiffPixels: 400 },
    );
    await expect(page.locator('section[aria-labelledby="ach-title"]')).toHaveScreenshot(
      "statistika-achievements.png",
      { maxDiffPixels: 400 },
    );
  });

  test("settings page", async ({ page }) => {
    await page.goto("/iestatijumi");
    await page.getByRole("heading", { name: "Iestatījumi" }).waitFor();
    await expect(page.locator("main")).toHaveScreenshot("iestatijumi.png", {
      maxDiffPixels: 400,
    });
  });
});
