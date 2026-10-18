import { expect, test } from "@playwright/test";

import { installBrowserImport, stubExternalTraffic } from "../helpers/app";

test("a message the app refuses to send stays in the composer", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await installBrowserImport(page);
	// A first-time user who has not added an API key yet.
	await page.addInitScript(() => {
		localStorage.setItem("onboardingCompleted", "true");
		localStorage.setItem("model", "openai/gpt-5.4");
	});
	await page.goto("/");
	await expect(page.locator("#main-container")).toHaveAttribute("aria-busy", "false");

	const composer = page.locator("#messageInput");
	await composer.click();
	await page.keyboard.type("A long, carefully written first message");
	await page.keyboard.press("Enter");

	await expect(page.locator(".toast", { hasText: /API key/i })).toBeVisible();
	await expect(composer, "the refused message should not be thrown away").toHaveText(
		"A long, carefully written first message"
	);
});
