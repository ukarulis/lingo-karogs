// Captures README screenshots against a running production server.
// Usage: npm run build && npm run start -- --port 3100  (in another terminal)
//        node scripts/capture-screenshots.mjs

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = path.resolve(import.meta.dirname, "..", "docs", "screenshots");
fs.mkdirSync(OUT, { recursive: true });

const seededStats = {
  "lk.lingoStats": JSON.stringify({
    daily: {
      "2026-11-04": { date: "2026-11-04", word: "avots", won: true, attempts: 3 },
      "2026-11-05": { date: "2026-11-05", word: "balle", won: true, attempts: 4 },
      "2026-11-06": { date: "2026-11-06", word: "cirvis", won: true, attempts: 2 },
    },
    endless: {
      total: 14, wins: 11, losses: 3, distribution: [1, 4, 4, 1, 1],
      totalSolved: 14, currentStreak: 2, bestStreak: 6,
    },
    arcade: { sessions: 3, bestScore: 2050, lastScore: 900, totalWords: 12, totalPoints: 3900, bestWordCount: 7 },
  }),
  "lk.karogsStats": JSON.stringify([
    { id: "1", opponent: "ai-hard", result: "win", moves: 74, durationSec: 640, flagCaptured: true, spyKilledMarshal: true, bombDefused: true, date: "2026-11-04T10:00:00Z" },
    { id: "2", opponent: "ai-medium", result: "win", moves: 91, durationSec: 830, flagCaptured: true, spyKilledMarshal: false, bombDefused: true, date: "2026-11-05T10:00:00Z" },
    { id: "3", opponent: "ai-easy", result: "loss", moves: 55, durationSec: 410, flagCaptured: false, spyKilledMarshal: false, bombDefused: false, date: "2026-11-06T10:00:00Z" },
    { id: "4", opponent: "online", result: "win", moves: 102, durationSec: 1200, flagCaptured: true, spyKilledMarshal: true, bombDefused: false, date: "2026-11-07T10:00:00Z" },
  ]),
  "lk.achievements": JSON.stringify({
    "lingo-first-win": 1, "lingo-first-try": 1, "lingo-daily-5": 1,
    "karogs-first-win": 1, "karogs-hard-ai": 1, "karogs-spy": 1, "karogs-defuse": 1,
  }),
  "lk.lingoOnboarded": "true",
  "lk.karogsOnboarded": "true",
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript((stats) => {
  for (const [k, v] of Object.entries(stats)) {
    localStorage.setItem(k, v);
  }
}, seededStats);

const shots = [
  ["/", "home.png"],
  ["/lingo", "lingo.png"],
  ["/karogs", "karogs.png"],
  ["/statistika", "statistika.png"],
];

for (const [url, file] of shots) {
  await page.goto(BASE + url);
  await page.waitForTimeout(1800);
  if (url === "/karogs") {
    await page.getByRole("button", { name: /Sabalansētā/ }).first().click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  console.log("captured", file);
}

await browser.close();
