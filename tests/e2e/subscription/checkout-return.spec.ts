import { expect, test } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";
import type * as OverlayService from "../../../src/services/Overlay.service";

test("checkout buttons work again after returning from checkout with Back", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.route("**/functions/v1/stripe", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			headers: { "access-control-allow-origin": "*" },
			body: JSON.stringify({ url: "https://checkout.stripe.test/session" })
		})
	);
	// A 204 cancels the navigation, so the page stays exactly as the user left it for checkout.
	await page.route("https://checkout.stripe.test/**", (route) => route.fulfill({ status: 204 }));
	await page.goto("/");
	await page.evaluate(async () => {
		const overlayService = await window.importModule<typeof OverlayService>("/services/Overlay.service.ts");
		overlayService.show("form-top-up-imagecredits");
	});
	const topUp = page.locator("#btn-top-up-10");
	await topUp.click();
	await expect(topUp).toBeDisabled();

	// Pressing Back restores the page from the back/forward cache, which fires a persisted pageshow.
	await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));

	await expect(topUp, "a restored page should not keep the checkout buttons disabled").toBeEnabled();
});
