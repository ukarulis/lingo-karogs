// Post-deployment verification: visits every route and checks the V1.2
// headline features plus console cleanliness.
// Usage: node scripts/verify-production.mjs [base-url]

import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "https://lingo-karogs.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 160));
});
const log = (n, ok) => console.log(`${ok ? "PASS" : "FAIL"}  ${n}`);

for (const route of ["/", "/karogs", "/lingo", "/iestatijumi", "/statistika", "/ka-spelet", "/par-projektu"]) {
  await page.goto(`${BASE}${route}`);
  await page.waitForTimeout(1800);
  const skip = page.getByRole("button", { name: "Izlaist pamācību" });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(300);
  }
}

await page.goto(`${BASE}/karogs`);
await page.waitForTimeout(1500);
log("instant-play 40/40", await page.getByText("40/40").isVisible().catch(() => false));
await page.getByRole("button", { name: "Izvēlēties formāciju" }).click();
log(
  "formation picker",
  await page.getByRole("button", { name: /Agresīvā/ }).first().isVisible().catch(() => false),
);
await page.goto(`${BASE}/lingo`);
await page.waitForTimeout(1500);
log(
  "diacritics keyboard",
  await page.getByRole("button", { name: "Burts ā" }).isVisible().catch(() => false),
);
await page.goto(`${BASE}/iestatijumi`);
await page.waitForTimeout(1200);
log(
  "saved-games panel",
  await page.getByText("Spēļu progress").isVisible().catch(() => false),
);
log("no console errors across all routes", errors.length === 0);
if (errors.length) console.log(errors.slice(0, 4).join("\n"));
await browser.close();
process.exit(errors.length ? 1 : 0);
