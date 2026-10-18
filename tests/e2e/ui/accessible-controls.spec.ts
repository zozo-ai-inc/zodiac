import { expect, test, type Locator, type Page } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";

// A 1x1 transparent PNG.
const PIXEL_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function openSeededChat(page: Page): Promise<void> {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");
	await expect(page.locator("#main-container")).toHaveAttribute("aria-busy", "false");

	await page.evaluate(async (pixel) => {
		const personalityService = await window.importModule<any>("/services/Personality.service.ts");
		const chatsService = await window.importModule<any>("/services/Chats.service.ts");
		await personalityService.add(
			{
				name: "Pixel",
				image: "",
				description: "Draws pixels",
				prompt: "Draw.",
				aggressiveness: 0,
				sensuality: 0,
				independence: 50,
				nsfw: false,
				internetEnabled: false,
				roleplayEnabled: false,
				toneExamples: [],
				tags: [],
				category: "character"
			},
			"persona-pixel"
		);
		await chatsService.addChatRecord({
			id: "chat-controls",
			title: "Controls",
			timestamp: Date.now(),
			content: [
				{ role: "user", parts: [{ text: "Draw a pixel" }] },
				{
					role: "model",
					personalityid: "persona-pixel",
					parts: [{ text: "Here it is" }],
					generatedImages: [{ mimeType: "image/png", base64: pixel }]
				}
			]
		});
	}, PIXEL_PNG);
}

async function selectSeededChat(page: Page): Promise<void> {
	await page.locator("label[for='chatchat-controls']").click();
	await expect(page.locator(".message .generated-image-wrapper")).toBeVisible();
}

/** Icon-only buttons whose only text is an icon ligature such as "more_vert", which is not a usable name. */
async function unnamedIconButtons(scope: Locator): Promise<string[]> {
	return await scope.evaluate((root) => {
		const isIconOnly = (button: HTMLElement) => {
			if (button.classList.contains("material-symbols-outlined")) return true;
			const meaningful = Array.from(button.childNodes).filter(
				(node) => !(node.nodeType === Node.TEXT_NODE && !node.textContent?.trim())
			);
			return (
				meaningful.length > 0 &&
				meaningful.every(
					(node) => node instanceof HTMLElement && node.classList.contains("material-symbols-outlined")
				)
			);
		};
		return Array.from(root.querySelectorAll<HTMLElement>("button"))
			.filter(isIconOnly)
			.filter((button) => !button.getAttribute("aria-label")?.trim() && !button.getAttribute("aria-labelledby"))
			.map((button) => button.id || `${button.className.trim()} "${button.textContent?.trim()}"`);
	});
}

test("icon-only buttons in the app shell, sidebar, settings, messages and persona cards have accessible names", async ({
	page
}) => {
	await openSeededChat(page);
	await selectSeededChat(page);
	await page.locator(".sidebar .navbar-tab", { hasText: "Personas" }).click();
	await expect(page.locator(".card-personality", { hasText: "Pixel" })).toBeVisible();

	expect(await unnamedIconButtons(page.locator("#main-container"))).toEqual([]);
});

test.describe("on a touch screen", () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test("generated-image actions are visible without hovering", async ({ page }) => {
		await openSeededChat(page);
		await page.locator("#btn-show-sidebar").tap();
		await page.locator("label[for='chatchat-controls']").tap();
		const overlay = page.locator(".generated-image-overlay").first();
		await expect(overlay).toBeAttached();

		await expect(overlay, "touch users cannot hover to reveal the image actions").toHaveCSS("opacity", "1");
	});

	test("icon buttons are at least 36px tap targets", async ({ page }) => {
		await openSeededChat(page);
		await page.locator("#btn-show-sidebar").tap();
		await page.locator("label[for='chatchat-controls']").tap();
		await expect(page.locator(".message .generated-image-wrapper")).toBeVisible();

		const measure = async (selector: string) =>
			await page
				.locator(selector)
				.filter({ visible: true })
				.first()
				.evaluate((element) => {
					const rect = element.getBoundingClientRect();
					return { width: Math.round(rect.width), height: Math.round(rect.height) };
				});

		const undersized: Record<string, { width: number; height: number }> = {};
		const check = async (selector: string) => {
			const size = await measure(selector);
			if (size.width < 36 || size.height < 36) undersized[selector] = size;
		};

		await check("#btn-show-sidebar");
		await check(".message .message-actions .btn-edit");
		await check(".message .message-actions .btn-refresh");

		await page.locator("#btn-show-sidebar").tap();
		await check("#btn-hide-sidebar");
		await check(".chat-actions-button");
		await page.locator(".sidebar .navbar-tab", { hasText: "Personas" }).tap();
		await check("#btn-share-personality-Pixel");
		await check("#btn-delete-personality-Pixel");

		await page.locator("#btn-open-settings").tap();
		await page.locator('[data-settings-target="chat"]').tap();
		await check("#btn-settings-back");
		await check("#btn-close-settings");

		expect(undersized).toEqual({});
	});

	test("tapping the sheet handle closes the sheet", async ({ page }) => {
		await openSeededChat(page);
		await page.locator("#btn-show-sidebar").tap();
		await page.locator("#btn-open-settings").tap();
		await page.locator('[data-settings-target="chat"]').tap();
		await page.locator("#model-picker-trigger").tap();
		const sheet = page.locator("#model-picker-sheet");
		await expect(sheet).toBeVisible();

		await sheet.locator(".adaptive-sheet__handle").tap();

		await expect(sheet, "tapping the handle should close the sheet").toBeHidden();
	});
});
