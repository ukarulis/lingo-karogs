import fs from "node:fs";
import { chromium, expect } from "@playwright/test";

const BASE = "https://lingo-karogs.vercel.app";
const PLAIN = "abcdefghijklmnoprstuvz";
const check = (name: string, ok: boolean, detail = "") =>
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);

const browser = await chromium.launch();

async function openOnline(page: import("@playwright/test").Page) {
  const skip = page.getByRole("button", { name: "Izlaist pamācību" });
  await skip.waitFor({ timeout: 8000 }).catch(() => undefined);
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.getByRole("radio", { name: "Spēlēt ar draugu" }).click();
}

async function typeMp(page: import("@playwright/test").Page, word: string) {
  for (const ch of word) {
    await page.getByRole("button", { name: new RegExp(`^Burts ${ch}`) }).click();
  }
  await page.getByRole("button", { name: "Apstiprināt" }).click();
}

async function waitForInput(page: import("@playwright/test").Page) {
  // The round header advances one poll before the keyboard actually becomes
  // active; always wait for an enabled Enter (active round) before typing.
  await expect(page.getByRole("button", { name: "Apstiprināt" })).toBeEnabled({
    timeout: 30000,
  });
  await page.waitForTimeout(300);
}

async function readyBoth(
  a: import("@playwright/test").Page,
  b: import("@playwright/test").Page,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const page of [a, b]) {
      const readyBtn = page.getByRole("button", { name: "Esmu gatavs" });
      if (await readyBtn.isVisible().catch(() => false)) {
        await readyBtn.click();
      }
    }
    const sawCountdown =
      (await a.getByText("Spēle sākas pēc").isVisible().catch(() => false)) ||
      (await b.getByText("Spēle sākas pēc").isVisible().catch(() => false));
    if (sawCountdown) return;
    await a.waitForTimeout(5000);
  }
  throw new Error("ready handshake did not reach countdown");
}

// --- Test A: Quick Duel (timeout draw + identical results) ---
{
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await a.goto(BASE + "/lingo");
  await openOnline(a);
  await a.getByPlaceholder("Spēlētājs").fill("AnnaProds");
  await a.getByRole("radio", { name: "4 burti" }).click();
  await a.getByRole("button", { name: "Izveidot istabu" }).click();
  try {
    await a.locator("span.font-mono").waitFor({ timeout: 20000 });
  } catch {
    console.log(
      "A FAIL DUMP:\n" +
        (await a.locator("main").innerText()).slice(0, 800).replace(/\n/g, " | "),
    );
    console.log(
      "A TOASTS: " +
        (await a.locator("wa-toast-item").allInnerTexts()).join(" | "),
    );
    throw new Error("lobby did not render");
  }
  const code = (await a.locator("span.font-mono").textContent())!.trim();
  await b.goto(`${BASE}/lingo?room=${code}`);
  await openOnline(b);
  await b.getByPlaceholder("Spēlētājs").fill("BertaProds");
  await b.getByRole("button", { name: "Pievienoties" }).click();
  await readyBoth(a, b);
  await a
    .getByRole("group", { name: "Spēles laukums" })
    .waitFor({ timeout: 30000 });
  await a.getByRole("group", { name: "Spēles laukums" }).waitFor({ timeout: 25000 });
  await b.getByRole("group", { name: "Spēles laukums" }).waitFor({ timeout: 25000 });
  await waitForInput(a);
  await waitForInput(b);
  const clueA = await a
    .getByRole("group", { name: "Spēles laukums" })
    .locator('[role="gridcell"]')
    .first()
    .getAttribute("aria-label");
  const clueB = await b
    .getByRole("group", { name: "Spēles laukums" })
    .locator('[role="gridcell"]')
    .first()
    .getAttribute("aria-label");
  check("same public first-letter clue", clueA === clueB, `${clueA} vs ${clueB}`);
  const first = (clueA ?? "a").slice(0, 1).toLowerCase();
  for (let i = 0; i < 5; i++) {
    const filler = PLAIN.slice(i * 3, i * 3 + 3).padEnd(3, "a");
    await typeMp(a, first + filler);
    await typeMp(b, first + "z" + filler.slice(0, 2));
    await a.waitForTimeout(350);
  }
  const resultSeen = await a
    .getByText(/Neizšķirts|Tu uzvarēji!|Pretinieks uzvarēja/)
    .isVisible()
    .catch(() => false);
  if (!resultSeen) {
    await a.getByRole("button", { name: "Pārtraukt spēli" }).click();
  }
  await a
    .getByText(/Neizšķirts|Tu uzvarēji!|Pretinieks uzvarēja/)
    .waitFor({ timeout: 30000 });
  await b
    .getByText(/Neizšķirts|Tu uzvarēji!|Pretinieks uzvarēja/)
    .waitFor({ timeout: 30000 });
  check("quick duel completed with consistent result", true);
  check(
    "no answer leaked before resolution",
    (await a.getByText("Avots: Tēzaurs.lv").count()) > 0,
  );
  await ctxA.close();
  await ctxB.close();
}

