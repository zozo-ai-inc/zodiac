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

test("what's new entry in the about menu shows the version and opens the changelog", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");

	await page.locator("#btn-about").click();

	const entry = page.locator("#about-menu").getByRole("button", { name: /What's New/ });
	await expect(entry).toContainText(/\d+\.\d+\.\d+/);

	await entry.click();

	await expect(page.locator("#whats-new")).toBeVisible();
	await expect(page.locator("#header-version")).toHaveText(/^What's New in \d+\.\d+\.\d+$/);
	await expect(page.locator("#about-menu")).toBeHidden();
});

test("an unseen version stays flagged across reloads until the about menu is dismissed", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");

	const aboutButton = page.locator("#btn-about");
	const entry = page.locator("#btn-whatsnew");

	await expect(aboutButton).toHaveClass(/has-update/);
	await page.reload();
	await expect(aboutButton, "the update dot should survive a reload while unread").toHaveClass(/has-update/);

	await aboutButton.click();
	await expect(entry).toBeVisible();
	await expect(entry, "the what's new entry should glow while unread").toHaveClass(/unread/);
	await expect(aboutButton).toHaveClass(/has-update/);

	await page.keyboard.press("Escape");
	await expect(page.locator("#about-menu")).toBeHidden();
	await expect(aboutButton, "dismissing the menu should clear the update dot").not.toHaveClass(/has-update/);
	await expect(entry).not.toHaveClass(/unread/);
	const version = await entry.locator("#whatsnew-version").textContent();
	expect(await page.evaluate(() => localStorage.getItem("version"))).toBe(version);

	await page.reload();
	await expect(entry).toHaveText(/What's New/);
	await expect(aboutButton, "a read version should stay read after a reload").not.toHaveClass(/has-update/);
	await expect(entry).not.toHaveClass(/unread/);

	await page.evaluate(() => localStorage.setItem("version", "0.0.0"));
	await page.reload();
	await expect(aboutButton, "the next version should flag the about button again").toHaveClass(/has-update/);
});
