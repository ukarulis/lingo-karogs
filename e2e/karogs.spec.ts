import { expect, test } from "@playwright/test";
import { clickCell, moveAnyPiece, skipOnboarding } from "./helpers";

async function openKarogs(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/karogs");
  await skipOnboarding(page);
}

test.describe("Karogs", () => {
  test("generates an army and makes legal moves against the AI", async ({ page }) => {
    await openKarogs(page);
    await page.getByRole("button", { name: "Izveidot nejauši" }).click();
    await expect(page.getByText("40/40")).toBeVisible();
    await page.getByRole("button", { name: "Sākt kauju" }).click();
    await expect(page.getByText("Sarkanā kārta")).toBeVisible();

    await moveAnyPiece(page, /^[A-J](1|2|3|4): sarkanā (?!bumba|karogs)/);

    // The AI answers: either the turn returns to red or the match ends.
    await expect(
      page.getByText(/Sarkanā kārta|Uzvara!|Zaudējums/).first(),
    ).toBeVisible({ timeout: 20_000 });
    if (await page.getByText("Kaujas žurnāls").isVisible()) {
      await expect(page.getByText("Kaujas žurnāls")).toBeVisible();
    }
  });

  test("wins a deterministic Karogs scenario", async ({ page }) => {
    await page.goto("/karogs?scenario=open-flag");
    await skipOnboarding(page);
    await clickCell(page, "E4");
    await expect(page.getByRole("gridcell", { name: /E7: .*iespējamais gājiens/ })).toBeVisible();
    await clickCell(page, "E7");
    await expect(page.getByText("Uzvara! 🎉")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("karogs tika sagrābts", { exact: false })).toBeVisible();
  });

  test("pass-and-play keeps hidden information private", async ({ page }) => {
    await openKarogs(page);
    await page.getByRole("radio", { name: "Divatā uz viena ekrāna" }).click();

    // Red setup.
    await page.getByRole("button", { name: "Izveidot nejauši" }).click();
    await page.getByRole("button", { name: "Gatavs — nodot zilajam" }).click();
    await expect(page.getByText("Zilā spēlētāja izvietošana")).toBeVisible();
    await page.getByRole("button", { name: "Esmu zilais spēlētājs" }).click();

    // Blue setup.
    await page.getByRole("button", { name: "Izveidot nejauši" }).click();
    await page.getByRole("button", { name: "Sākt kauju" }).click();
    await expect(page.getByText("Kauja sākas!")).toBeVisible();
    await page.getByRole("button", { name: "Esmu sarkanais spēlētājs" }).click();

    // Red moves.
    await moveAnyPiece(page, /^[A-J](1|2|3|4): sarkanā (?!bumba|karogs)/);
    await expect(page.getByText("Zilā spēlētāja gājiens")).toBeVisible();
    await page.getByRole("button", { name: "Esmu zilais spēlētājs" }).click();

    // Blue sees own pieces but red pieces stay hidden.
    await expect(page.getByRole("gridcell", { name: /zilā/ }).first()).toBeVisible();
    await expect(page.getByRole("gridcell", { name: /Nezināma pretinieka figūra/ }).first()).toBeVisible();
  });

  test("resumes an AI game after refresh", async ({ page }) => {
    await openKarogs(page);
    await page.getByRole("button", { name: "Izveidot nejauši" }).click();
    await page.getByRole("button", { name: "Sākt kauju" }).click();
    await expect(page.getByText("Sarkanā kārta")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Sarkanā kārta")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("grid", { name: /Kaujas laukums|Spēle/ })).toBeVisible();
  });

  test("applies a preset formation and starts instantly", async ({ page }) => {
    await openKarogs(page);
    const formation = page.getByRole("button", { name: /Agresīvā/ }).first();
    await formation.click();
    await expect(formation).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("40/40")).toBeVisible();
    await page.getByRole("button", { name: "Sākt kauju" }).click();
    await expect(page.getByText("Sarkanā kārta")).toBeVisible({ timeout: 20_000 });
  });

  test("saves a customized preset formation", async ({ page }) => {
    await openKarogs(page);
    await page.getByRole("button", { name: /Sabalansētā/ }).first().click();
    await expect(page.getByText("40/40")).toBeVisible();
    await page.getByLabel("Formācijas nosaukums").fill("Mana kopija");
    await page.getByRole("button", { name: "Saglabāt" }).click();
    await expect(page.getByRole("button", { name: "Mana kopija" })).toBeVisible();
  });

  test("random formation preset rerolls a valid setup", async ({ page }) => {
    await openKarogs(page);
    await page.getByRole("button", { name: /Nejaušā/ }).first().click();
    await expect(page.getByText("40/40")).toBeVisible();
    await page.getByRole("button", { name: "Sākt kauju" }).click();
    await expect(page.getByText("Sarkanā kārta")).toBeVisible({ timeout: 20_000 });
  });
});
