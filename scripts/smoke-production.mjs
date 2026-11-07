// Production smoke test: exercises the deployed site with a real browser.
// Usage: node scripts/smoke-production.mjs [url]

import { chromium } from "@playwright/test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dictionary = require("../src/lib/lingo/data/dictionary.json");

const BASE = process.argv[2] ?? "https://lingo-karogs.vercel.app";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

try {
  // 1. Homepage
  await page.goto(BASE + "/");
  await page.getByRole("heading", { name: "Lingo & Karogs" }).waitFor();
  const html = await page.content();
  check("homepage", true);
  check("language lv", html.includes('lang="lv"'));
  check("og metadata", (await page.locator('meta[property="og:title"]').count()) > 0);

  // 2. Lingo daily: make a real guess
  await page.goto(BASE + "/lingo");
  const skip = page.getByRole("button", { name: "Izlaist pamācību" });
  await skip.waitFor({ timeout: 8000 }).catch(() => undefined);
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.waitForTimeout(500);
  const firstTile = await page
    .getByRole("group", { name: "Spēles laukums" })
    .locator("[aria-label]")
    .first()
    .getAttribute("aria-label");
  const firstLetter = (firstTile ?? "a").slice(0, 1).toLowerCase();
  const candidates = dictionary.targets.filter((w) => w.startsWith(firstLetter));
  const guess = candidates[0] ?? dictionary.guesses.filter((w) => w.startsWith(firstLetter))[0];
  for (const ch of guess) {
    await page.getByRole("button", { name: `Burts ${ch}`, exact: true }).click();
  }
  await page.getByRole("button", { name: "Apstiprināt" }).click();
  await page.waitForTimeout(800);
  const attemptsText = await page.locator("body").textContent();
  const attemptsMatch = (attemptsText ?? "").match(/(\d+) mēģinājumi izmantoti/);
  const guessAccepted = !!attemptsMatch && Number(attemptsMatch[1]) >= 1;
  check("lingo playable", guessAccepted, `guess "${guess}" (first letter ${firstLetter})`);

  // 3. Karogs vs AI
  await page.goto(BASE + "/karogs");
  const skip2 = page.getByRole("button", { name: "Izlaist pamācību" });
  await skip2.waitFor({ timeout: 8000 }).catch(() => undefined);
  if (await skip2.isVisible().catch(() => false)) await skip2.click();
  await page.getByRole("button", { name: "Izveidot nejauši" }).click();
  await page.waitForTimeout(300);
  const counter = await page.getByText("40/40").isVisible();
  await page.getByRole("button", { name: "Sākt kauju" }).click();
  await page.waitForTimeout(1000);
  const playing = await page.getByText(/Sarkanā kārta|Zilā kārta/).isVisible();
  check("karogs playable", counter && playing);

  // 4. Statistika
  await page.goto(BASE + "/statistika");
  await page.getByRole("heading", { name: "Statistika" }).waitFor();
  check("statistika", true);

  // 5. Multiplayer backend status
  const health = await page.evaluate(async () =>
    (await fetch("/api/health")).json(),
  );
  check(
    "health endpoint",
    health.status === "ok" && typeof health.multiplayer?.mode === "string",
    JSON.stringify(health.multiplayer),
  );
  const create = await page.evaluate(async () => {
    const res = await fetch("/api/multiplayer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nickname: "SmokeTests",
        guestHash: "smoke-guest-hash",
        playerToken: "smoke-player-token",
      }),
    });
    return { status: res.status, body: await res.json() };
  });
  check(
    "multiplayer endpoint honest",
    create.status === 503 ||
      (create.status === 200 && !!create.body.gameId) ||
      create.status === 429,
    `HTTP ${create.status}`,
  );

  // 6. No runtime errors on the pages we visited
  check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
} catch (err) {
  check("smoke run", false, String(err));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
