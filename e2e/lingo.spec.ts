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
});
