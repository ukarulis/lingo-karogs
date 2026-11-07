import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, skipOnboarding } from "./helpers";

const MOBILE = [
  { name: "320px", width: 320, height: 568 },
  { name: "375px", width: 375, height: 812 },
  { name: "430px", width: 430, height: 932 },
];

for (const size of MOBILE) {
  test(`homepage and lingo fit ${size.name} mobile viewport`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/");
    await assertNoHorizontalOverflow(page);
    await page.getByRole("link", { name: /Atmini piecu burtu vārdu!/ }).click();
    await skipOnboarding(page);
    await expect(page.getByRole("group", { name: "Spēles laukums" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
}

test("karogs board fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/karogs");
  await skipOnboarding(page);
  await page.getByRole("button", { name: "Izveidot nejauši" }).click();
  await page.getByRole("button", { name: "Sākt kauju" }).click();
  await expect(page.getByText("Sarkanā kārta")).toBeVisible({ timeout: 20_000 });
  await assertNoHorizontalOverflow(page);
});

test("seven-letter lingo board fits a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/lingo?endlesslen=7");
  await skipOnboarding(page);
  await page.getByRole("radio", { name: "Neierobežotā" }).click();
  await expect(page.getByRole("group", { name: "Spēles laukums" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test("tablet and large desktop layouts render", async ({ page }) => {
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await assertNoHorizontalOverflow(page);
  }
});
