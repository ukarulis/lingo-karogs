import { expect, type Page } from "@playwright/test";

export async function skipOnboarding(page: Page): Promise<void> {
  const skip = page.getByRole("button", { name: "Izlaist pamācību" });
  // The onboarding dialog opens after mount; wait briefly for it to appear.
  await expect(skip).toBeVisible({ timeout: 8000 }).catch(() => undefined);
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await expect(skip).toBeHidden();
  }
}

export async function typeWord(page: Page, word: string): Promise<void> {
  for (const ch of word) {
    await page.getByRole("button", { name: new RegExp(`^Burts ${ch}`) }).click();
  }
}

export async function pressEnter(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Apstiprināt" }).click();
}

export async function clickCell(page: Page, coord: string): Promise<void> {
  await page.getByRole("gridcell", { name: new RegExp(`^${coord}: `) }).click();
}

/** Click through own pieces until one exposes legal destinations, then move. */
export async function moveAnyPiece(
  page: Page,
  ownPiecePattern: RegExp,
): Promise<void> {
  const cells = page.getByRole("gridcell", { name: ownPiecePattern });
  const count = await cells.count();
  for (let i = 0; i < count; i++) {
    await cells.nth(i).click();
    const emptyDest = page
      .getByRole("gridcell", { name: /Tukšs lauciņš, iespējamais gājiens/ })
      .first();
    const anyDest = page
      .getByRole("gridcell", { name: /iespējamais gājiens/ })
      .first();
    if (await emptyDest.isVisible().catch(() => false)) {
      await emptyDest.click();
      return;
    }
    if (await anyDest.isVisible().catch(() => false)) {
      await anyDest.click();
      return;
    }
  }
  throw new Error("No own piece with legal moves found");
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}
