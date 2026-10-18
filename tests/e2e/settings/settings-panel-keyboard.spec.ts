import { expect, test } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";

test("Escape closes settings from inside a settings page", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");

	const settings = page.locator("#settings-sidebar");

	await page.locator("#btn-open-settings").click();
	await expect(settings).toBeInViewport({ ratio: 1 });

	await page.locator('[data-settings-target="chat"]').click();
	await expect(page.locator('[data-settings-page="chat"]')).toBeVisible();

	await page.keyboard.press("Escape");
	await expect(settings, "Escape should close the settings panel from inside a settings page").toBeHidden();
	await expect(page.locator("#btn-open-settings")).toHaveAttribute("aria-expanded", "false");
});

test("open-settings without a page opens the panel without throwing", async ({ page }) => {
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));

	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");
	await expect(page.locator("#btn-chat-add")).toBeVisible();
	const errorsBeforeDispatch = pageErrors.length;

	await page.evaluate(() => {
		window.dispatchEvent(new CustomEvent("open-settings"));
	});

	expect(pageErrors.slice(errorsBeforeDispatch), "open-settings without a page should not throw").toEqual([]);
	await expect(page.locator("#settings-sidebar")).toBeInViewport();
	await expect(page.locator("#settings-home")).toBeVisible();
});

test("Escape in a settings text input mid-edit keeps the panel open", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");

	const settings = page.locator("#settings-sidebar");
	const apiKeyInput = page.locator("#apiKeyInput");

	await page.locator("#btn-open-settings").click();
	await page.locator('[data-settings-target="api"]').click();
	await expect(apiKeyInput).toBeVisible();

	await apiKeyInput.click();
	await page.keyboard.type("partial-key");
	await expect(apiKeyInput).toHaveValue("partial-key");

	await page.keyboard.press("Escape");
	await expect(settings, "Escape inside a settings text input should not close the whole panel").toBeInViewport({
		ratio: 1
	});
	await expect(page.locator("#btn-open-settings")).toHaveAttribute("aria-expanded", "true");
	await expect(apiKeyInput, "Escape should leave the field focused with its text").toBeFocused();
	await expect(apiKeyInput).toHaveValue("partial-key");
});
