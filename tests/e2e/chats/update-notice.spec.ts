import { expect, test, type Page } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";
import type * as UpdateNotice from "../../../src/components/static/UpdateNotice.component";

// The dev server has no build identity and never checks, so the deploy is reported to the notice directly.
async function reportDeployedUpdate(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const updateNotice = await window.importModule<typeof UpdateNotice>(
			"/components/static/UpdateNotice.component.ts"
		);

		updateNotice.showUpdateNotice({ kind: "deploy", buildId: "next-build" });
	});
}

test("a deployed update replaces the idle composer with a refresh notice", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");
	await expect(page.locator("#messageInput")).toBeVisible();

	await reportDeployedUpdate(page);

	await expect(page.locator("#update-notice")).toBeVisible();
	await expect(page.locator("#update-notice-title")).toHaveText("A new version of Zozo Chat is available");
	await expect(page.locator("#btn-update-refresh")).toBeVisible();
	await expect(page.locator("#btn-update-dismiss")).toBeHidden();
	await expect(page.locator("#messageInput")).toBeHidden();
});

test("a deployed update waits for the draft to be cleared before replacing the composer", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");
	await page.locator("#messageInput").fill("An unsent draft");

	await reportDeployedUpdate(page);

	await expect(page.locator("#update-notice")).toBeHidden();
	await expect(page.locator("#messageInput")).toHaveText("An unsent draft");

	await page.locator("#messageInput").fill("");

	await expect(page.locator("#update-notice")).toBeVisible();
	await expect(page.locator("#messageInput")).toBeHidden();
});