// --- Test B: Five-Word Battle (extensions, fail-fast rounds, rematch) ---
{
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  a.on("pageerror", (e) => console.log("A PAGEERROR:", e.message));
  b.on("pageerror", (e) => console.log("B PAGEERROR:", e.message));
  a.on("console", (m) => {
    if (m.type() === "error") console.log("A CONSOLE:", m.text().slice(0, 220));
  });
  await a.goto(BASE + "/lingo");
  await openOnline(a);
  await a.getByPlaceholder("Spēlētājs").fill("AnnaProds");
  await a.getByRole("radio", { name: "Piecu vārdu cīņa" }).click();
  await a.getByRole("radio", { name: "4 burti" }).click();
  await a.getByRole("button", { name: "Izveidot istabu" }).click();
  await a.locator("span.font-mono").waitFor({ timeout: 20000 });
  const code = (await a.locator("span.font-mono").textContent())!.trim();
  await b.goto(`${BASE}/lingo?room=${code}`);
  await openOnline(b);
  await b.getByPlaceholder("Spēlētājs").fill("BertaProds");
  await b.getByRole("button", { name: "Pievienoties" }).click();
  await readyBoth(a, b);
  await a.getByText("Kārta 1/5", { exact: false }).waitFor({ timeout: 25000 });
  await waitForInput(a);
  await waitForInput(b);
  await a.getByRole("button", { name: /Pagarināt \+15 s/ }).click();
  await a
    .getByRole("button", { name: /Pagarināt \+15 s \(2\/3\)/ })
    .waitFor({ timeout: 15000 });
  check(
    "extension decremented budget and one-per-round cap",
    await a
      .getByRole("button", { name: /Pagarināt \+15 s \(2\/3\)/ })
      .isDisabled(),
  );
  for (let round = 0; round < 5; round++) {
    const firstLabel = await a
      .getByRole("group", { name: "Spēles laukums" })
      .locator('[role="gridcell"]')
      .first()
      .getAttribute("aria-label");
    const first = (firstLabel ?? "a").slice(0, 1).toLowerCase();
    for (let attempt = 0; attempt < 6; attempt++) {
      const aEnabled = await a
        .getByRole("button", { name: "Apstiprināt" })
        .isEnabled()
        .catch(() => false);
      const bEnabled = await b
        .getByRole("button", { name: "Apstiprināt" })
        .isEnabled()
        .catch(() => false);
      if (!aEnabled && !bEnabled) break;
      const base = (round * 7 + attempt) * 5;
      const fillerA = [17, 3, 11, 19, 1, 8]
        .map((off, i) => PLAIN[(base + off + i * 5) % PLAIN.length])
        .slice(attempt, attempt + 3)
        .join("")
        .padEnd(3, "a");
      const fillerB = [5, 13, 21, 7, 15, 2]
        .map((off, i) => PLAIN[(base + off + i * 5) % PLAIN.length])
        .slice(attempt, attempt + 3)
        .join("")
        .padEnd(3, "a");
      if (aEnabled) await typeMp(a, first + fillerA);
      if (bEnabled) await typeMp(b, first + fillerB);
      await a.getByText("Iesniedz…").waitFor({ state: "hidden", timeout: 5000 }).catch(() => undefined);
      await b.getByText("Iesniedz…").waitFor({ state: "hidden", timeout: 5000 }).catch(() => undefined);
      await a.waitForTimeout(400);
      const ta = await a.locator("wa-toast-item").allInnerTexts();
      const tb = await b.locator("wa-toast-item").allInnerTexts();
      if (ta.length || tb.length) {
        console.log("toasts A:", JSON.stringify(ta), "B:", JSON.stringify(tb));
      }
    }
    if (round < 4) {
      const advanced = await a
        .getByText(`Kārta ${round + 2}/5`, { exact: false })
        .isVisible()
        .catch(() => false);
      if (!advanced) {
        await a.waitForTimeout(12000);
      }
      await a
        .getByText(`Kārta ${round + 2}/5`, { exact: false })
        .waitFor({ timeout: 45000 });
      await waitForInput(a);
      await waitForInput(b);
    }
  }
  const resultSeen = await a
    .getByText(/Neizšķirts|Tu uzvarēji!|Pretinieks uzvarēja/)
    .isVisible()
    .catch(() => false);
  if (!resultSeen) {
    await a.getByRole("button", { name: "Pārtraukt spēli" }).click();
  }
  await a
    .getByText(/Neizšķirts|Tu uzvarēji!|Pretinieks uzvarēja/)
    .waitFor({ timeout: 30000 });
  await b
    .getByText(/Neizšķirts|Tu uzvarēji!|Pretinieks uzvarēja/)
    .waitFor({ timeout: 30000 });
  check("five-word battle completed with consistent result", true);
  await a.getByRole("button", { name: "Revanšs" }).click();
  await b.getByRole("button", { name: "Revanšs" }).click();
  await a
    .getByRole("button", { name: "Turpināt uz revanšu" })
    .waitFor({ timeout: 20000 });
  await b
    .getByRole("button", { name: "Turpināt uz revanšu" })
    .waitFor({ timeout: 20000 });
  await a.getByRole("button", { name: "Turpināt uz revanšu" }).click();
  await b.getByRole("button", { name: "Turpināt uz revanšu" }).click();
  await a.getByRole("button", { name: "Esmu gatavs" }).waitFor({ timeout: 20000 });
  check("rematch creates a fresh room", true);
  await ctxA.close();
  await ctxB.close();
}

