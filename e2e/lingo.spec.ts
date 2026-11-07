import { expect, test } from "@playwright/test";
import {
  pressEnter,
  skipOnboarding,
  typeWord,
} from "./helpers";

test.describe("Lingo", () => {
  test("homepage launches Lingo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Lingo & Karogs" })).toBeVisible();
    await page.getByRole("link", { name: /Atmini piecu burtu vārdu!/ }).click();
    await expect(page).toHaveURL(/\/lingo/);
    await expect(page.getByRole("heading", { name: "Lingo", exact: true })).toBeVisible();
  });

  test("completes a daily Lingo win and persists after refresh", async ({ page }) => {
    await page.goto("/lingo?word=ābols");
    await skipOnboarding(page);
    await typeWord(page, "ābols");
    await pressEnter(page);
    await expect(page.getByRole("heading", { name: "Vārds atminēts! 🎉" })).toBeVisible();

    // Persistence across refresh.
    await page.reload();
    await expect(page.getByRole("button", { name: "Skatīt rezultātu" })).toBeVisible();
    await page.getByRole("button", { name: "Skatīt rezultātu" }).click();
    await expect(page.getByRole("heading", { name: "Vārds atminēts! 🎉" })).toBeVisible();
    await page.getByRole("button", { name: "Aizvērt" }).click();

    // Statistics update.
    await page.goto("/statistika");
    await expect(page.getByText("Pabeigti raundi", { exact: false })).toBeVisible();
  });

  test("completes a daily Lingo loss", async ({ page }) => {
    await page.goto("/lingo?word=ābols");
    await skipOnboarding(page);
    for (const w of ["ābele", "ādene", "ādere", "āksts", "āmurs"]) {
      await typeWord(page, w);
      await pressEnter(page);
    }
    await expect(page.getByRole("heading", { name: "Neizdevās šoreiz" })).toBeVisible();
    await expect(page.getByText("ĀBOLS")).toBeVisible();
  });

  test("supports physical keyboard input and accessibility labels", async ({ page }) => {
    await page.goto("/lingo?word=ābols");
    await skipOnboarding(page);
    await page.keyboard.type("ābols");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Vārds atminēts! 🎉" })).toBeVisible();
    await expect(page.getByLabel("Burts a")).toBeVisible();
  });

  test("starts and finishes an arcade session", async ({ page }) => {
    await page.goto("/lingo?arcadeword=ābols&arcadelives=1");
    await skipOnboarding(page);
    await page.getByRole("radio", { name: "Klasiskais Lingo" }).click();
    await expect(page.getByLabel("1 dzīvības no 10")).toBeAttached();
    for (const w of ["ābele", "ādene", "ādere", "āksts", "āmurs"]) {
      await typeWord(page, w);
      await pressEnter(page);
    }
    await expect(page.getByText("Spēle beigusies — dzīvības izsmeltas")).toBeVisible();
    await expect(page.getByText("Galarezultāts:", { exact: false })).toBeVisible();
  });

  test("clears editable input after an accepted guess", async ({ page }) => {
    await page.goto("/lingo?word=ābols");
    await skipOnboarding(page);
    await typeWord(page, "ābele");
    await pressEnter(page);
    await page.waitForTimeout(700);
    // The submitted row is done; the current row keeps only the hint letter.
    const empties = page
      .getByRole("group", { name: "Spēles laukums" })
      .getByLabel("Tukšs lauciņš");
    // 1 submitted row + current row (hint + 4 empty) + 3 empty rows = 19.
    await expect(empties).toHaveCount(19);
    // Rapid Enter must not resubmit the same word.
    await pressEnter(page);
    await pressEnter(page);
    await page.waitForTimeout(300);
    await expect(empties).toHaveCount(19);
  });

  test("reports duplicates without consuming an attempt", async ({ page }) => {
    await page.goto("/lingo?word=ābols");
    await skipOnboarding(page);
    await typeWord(page, "ābele");
    await pressEnter(page);
    await page.waitForTimeout(700);
    await typeWord(page, "ābele");
    await pressEnter(page);
    await expect(page.getByText("Šo vārdu jau mēģināji.")).toBeVisible();
    // The duplicate stays editable and no second row was created.
    await expect(
      page.getByRole("group", { name: "Spēles laukums" }).getByLabel(/pareizi|citā vietā|nav vārdā/),
    ).toHaveCount(5);
  });

  test("keeps an invalid word editable for correction", async ({ page }) => {
    await page.goto("/lingo?word=ābols");
    await skipOnboarding(page);
    await typeWord(page, "ābcde");
    await pressEnter(page);
    await expect(page.getByText("Šāds vārds nav vārdnīcā")).toBeVisible();
    // The typed letters remain in the row and backspace still works.
    await page.getByRole("button", { name: /Dzēst burtu/ }).click();
    await expect(
      page.getByRole("group", { name: "Spēles laukums" }).getByLabel("Tukšs lauciņš"),
    ).toHaveCount(21);
  });
});
