import { expect, test } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";
import type * as Helpers from "../../../src/utils/helpers";

test("a confirm opened over an adaptive sheet sits above the sheet and leaves it open", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");

	await page.locator("#btn-open-settings").click();
	await page.locator('[data-settings-target="chat"]').click();
	await page.locator("#model-picker-trigger").click();
	const sheet = page.locator("#model-picker-sheet");
	await expect(sheet).toBeVisible();

	const answer = page.evaluate(async () => {
		const helpers = await window.importModule<typeof Helpers>("/utils/helpers.ts");
		return await helpers.confirmDialog("Switch models?");
	});
	await expect(page.getByRole("dialog", { name: "Switch models?" })).toBeVisible();

	// A plain click fails if the sheet or its scrim intercepts the pointer.
	await page.locator("#btn-dialog-ok").click({ timeout: 2_000 });

	expect(await answer, "the confirm button should be clickable above the sheet").toBe(true);
	await expect(sheet, "confirming should not dismiss the sheet underneath").toBeVisible();
});

test("only a dangerous confirm is styled as a warning", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");

	const ask = (danger: boolean) =>
		page.evaluate(async (isDanger) => {
			const helpers = await window.importModule<typeof Helpers>("/utils/helpers.ts");
			return await helpers.confirmDialog("Continue?", { danger: isDanger });
		}, danger);

	const plainAnswer = ask(false);
	await expect(page.locator("#dialog")).toBeVisible();
	await expect(page.locator("#dialog")).not.toHaveClass(/dialog--danger/);
	await page.locator("#btn-dialog-cancel").click();
	await plainAnswer;

	const dangerAnswer = ask(true);
	await expect(page.locator("#dialog")).toHaveClass(/dialog--danger/);
	await page.locator("#btn-dialog-cancel").click();
	await dangerAnswer;
});