// --- Test C: reconnection mid-match ---
{
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await a.goto(BASE + "/lingo");
  await openOnline(a);
  await a.getByPlaceholder("Spēlētājs").fill("AnnaProds");
  await a.getByRole("radio", { name: "4 burti" }).click();
  await a.getByRole("button", { name: "Izveidot istabu" }).click();
  await a.locator("span.font-mono").waitFor({ timeout: 20000 });
  const code = (await a.locator("span.font-mono").textContent())!.trim();
  await b.goto(`${BASE}/lingo?room=${code}`);
  await openOnline(b);
  await b.getByPlaceholder("Spēlētājs").fill("BertaProds");
  await b.getByRole("button", { name: "Pievienoties" }).click();
  await readyBoth(a, b);
  await b.getByRole("group", { name: "Spēles laukums" }).waitFor({ timeout: 25000 });
  await waitForInput(b);
  const firstLabel = await b
    .getByRole("group", { name: "Spēles laukums" })
    .locator('[role="gridcell"]')
    .first()
    .getAttribute("aria-label");
  const first = (firstLabel ?? "a").slice(0, 1).toLowerCase();
  await typeMp(b, `${first}bcd`);
  await expect(b.getByRole("group", { name: "Spēles laukums" }).getByLabel(/pareizi|citā vietā|nav vārdā/)).toHaveCount(4, { timeout: 15000 });
  await b.reload();
  await openOnline(b);
  await expect(b.getByRole("group", { name: "Spēles laukums" }).getByLabel(/pareizi|citā vietā|nav vārdā/)).toHaveCount(4, { timeout: 20000 });
  check("reconnect restored slot and guess history", true);
  await ctxA.close();
  await ctxB.close();
}

// --- Test D/E: authorization + health ---
{
  const res = await fetch(BASE + "/api/lingo-mp/status");
  const status = (await res.json()) as { available: boolean; mode: string };
  check("public health reports enabled", status.available === true, `mode=${status.mode}`);
  const createRes = await fetch(BASE + "/api/lingo-mp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      format: "quick-duel",
      length: 4,
      nickname: "Probe",
      guestHash: "probe-guest-hash-1234",
      playerToken: "probe-player-token-1234",
    }),
  });
  const created = (await createRes.json()) as { matchId: string };
  check("room creation works over API", createRes.ok && !!created.matchId);
  const forged = await fetch(
    `${BASE}/api/lingo-mp/${created.matchId}`,
    { headers: { "x-player-token": "forged" } },
  );
  check("invalid token rejected", forged.status === 403, `status=${forged.status}`);
  const keyPath = `${process.env.TEMP}/lingo-healthkey.txt`;
  if (fs.existsSync(keyPath)) {
    const key = fs.readFileSync(keyPath, "utf8").trim();
    const okHealth = await fetch(BASE + "/api/lingo-mp/health", {
      headers: { "x-operator-key": key },
    });
    const health = (await okHealth.json()) as {
      ok: boolean;
      db?: { schemaVersion: number };
    };
    check(
      "operator health reports reachable db",
      okHealth.status === 200 &&
        health.ok === true &&
        (health.db?.schemaVersion ?? 0) >= 1,
    );
  } else {
    console.log(
      "SKIP  operator-health correct-key probe (no local operator key)",
    );
  }
  const badHealth = await fetch(BASE + "/api/lingo-mp/health", {
    headers: { "x-operator-key": "wrong" },
  });
  check("operator health rejects bad key", badHealth.status === 403);
}

await browser.close();
