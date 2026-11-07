import { expect, test } from "@playwright/test";
import { moveAnyPiece, skipOnboarding } from "./helpers";

test("creates and joins an online game and completes it", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.goto("/karogs");
  await skipOnboarding(pageA);
  await pageA.getByRole("radio", { name: "Spēlēt ar draugu" }).click();
  await pageA.getByPlaceholder("Spēlētājs").fill("Anna");
  await pageA.getByRole("button", { name: "Izveidot istabu" }).click();
  await expect(pageA.getByText("Gaidi pretinieku…")).toBeVisible({ timeout: 15_000 });
  const code = await pageA
    .locator("span.font-mono")
    .first()
    .textContent();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  await pageB.goto(`/karogs/${code}`);
  await skipOnboarding(pageB);
  await pageB.getByPlaceholder("Spēlētājs").fill("Bērziņš");
  await pageB.getByRole("button", { name: "Pievienoties", exact: true }).click();

  // Both players set up and ready up.
  for (const p of [pageA, pageB]) {
    await p.getByRole("button", { name: "Izveidot nejauši" }).click();
    await expect(p.getByText("40/40")).toBeVisible();
    await p.getByRole("button", { name: "Gatavs kaujai" }).click();
  }
  await expect(pageA.getByText("Tava kārta")).toBeVisible({ timeout: 30_000 });

  // Red (Anna) makes a legal move.
  await moveAnyPiece(pageA, /^[A-J](1|2|3|4): sarkanā (?!bumba|karogs)/);

  // Blue sees the turn switch to them (server synchronized).
  await expect(pageB.getByText("Tava kārta")).toBeVisible({ timeout: 20_000 });

  // Refresh/resume: blue reloads and reconnects to the same game.
  await pageB.reload();
  await expect(pageB.getByRole("grid", { name: "Kaujas laukums" })).toBeVisible({ timeout: 20_000 });

  // Complete the match: Anna resigns; Bērziņš wins.
  await pageA.getByRole("button", { name: "Padoties" }).click();
  await expect(pageB.getByText("Uzvara! 🎉")).toBeVisible({ timeout: 20_000 });
  await expect(pageB.getByText("pretinieks padevās", { exact: false })).toBeVisible();
  await expect(pageA.getByText("Zaudējums")).toBeVisible();

  // The finished game is server-verified: leaderboard becomes available.
  await pageB.goto("/statistika");
  await expect(pageB.getByRole("heading", { name: /Tiešsaistes līderu tabula/ })).toBeVisible();

  await contextA.close();
  await contextB.close();
});

test("rejects joining a nonexistent room", async ({ page }) => {
  await page.goto("/karogs/ZZZZZZ");
  await skipOnboarding(page);
  await page.getByPlaceholder("Spēlētājs").fill("Tests");
  await page.getByRole("button", { name: "Pievienoties", exact: true }).click();
  await expect(page.getByText("Istaba nav atrasta")).toBeVisible();
});
