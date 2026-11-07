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
    await page.getByRole("button", { name: "Aizvērt" }).click();
    // Word-discovery card appears after resolution without blocking play.
    await expect(page.getByText("Ābeles auglis", { exact: false })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Avots: Tēzaurs.lv", { exact: false })).toBeVisible();

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
    for (const w of ["ālsoa", "ādene", "ādere", "āksts", "āmurs"]) {
      await typeWord(page, w);
      await pressEnter(page);
    }
    await expect(page.getByRole("heading", { name: "Neizdevās šoreiz" })).toBeVisible();
    await expect(page.getByText(/Vārds bija “ĀBOLS”/)).toBeVisible();
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
    // "ālsoa" locks nothing beyond the revealed first letter, so the current
    // row keeps the hint plus four editable empty cells after the accept.
    await typeWord(page, "ālsoa");
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

  test("carries confirmed letters into the next row", async ({ page }) => {
    await page.goto("/lingo?word=ābols");
    await skipOnboarding(page);
    // "ābele" vs "ābols": positions 0, 1 and 3 are correct and become locked.
    await typeWord(page, "ābele");
    await pressEnter(page);
    await page.waitForTimeout(700);
    const group = page.getByRole("group", { name: "Spēles laukums" });
    // Done row (5) + current row with 3 locked hints and 2 empty cells
    // + 3 untouched rows (15) = 17 empty cells.
    await expect(group.getByLabel("Tukšs lauciņš")).toHaveCount(17);
    await expect(group.getByLabel("b").first()).toBeVisible();
    await expect(group.getByLabel("l").first()).toBeVisible();
  });

  test("daily freeform accepts an invented sequence and consumes one attempt", async ({ page }) => {
    await page.goto("/lingo?word=ābols");
    await skipOnboarding(page);
    await typeWord(page, "ābcde");
    await pressEnter(page);
    await page.waitForTimeout(700);
    // The invented sequence was accepted: exactly one submitted row exists.
    await expect(
      page.getByRole("group", { name: "Spēles laukums" }).getByLabel(/pareizi|citā vietā|nav vārdā/),
    ).toHaveCount(5);
    await expect(page.getByText("Šāds vārds nav vārdnīcā")).toBeHidden();
    await expect(page.getByText("1 mēģinājumi izmantoti")).toBeAttached();
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

  test("classic dictionary policy keeps an invalid word editable for correction", async ({ page }) => {
    await page.goto("/lingo?arcadeword=ābols&arcadelives=5");
    await skipOnboarding(page);
    await page.getByRole("radio", { name: "Klasiskais Lingo" }).click();
    await typeWord(page, "ābcde");
    await pressEnter(page);
    await expect(page.getByText("Šāds vārds nav vārdnīcā")).toBeVisible();
    // The typed letters remain in the row and backspace still works.
    await page.getByRole("button", { name: /Dzēst burtu/ }).click();
    await expect(
      page.getByRole("group", { name: "Spēles laukums" }).getByLabel("Tukšs lauciņš"),
    ).toHaveCount(21);
    // No attempt was consumed.
    await expect(page.getByLabel("5 dzīvības no 10")).toBeAttached();
  });

  test("recovers a legacy daily save with duplicate guesses and blocks further duplicates", async ({ page }) => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Riga",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    await page.addInitScript(
      ({ saveDate }) => {
        const row = ["correct", "correct", "absent", "correct", "absent"];
        const now = new Date().toISOString();
        window.localStorage.setItem(
          "lk.lingoDaily",
          JSON.stringify({
            v: 2,
            createdAt: now,
            updatedAt: now,
            status: "playing",
            data: {
              date: saveDate,
              round: {
                mode: "daily",
                target: "ābols",
                firstLetter: "ā",
                guesses: ["ābele", "ābele"],
                results: [row, row],
                revealed: [false, false, false, false, false],
                status: "playing",
                attemptsUsed: 2,
              },
            },
          }),
        );
      },
      { saveDate: today },
    );
    await page.goto("/lingo?word=ābols");
    await skipOnboarding(page);
    const labeled = page
      .getByRole("group", { name: "Spēles laukums" })
      .getByLabel(/pareizi|citā vietā|nav vārdā/);
    // Both duplicated legacy rows render.
    await expect(labeled).toHaveCount(10);
    // Re-submitting the same word is blocked and consumes no attempt.
    await typeWord(page, "ābele");
    await pressEnter(page);
    await expect(page.getByText("Šo vārdu jau mēģināji.")).toBeVisible();
    await expect(labeled).toHaveCount(10);
  });

  test("unlimited plays a four-letter round, continues and recovers after refresh", async ({ page }) => {
    await page.goto("/lingo?endlesslen=4&endlessword=akls");
    await skipOnboarding(page);
    await page.getByRole("radio", { name: "Neierobežotā" }).click();
    await expect(page.getByRole("radio", { name: "4 burti" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await typeWord(page, "akls");
    await pressEnter(page);
    await expect(page.getByText("“AKLS” atminēts ar 1. mēģinājumu!")).toBeVisible();
    // The next word keeps the four-letter board.
    await page.getByRole("button", { name: /Nākamais vārds/ }).click();
    const rowCells = page
      .getByRole("group", { name: "Spēles laukums" })
      .locator('[role="row"]')
      .first()
      .getByRole("gridcell");
    await expect(rowCells).toHaveCount(4);
    // Refresh restores the in-progress four-letter session.
    await page.reload();
    await skipOnboarding(page);
    await page.getByRole("radio", { name: "Neierobežotā" }).click();
    await expect(
      page
        .getByRole("group", { name: "Spēles laukums" })
        .locator('[role="row"]')
        .first()
        .getByRole("gridcell"),
    ).toHaveCount(4);
    await expect(page.getByRole("checkbox", { name: "Viegli vārdi" })).toBeVisible();
  });

  test("unlimited plays a seven-letter round with freeform guesses and locked letters", async ({ page }) => {
    await page.goto("/lingo?endlesslen=7&endlessword=āboliņš");
    await skipOnboarding(page);
    await page.getByRole("radio", { name: "Neierobežotā" }).click();
    const board = page.getByRole("group", { name: "Spēles laukums" });
    await expect(
      board.locator('[role="row"]').first().getByRole("gridcell"),
    ).toHaveCount(7);
    // A freeform invented guess is accepted and consumes exactly one attempt.
    await typeWord(page, "ābcdefg");
    await pressEnter(page);
    await expect(board.getByLabel(/pareizi|citā vietā|nav vārdā/)).toHaveCount(7);
    // Solving works when typing the complete word incl. locked letters.
    await typeWord(page, "āboliņš");
    await pressEnter(page);
    await expect(
      page.getByText("“ĀBOLIŅŠ” atminēts ar 2. mēģinājumu!"),
    ).toBeVisible();
  });

  test("switching word lengths preserves each session", async ({ page }) => {
    await page.goto("/lingo?endlesslen=4&endlessword=akls");
    await skipOnboarding(page);
    await page.getByRole("radio", { name: "Neierobežotā" }).click();
    await typeWord(page, "akls");
    await pressEnter(page);
    await expect(page.getByText(/“AKLS” atminēts/)).toBeVisible();
    // A five-letter game is a separate session.
    await page.getByRole("radio", { name: "5 burti" }).click();
    await expect(
      page
        .getByRole("group", { name: "Spēles laukums" })
        .locator('[role="row"]')
        .first()
        .getByRole("gridcell"),
    ).toHaveCount(5);
    await expect(page.getByText(/“AKLS” atminēts/)).toBeHidden();
    // Returning to four letters restores the finished round.
    await page.getByRole("radio", { name: "4 burti" }).click();
    await expect(page.getByText(/“AKLS” atminēts/)).toBeVisible();
  });

  test("random mode picks a valid length and persists across refresh", async ({ page }) => {
    await page.goto("/lingo?endlesslen=random");
    await skipOnboarding(page);
    await page.getByRole("radio", { name: "Neierobežotā" }).click();
    const board = page.getByRole("group", { name: "Spēles laukums" });
    const cells = board.locator('[role="row"]').first().getByRole("gridcell");
    const n = await cells.count();
    expect(n).toBeGreaterThanOrEqual(4);
    expect(n).toBeLessThanOrEqual(7);
    const firstLabel = await cells
      .first()
      .getAttribute("aria-label")
      .then((l) => (l ?? "a").slice(0, 1).toLowerCase());
    await typeWord(page, firstLabel + "abcdefg".slice(0, n - 1));
    await pressEnter(page);
    await expect(board.getByLabel(/pareizi|citā vietā|nav vārdā/)).toHaveCount(n);
    // Refresh and return to unlimited: the session continues.
    await page.reload();
    await skipOnboarding(page);
    await page.getByRole("radio", { name: "Neierobežotā" }).click();
    await expect(board.getByLabel(/pareizi|citā vietā|nav vārdā/)).toHaveCount(n);
  });

  test("shows a color legend matching the active palette", async ({ page }) => {
    await page.goto("/lingo");
    await skipOnboarding(page);
    await expect(page.getByLabel("Burtu krāsu skaidrojums")).toBeVisible();
    await expect(page.getByText("Pareizā vietā")).toBeVisible();
    await expect(page.getByText("Nav vārdā")).toBeVisible();
  });

  test("physical AltGr and dead-key input produces Latvian letters", async ({ page }) => {
    await page.goto("/lingo?word=ābols");
    await skipOnboarding(page);
    // Windows AltGr arrives as Ctrl+Alt+<key>; the handler must accept it.
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ā",
          code: "KeyA",
          ctrlKey: true,
          altKey: true,
          bubbles: true,
        }),
      );
    });
    await page.keyboard.type("bols");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Vārds atminēts! 🎉" }),
    ).toBeVisible();
  });

  test("Ctrl shortcuts and foreign letters are never typed", async ({ page }) => {
    await page.goto("/lingo?word=ābols");
    await skipOnboarding(page);
    const board = page.getByRole("group", { name: "Spēles laukums" });
    const empties = board.getByLabel("Tukšs lauciņš");
    await expect(empties).toHaveCount(24);
    await page.keyboard.press("Control+KeyA");
    await page.keyboard.press("Control+KeyC");
    await page.keyboard.type("qwx"); // not in the Latvian alphabet
    await expect(empties).toHaveCount(24);
    // A dead key followed by the composed letter inserts exactly once.
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Dead", bubbles: true }),
      );
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ē", bubbles: true }),
      );
    });
    await expect(board.getByLabel("ē", { exact: true })).toBeVisible();
    await expect(empties).toHaveCount(23);
    await page.getByRole("button", { name: /Dzēst burtu/ }).click();
    await expect(empties).toHaveCount(24);
  });

  test("decomposed input normalizes into a single cell", async ({ page }) => {
    await page.goto("/lingo?word=ābols");
    await skipOnboarding(page);
    const board = page.getByRole("group", { name: "Spēles laukums" });
    // "i" + combining macron must become one ī grapheme (ā would match the
    // already locked hint and be consumed, not inserted).
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "i\u0304", bubbles: true }),
      );
    });
    await expect(board.getByLabel("ī", { exact: true })).toBeVisible();
    await expect(board.getByLabel("Tukšs lauciņš")).toHaveCount(23);
  });

  test("every on-screen diacritic key inserts its letter", async ({ page }) => {
    await page.goto("/lingo?word=ābols");
    await skipOnboarding(page);
    const board = page.getByRole("group", { name: "Spēles laukums" });
    const diacritics = ["ā", "ē", "ī", "ū", "ķ", "ļ", "ņ", "ģ", "š", "ž", "č"];
    for (const letter of diacritics) {
      // ā is already the locked hint; the others insert one at a time.
      await page.getByRole("button", { name: `Burts ${letter}` }).click();
      if (letter !== "ā") {
        await expect(
          board.getByLabel(letter, { exact: true }),
        ).toBeVisible();
        await page.getByRole("button", { name: /Dzēst burtu/ }).click();
      }
    }
    // The layout never exposes letters outside the Latvian alphabet.
    for (const foreign of ["q", "w", "x", "y"]) {
      await expect(page.getByRole("button", { name: `Burts ${foreign}` })).toHaveCount(0);
    }
  });
});
