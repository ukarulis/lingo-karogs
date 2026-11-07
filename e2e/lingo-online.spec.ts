import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { skipOnboarding } from "./helpers";

const pool4 = JSON.parse(
  fs.readFileSync("src/lib/lingo/data/lv/length-4.json", "utf8"),
) as {
  targets: string[];
};
const BATTLE_WORDS = pool4.targets.slice(0, 5);

async function openOnlineTab(page: import("@playwright/test").Page) {
  await skipOnboarding(page);
  await page.getByRole("radio", { name: "Spēlēt ar draugu" }).click();
}

async function setNickname(
  page: import("@playwright/test").Page,
  nick: string,
) {
  await page.getByPlaceholder("Spēlētājs").fill(nick);
}

async function typeMpWord(
  page: import("@playwright/test").Page,
  word: string,
) {
  for (const ch of word) {
    await page
      .getByRole("button", { name: new RegExp(`^Burts ${ch}`) })
      .click();
  }
  await page.getByRole("button", { name: "Apstiprināt" }).click();
}

async function waitForInput(page: import("@playwright/test").Page) {
  await expect(
    page.getByRole("button", { name: "Apstiprināt" }),
  ).toBeEnabled({ timeout: 25000 });
}

test.describe("Lingo online multiplayer", () => {
  test("quick duel: create, join, play, consistent results", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    await a.goto("/lingo");
    await openOnlineTab(a);
    await setNickname(a, "Anna");
    await a.getByRole("radio", { name: "4 burti" }).click();
    await a.getByRole("button", { name: "Izveidot istabu" }).click();
    await expect(a.locator("span.font-mono")).toBeVisible({ timeout: 15000 });
    const code = (await a.locator("span.font-mono").textContent())!.trim();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);

    await b.goto(`/lingo?room=${code}`);
    await openOnlineTab(b);
    await setNickname(b, "Berta");
    await b.getByRole("button", { name: "Pievienoties" }).click();
    await expect(b.getByText("Berta").first()).toBeVisible({ timeout: 15000 });

    await a.getByRole("button", { name: "Esmu gatavs" }).click();
    await b.getByRole("button", { name: "Esmu gatavs" }).click();
    await expect(a.getByText("Spēle sākas pēc")).toBeVisible({ timeout: 15000 });
    await expect(b.getByText("Spēle sākas pēc")).toBeVisible({ timeout: 15000 });

    // Both receive the same first-letter clue; the target is "abra".
    await expect(a.getByRole("group", { name: "Spēles laukums" })).toBeVisible({
      timeout: 20000,
    });
    await expect(b.getByRole("group", { name: "Spēles laukums" })).toBeVisible({
      timeout: 20000,
    });
    // No answer-related enrichment may leak while the round is active.
    await expect(a.getByText("Avots: Tēzaurs.lv")).toHaveCount(0);
    await expect(b.getByText("Avots: Tēzaurs.lv")).toHaveCount(0);

    // Anna solves in one guess; Berta needs two.
    await waitForInput(a);
    await waitForInput(b);
    await typeMpWord(a, "abra");
    await typeMpWord(b, "abcb");
    await typeMpWord(b, "abra");

    await expect(a.getByText("Tu uzvarēji!")).toBeVisible({ timeout: 20000 });
    await expect(b.getByText("Pretinieks uzvarēja")).toBeVisible({
      timeout: 20000,
    });
    await expect(a.getByRole("cell", { name: "abra" })).toBeVisible();
    await expect(b.getByRole("cell", { name: "abra" })).toBeVisible();
    // Once resolved, the enrichment card appears for both players.
    await expect(a.getByText("Avots: Tēzaurs.lv").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(b.getByText("Avots: Tēzaurs.lv").first()).toBeVisible({
      timeout: 15000,
    });
    await ctxA.close();
    await ctxB.close();
  });

  test("five-word battle: extensions, scores and rematch", async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    await a.goto("/lingo");
    await openOnlineTab(a);
    await setNickname(a, "Anna");
    await a.getByRole("radio", { name: "4 burti" }).click();
    await a.getByRole("radio", { name: "Piecu vārdu cīņa" }).click();
    await a.getByRole("button", { name: "Izveidot istabu" }).click();
    const code = (await a.locator("span.font-mono").textContent())!.trim();

    await b.goto(`/lingo?room=${code}`);
    await openOnlineTab(b);
    await setNickname(b, "Berta");
    await b.getByRole("button", { name: "Pievienoties" }).click();
    await a.getByRole("button", { name: "Esmu gatavs" }).click();
    await b.getByRole("button", { name: "Esmu gatavs" }).click();

    await expect(a.getByText("Kārta 1/5", { exact: false })).toBeVisible({
      timeout: 20000,
    });
    await waitForInput(a);
    await waitForInput(b);

    // Host uses one time extension: budget 3 -> 2, button becomes disabled.
    const extend = a.getByRole("button", { name: /Pagarināt \+15 s/ });
    await extend.click();
    await expect(
      a.getByRole("button", { name: /Pagarināt \+15 s \(2\/3\)/ }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      a.getByRole("button", { name: /Pagarināt \+15 s \(2\/3\)/ }),
    ).toBeDisabled();

    // Play interleaved so both players stay in the same round.
    for (let round = 0; round < BATTLE_WORDS.length; round++) {
      const word = BATTLE_WORDS[round];
      await typeMpWord(a, word);
      // The board shows only the current round's own guesses.
      await expect(
        a
          .getByRole("group", { name: "Spēles laukums" })
          .getByLabel(/pareizi|citā vietā|nav vārdā/),
      ).toHaveCount(word.length, { timeout: 15000 });
      await typeMpWord(b, `${word[0]}bcd`);
      await expect(
        b
          .getByRole("group", { name: "Spēles laukums" })
          .getByLabel(/pareizi|citā vietā|nav vārdā/),
      ).toHaveCount(word.length, { timeout: 15000 });
      await typeMpWord(b, word);
      // B's final guess may resolve the round and switch to the next one;
      // progress is verified via the round indicator below.
      if (round < BATTLE_WORDS.length - 1) {
        // Between-round transition is server-controlled (5s) plus a poll.
        await expect(
          a.getByText(`Kārta ${round + 2}/${BATTLE_WORDS.length}`, {
            exact: false,
          }),
        ).toBeVisible({ timeout: 20000 });
        await waitForInput(a);
        await waitForInput(b);
      }
    }

    await expect(a.getByText("Tu uzvarēji!")).toBeVisible({ timeout: 25000 });
    await expect(b.getByText("Pretinieks uzvarēja")).toBeVisible({
      timeout: 25000,
    });
    // Round-by-round table with revealed words on both clients.
    for (const word of BATTLE_WORDS) {
      await expect(a.getByRole("cell", { name: word })).toBeVisible();
      await expect(b.getByRole("cell", { name: word })).toBeVisible();
    }

    // Rematch: both request; a new room is created with both slots filled.
    await a.getByRole("button", { name: "Revanšs" }).click();
    await expect(a.getByText("Gaida pretinieku…")).toBeVisible();
    await b.getByRole("button", { name: "Revanšs" }).click();
    await expect(a.getByRole("button", { name: "Turpināt uz revanšu" })).toBeVisible({
      timeout: 15000,
    });
    await expect(b.getByRole("button", { name: "Turpināt uz revanšu" })).toBeVisible({
      timeout: 15000,
    });
    await a.getByRole("button", { name: "Turpināt uz revanšu" }).click();
    await b.getByRole("button", { name: "Turpināt uz revanšu" }).click();
    await expect(a.getByRole("button", { name: "Esmu gatavs" })).toBeVisible({
      timeout: 15000,
    });
    await expect(b.getByRole("button", { name: "Esmu gatavs" })).toBeVisible({
      timeout: 15000,
    });
    await ctxA.close();
    await ctxB.close();
  });

  test("reconnect restores the player slot and guess history", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    await a.goto("/lingo");
    await openOnlineTab(a);
    await setNickname(a, "Anna");
    await a.getByRole("radio", { name: "4 burti" }).click();
    await a.getByRole("button", { name: "Izveidot istabu" }).click();
    const code = (await a.locator("span.font-mono").textContent())!.trim();
    await b.goto(`/lingo?room=${code}`);
    await openOnlineTab(b);
    await setNickname(b, "Berta");
    await b.getByRole("button", { name: "Pievienoties" }).click();
    await a.getByRole("button", { name: "Esmu gatavs" }).click();
    await b.getByRole("button", { name: "Esmu gatavs" }).click();
    await expect(b.getByRole("group", { name: "Spēles laukums" })).toBeVisible({
      timeout: 25000,
    });
    await waitForInput(b);
    // AltGr diacritic input works in the multiplayer board too.
    await b.evaluate(() => {
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
    await expect(
      b.getByRole("group", { name: "Spēles laukums" }).getByLabel("ā"),
    ).toBeVisible();
    await b.getByRole("button", { name: /Dzēst burtu/ }).click();
    await typeMpWord(b, "abcb");
    await expect(
      b
        .getByRole("group", { name: "Spēles laukums" })
        .getByLabel(/pareizi|citā vietā|nav vārdā/),
    ).toHaveCount(4);

    // Reload the guest: the saved session restores the same slot.
    await b.reload();
    await openOnlineTab(b);
    await expect(
      b
        .getByRole("group", { name: "Spēles laukums" })
        .getByLabel(/pareizi|citā vietā|nav vārdā/),
    ).toHaveCount(4, { timeout: 15000 });
    await ctxA.close();
    await ctxB.close();
  });

  test("idempotent actions and authorization rejections", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/lingo");
    await openOnlineTab(page);
    await setNickname(page, "Anna");
    await page.getByRole("button", { name: "Izveidot istabu" }).click();
    await expect(page.locator("span.font-mono")).toBeVisible();
    const code = (await page.locator("span.font-mono").textContent())!.trim();

    const results = await page.evaluate(async (roomCode) => {
      const created = JSON.parse(
        localStorage.getItem("lk.lingoMp:last") ?? "{}",
      ) as { matchId?: string };
      const session = JSON.parse(
        localStorage.getItem(`lk.lingoMp:${created.matchId}`) ?? "{}",
      ) as { playerToken?: string; matchId?: string };
      const action = async (actionId: string) => {
        const res = await fetch(
          `/api/lingo-mp/${session.matchId}/action`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              token: session.playerToken,
              action: { actionId, type: "cancel" },
            }),
          },
        );
        return res.status;
      };
      const first = await action("e2e-ready-idempotent");
      const second = await action("e2e-ready-idempotent");
      const forged = await fetch(`/api/lingo-mp/${session.matchId}`, {
        headers: { "x-player-token": "forged-token-value" },
      });
      const secretProbe = await fetch(`/api/lingo-mp/${session.matchId}`, {
        headers: { "x-player-token": session.playerToken ?? "" },
      });
      const viewText = await secretProbe.text();
      return {
        first,
        second,
        forgedStatus: forged.status,
        containsAbra: viewText.includes("abra"),
        roomCode,
      };
    }, code);

    expect(results.first).toBe(200);
    expect(results.second).toBe(200);
    expect(results.forgedStatus).toBe(403);
    // The lobby view never contains any target word.
    expect(results.containsAbra).toBe(false);
    await ctx.close();
  });
});
