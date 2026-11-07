import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./helpers";

const VIEWPORTS: Array<{ name: string; width: number; height: number }> = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 900 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`accessibility on ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of [
      "/",
      "/lingo",
      "/karogs",
      "/statistika",
      "/iestatijumi",
      "/ka-spelet",
      "/par-projektu",
    ]) {
      test(`${route} has no critical axe violations`, async ({ page }) => {
        await page.goto(route);
        await skipOnboarding(page);
        if (route === "/karogs") {
          await page.getByRole("button", { name: "Izvēlēties formāciju" }).click();
          await page.getByRole("button", { name: /Sabalansētā/ }).first().click();
        }
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          .disableRules(["color-contrast"])
          .analyze();
        const violations = results.violations.filter(
          (v) => v.impact === "critical" || v.impact === "serious",
        );
        expect(
          violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`),
          `axe violations:\n${JSON.stringify(violations, null, 2)}`,
        ).toEqual([]);
      });
    }
  });
}
