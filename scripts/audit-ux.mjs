// Measurement-driven UX audit. Runs against a live dev/prod server and prints
// findings as JSON so defects can be verified without eyeballing pixels.
// Usage: node scripts/audit-ux.mjs [base-url]

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = path.resolve(process.cwd(), "docs", "screenshots", "v1.2", "audit");
fs.mkdirSync(OUT, { recursive: true });

const findings = [];
const note = (severity, area, message, detail = "") =>
  findings.push({ severity, area, message, detail });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

async function boxes(locator) {
  const count = await locator.count();
  const out = [];
  for (let i = 0; i < count; i++) out.push(await locator.nth(i).boundingBox());
  return out;
}

function overlap(a, b) {
  if (!a || !b) return 0;
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  return Math.round(x * 10) / 10;
}

async function skipOnboarding(p) {
  const skip = p.getByRole("button", { name: "Izlaist pamācību" });
  await skip.waitFor({ state: "visible", timeout: 6000 }).catch(() => undefined);
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await p.waitForTimeout(400);
  }
}

// ---- 1. Lingo mode selector ----
await page.goto(`${BASE}/lingo`);
await skipOnboarding(page);
await page.waitForTimeout(800);
const lingoTabs = page.locator('[role="radiogroup"] button[role="radio"]');
const lingoBoxes = await boxes(lingoTabs);
const lingoGaps = [];
for (let i = 1; i < lingoBoxes.length; i++) {
  const gap =
    Math.round((lingoBoxes[i].x - (lingoBoxes[i - 1].x + lingoBoxes[i - 1].width)) * 10) / 10;
  const ov = overlap(lingoBoxes[i - 1], lingoBoxes[i]);
  lingoGaps.push({ gap, overlap: ov });
  if (ov > 0) note("high", "lingo-mode-selector", "Mode labels overlap", `tabs ${i} and ${i + 1}`);
  if (gap < 4) note("medium", "lingo-mode-selector", "Mode labels touch/nearly touch", `gap ${gap}px`);
}
const lingoFont = await lingoTabs.first().evaluate((el) => {
  const s = getComputedStyle(el);
  return { fontSize: s.fontSize, height: Math.round(el.getBoundingClientRect().height) };
});
note(
  parseInt(lingoFont.fontSize, 10) < 13 ? "high" : "info",
  "lingo-mode-selector",
  `Tab font-size ${lingoFont.fontSize}, height ${lingoFont.height}px`,
  JSON.stringify(lingoGaps),
);
await page.screenshot({ path: path.join(OUT, "lingo-selector-desktop.png"), fullPage: false });

// ---- 2. Karogs mode + difficulty selectors ----
await page.goto(`${BASE}/karogs`);
await skipOnboarding(page);
await page.waitForTimeout(800);
const karogsTabs = page
  .locator('[role="radiogroup"]')
  .first()
  .locator('button[role="radio"]');
const kBoxes = await boxes(karogsTabs);
for (let i = 1; i < kBoxes.length; i++) {
  const ov = overlap(kBoxes[i - 1], kBoxes[i]);
  if (ov > 0) note("high", "karogs-mode-selector", "Karogs mode labels overlap", `tabs ${i} and ${i + 1}`);
}
await page.screenshot({ path: path.join(OUT, "karogs-selector-desktop.png") });

// ---- 3. Online nickname input ----
await page.getByRole("radio", { name: /Ar draugu|Spēlēt ar draugu/ }).first().click();
await page.waitForTimeout(500);
const nickInput = page.getByPlaceholder("Spēlētājs").first();
if (await nickInput.isVisible().catch(() => false)) {
  const box = await nickInput.boundingBox();
  const cs = await nickInput.evaluate((el) => {
    const s = getComputedStyle(el);
    return { height: s.height, fontSize: s.fontSize, display: s.display, parent: el.parentElement?.tagName };
  });
  note(
    box && box.height > 56 ? "high" : box && box.height > 48 ? "medium" : "info",
    "online-nickname-input",
    `Nickname input ${Math.round(box?.height ?? 0)}px tall`,
    JSON.stringify(cs),
  );
  await page.screenshot({ path: path.join(OUT, "online-nickname.png") });
}

// ---- 4. Horizontal overflow across viewports ----
const viewports = [
  [320, 667],
  [360, 800],
  [375, 812],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
];
for (const [w, h] of viewports) {
  await page.setViewportSize({ width: w, height: h });
  for (const route of ["/", "/lingo", "/karogs", "/iestatijumi", "/statistika"]) {
    await page.goto(`${BASE}${route}`);
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 1) {
      note("high", "overflow", `Horizontal overflow ${overflow}px at ${w}x${h} on ${route}`);
    }
  }
}

// ---- 5. Keyboard key sizes on small screens ----
for (const w of [320, 375, 390]) {
  await page.setViewportSize({ width: w, height: 800 });
  await page.goto(`${BASE}/lingo`);
  await skipOnboarding(page);
  await page.waitForTimeout(600);
  const keys = await boxes(page.getByRole("button", { name: /^Burts/ }));
  if (keys.length) {
    const minW = Math.min(...keys.map((k) => k.width));
    const minH = Math.min(...keys.map((k) => k.height));
    note(
      minW < 24 || minH < 32 ? "high" : minW < 30 ? "medium" : "info",
      "lingo-keyboard",
      `At ${w}px smallest key ${Math.round(minW)}x${Math.round(minH)}px`,
    );
    await page.screenshot({ path: path.join(OUT, `lingo-keyboard-${w}.png`) });
  }
}

// ---- 6. Landscape / short screen ----
await page.setViewportSize({ width: 667, height: 320 });
await page.goto(`${BASE}/lingo`);
await page.waitForTimeout(600);
const boardBox = await page
  .getByRole("group", { name: "Spēles laukums" })
  .boundingBox()
  .catch(() => null);
if (boardBox && boardBox.y + boardBox.height > 320) {
  note(
    "medium",
    "landscape",
    `Board extends past 320px viewport on landscape (bottom ${Math.round(boardBox.y + boardBox.height)})`,
  );
}
await page.screenshot({ path: path.join(OUT, "lingo-landscape.png") });

console.log(JSON.stringify(findings, null, 2));
await browser.close();
