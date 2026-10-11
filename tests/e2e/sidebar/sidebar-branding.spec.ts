import { expect, test } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";

test("sidebar header shows the Zozo Chat wordmark", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");

	await expect(page.locator(".sidebar").getByRole("img", { name: "Zozo Chat", exact: true })).toBeVisible();
});

test("app and legal pages serve their own favicon and touch icon", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);

	for (const path of ["/", "/privacy-policy.html", "/terms-of-service.html"]) {
		await page.goto(path);

		const hrefs = await page
			.locator('link[rel="icon"], link[rel="apple-touch-icon"]')
			.evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
		expect(hrefs, `${path} should declare an .ico, an .svg and a touch icon`).toHaveLength(3);

		for (const href of hrefs) {
			expect(new URL(href).origin, `${href} should be served by the app itself`).toBe(new URL(page.url()).origin);
			const response = await page.request.get(href);
			expect(response.status(), `${href} should load`).toBe(200);
			expect(response.headers()["content-type"], `${href} should be an image`).toMatch(/^image\//);
		}
	}
});
