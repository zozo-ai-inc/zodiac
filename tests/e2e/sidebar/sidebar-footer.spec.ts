import { expect, test } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";

test("about menu links to the source code and the legal pages", async ({ page, context }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");

	await page.locator("#btn-about").click();

	const menu = page.locator("#about-menu");
	await expect(menu).toBeVisible();
	await expect(menu.getByRole("link", { name: "Source Code", exact: true })).toHaveAttribute(
		"href",
		"https://github.com/zozo-ai-inc/zodiac"
	);
	await expect(menu.getByRole("link", { name: "Privacy Policy", exact: true })).toHaveAttribute(
		"href",
		"privacy-policy.html"
	);

	const opened = context.waitForEvent("page");
	await menu.getByRole("link", { name: "Terms of Service", exact: true }).click();
	await expect(await opened).toHaveURL(/\/terms-of-service\.html$/);
	await expect(menu).toBeHidden();
});
