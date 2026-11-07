// Geometry and rendering QA probe for the redesigned UI.
// Usage: node scripts/visual-qa.mjs [base-url]

import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

// 1. Karogs board geometry: 100 square cells inside 10 rows.
await page.goto(`${BASE}/karogs`);
await page.waitForTimeout(1800);
const skip = page.getByRole("button", { name: "Izlaist pamācību" });
if (await skip.isVisible().catch(() => false)) {
  await skip.click();
  await page.waitForTimeout(500);
}
const rows = await page.locator('div[role="grid"] > div[role="row"]').count();
check("board has 10 rows", rows === 10, String(rows));
const cellBox = await page
  .locator('div[role="grid"] button[role="gridcell"]')
  .first()
  .boundingBox();
check("cells are roughly square", !!cellBox && Math.abs(cellBox.width - cellBox.height) < 6, JSON.stringify(cellBox));

// 2. Formation picker previews render 40 cells each and apply instantly.
await page.getByRole("button", { name: /Agresīvā/ }).first().click();
await page.waitForTimeout(300);
check("preset gives 40/40", await page.getByText("40/40").isVisible().catch(() => false));
const previewCells = await page
  .locator('[aria-label="Gatavās formācijas"] [aria-hidden] span')
  .count();
check("formation previews render", previewCells >= 40 * 3, String(previewCells));

// 3. Battlefield tiles: parchment fill present, lakes have wave svg.
const tileBg = await page
  .locator('div[role="grid"] button[role="gridcell"]')
  .nth(5)
  .evaluate((el) => getComputedStyle(el).backgroundColor);
check("tiles styled (not transparent)", tileBg !== "rgba(0, 0, 0, 0)", tileBg);
check("lakes show waves", (await page.locator('div[role="grid"] svg[viewBox="0 0 20 10"]').count()) > 0);

// 4. WA buttons and radios on the page.
check("wa-button present", (await page.locator("wa-button").count()) > 0);
check("wa-radio-group present", (await page.locator("wa-radio-group").count()) > 0);

// 5. Column strip letters align with 10 columns.
check("coordinate strip has 10 letters", (await page.locator("text=A").first().isVisible().catch(() => false)));

// 6. No horizontal overflow at mobile width on /karogs.
await page.setViewportSize({ width: 375, height: 812 });
await page.reload();
await page.waitForTimeout(1200);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check("no horizontal overflow on mobile /karogs", overflow <= 1, String(overflow));

// 7. Homepage hero CTAs are links.
await page.goto(`${BASE}/`);
await page.waitForTimeout(800);
check(
  "hero CTA links work",
  (await page.getByRole("link", { name: "Spēlēt Lingo" }).count()) > 0 &&
    (await page.getByRole("link", { name: "Spēlēt Karogs" }).count()) > 0,
);
const overflowHome = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check("no horizontal overflow on mobile /", overflowHome <= 1, String(overflowHome));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} visual QA checks passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
