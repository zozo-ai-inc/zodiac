import { expect, test, type Locator, type Page } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";

// The retirement chip shows a date in the viewer's locale and timezone, so both are pinned.
test.use({ locale: "en-US", timezoneId: "UTC" });

const RETIRING_GEMINI = "google/gemini-2.5-flash"; // deprecationDate 2026-10-20T00:00:00Z
const RETIRING_QWEN = "qwen/qwen3.6-max-preview"; // deprecationDate 2026-10-09T00:00:00Z

async function openApp(page: Page, now: string, savedModel?: string): Promise<void> {
	await page.clock.setFixedTime(new Date(now));
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	if (savedModel) {
		await page.addInitScript((model) => localStorage.setItem("model", model), savedModel);
	}
	await page.goto("/");
	await expect(page.locator("#btn-new-chat")).toBeVisible();
}

async function openChatSettings(page: Page): Promise<void> {
	await page.locator(".navbar-tab").nth(2).click();
	await page.locator('[data-settings-target="chat"]').click();
	await expect(page.locator("#model-picker-trigger")).toBeVisible();
}

async function openModelFamily(page: Page, family: string): Promise<void> {
	await openChatSettings(page);
	await page.locator("#model-picker-trigger").click();
	await page.locator("#model-picker-family-list .model-picker-family", { hasText: family }).click();
	await expect(page.locator("#model-picker-family-title")).toHaveText(family);
}

function modelRow(page: Page, modelId: string): Locator {
	return page.locator(`#model-picker-model-list [data-model-id="${modelId}"]`);
}

test("warns in the model picker that a model is about to be retired", async ({ page }) => {
	await openApp(page, "2026-10-12T12:00:00Z");
	await openModelFamily(page, "Google");

	await expect(modelRow(page, RETIRING_GEMINI), "retiring model has no retirement warning").toContainText(
		"Retires Oct 20"
	);
	await expect(modelRow(page, "google/gemini-3.5-flash")).toBeVisible();
	await expect(modelRow(page, "google/gemini-3.5-flash")).not.toContainText("Retires");
});

test("stops offering a model in the picker once its deprecation date has passed", async ({ page }) => {
	await openApp(page, "2026-10-20T00:00:00Z");
	await openModelFamily(page, "Google");

	await expect(modelRow(page, "google/gemini-3.5-flash")).toBeVisible();
	await expect(modelRow(page, RETIRING_GEMINI), "retired model is still offered in the picker").toHaveCount(0);
	await expect(page.locator(`#selectedModel option[value="${RETIRING_GEMINI}"]`)).toHaveCount(0);
});

test("keeps a saved model selected before its deprecation date", async ({ page }) => {
	await openApp(page, "2026-10-08T12:00:00Z", RETIRING_QWEN);
	await openChatSettings(page);

	await expect(page.locator("#selectedModel")).toHaveValue(RETIRING_QWEN);
	await expect(page.locator("#model-picker-trigger")).toContainText("Qwen3.6 Max Preview");
});

test("moves a saved model to one that is still offered once it is retired", async ({ page }) => {
	await openApp(page, "2026-10-09T00:00:00Z", RETIRING_QWEN);
	await openChatSettings(page);

	// A non-empty value other than the retired model: waits for the selector to settle on a replacement.
	await expect(page.locator("#selectedModel"), "retired model is still the selected chat model").toHaveValue(
		/^(?!qwen\/qwen3\.6-max-preview$).+/
	);
	await expect(page.locator("#model-picker-trigger")).not.toContainText("Qwen3.6 Max Preview");
});
