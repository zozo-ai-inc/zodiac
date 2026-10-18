import { expect, test } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";

test("the app stays usable and says so when local storage fails at startup", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	// IndexedDB unavailable, as in some private-browsing modes or after a broken storage upgrade.
	await page.addInitScript(() => {
		Object.defineProperty(window, "indexedDB", {
			configurable: true,
			get() {
				throw new DOMException("The operation is insecure.", "SecurityError");
			}
		});
	});
	await page.goto("/");

	await expect(
		page.locator("#main-container"),
		"a failed startup should not leave the whole app unclickable"
	).toHaveAttribute("aria-busy", "false");
	await expect(page.locator(".toast", { hasText: /couldn.t load/i })).toBeVisible();
	await page.locator("#btn-open-settings").click();
	await expect(page.locator("#settings-sidebar")).toBeInViewport();
});
