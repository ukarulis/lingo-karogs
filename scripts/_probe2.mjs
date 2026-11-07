import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://localhost:3000/karogs");
const skip = page.getByRole("button", { name: "Izlaist pamācību" });
await skip.waitFor({ state: "visible", timeout: 6000 }).catch(() => undefined);
if (await skip.isVisible().catch(() => false)) {
  await skip.click();
  await page.waitForTimeout(400);
}
await page.getByRole("radio", { name: /Ar draugu|Spēlēt ar draugu/ }).first().click();
await page.waitForTimeout(600);
const input = page.getByPlaceholder("Spēlētājs").first();
const info = await input.evaluate((el) => {
  const chain = [];
  let node = el;
  while (node && node !== document.body) {
    const s = getComputedStyle(node);
    chain.push({
      tag: node.tagName,
      cls: node.className?.toString?.() ?? "",
      h: s.height,
      lineH: s.lineHeight,
      disp: s.display,
      fs: s.fontSize,
      padding: s.padding,
      spacingVar: s.getPropertyValue("--spacing"),
      waFontScale: s.getPropertyValue("--wa-font-size-scale"),
      waSpaceScale: s.getPropertyValue("--wa-space-scale"),
    });
    node = node.parentElement;
  }
  return chain;
});
console.log(JSON.stringify(info, null, 2));

await page.goto("http://localhost:3000/statistika");
await page.waitForTimeout(800);
const wide = await page.evaluate(() => {
  const offenders = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.right > document.documentElement.clientWidth + 1 && r.width > 100) {
      offenders.push({
        tag: el.tagName,
        cls: String(el.className).slice(0, 120),
        w: Math.round(r.width),
        right: Math.round(r.right),
      });
    }
  }
  return offenders.slice(0, 12);
});
console.log(JSON.stringify(wide, null, 2));
await browser.close();
