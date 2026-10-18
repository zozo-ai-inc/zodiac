import { expect, test, type Locator, type Page } from "@playwright/test";

import { installBrowserImport, seedLocalSettings, stubExternalTraffic } from "../helpers/app";
import type * as ToastService from "../../../src/services/Toast.service";

// A picture big enough to hover and click, as a real generated image would be.
const PICTURE_SVG = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#888"/></svg>'
).toString("base64");

async function openApp(page: Page): Promise<void> {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");
	await expect(page.locator("#main-container")).toHaveAttribute("aria-busy", "false");
}

/** Whether `target` is what a click at the centre of `probe` would actually land on. */
async function isTopmostAt(probe: Locator, target: Locator): Promise<boolean> {
	const box = await probe.boundingBox();
	if (!box) throw new Error("probe is not rendered");
	const targetHandle = await target.elementHandle();
	return await probe.page().evaluate(
		([x, y, element]) => {
			const hit = document.elementFromPoint(x, y);
			return !!hit && !!element && (element === hit || element.contains(hit));
		},
		[box.x + box.width / 2, box.y + box.height / 2, targetHandle] as const
	);
}

async function showToast(page: Page, title: string): Promise<Locator> {
	await page.evaluate(async (toastTitle) => {
		const toastService = await window.importModule<typeof ToastService>("/services/Toast.service.ts");
		toastService.info({ title: toastTitle, text: "Something happened." });
	}, title);
	const toast = page.locator(".toast", { hasText: title });
	await expect(toast).toBeVisible();
	return toast;
}

test("info tooltips in the persona form show above the overlay", async ({ page }) => {
	await openApp(page);
	await page.locator(".sidebar .navbar-tab", { hasText: "Personas" }).click();
	await page.locator("#btn-persona-add").click();
	await page.getByRole("menuitem", { name: "Create persona" }).click();
	const form = page.locator("#form-add-personality");
	await form.locator('input[name="name"]').fill("Tooltip Tester");
	await form.locator(".btn-stepper-next").click();

	const info = form.locator(".tooltip").first();
	await expect(info).toBeVisible();
	await info.hover();
	const tooltip = page.locator("[data-tippy-root]").last();
	await expect(tooltip).toBeAttached();

	// Tooltips ignore the pointer, so hit-testing cannot see them; compare their layers instead.
	// Both hang off <body>, so the higher z-index is the one drawn on top.
	const layers = await tooltip.evaluate((root) => ({
		onBody: root.parentElement === document.body,
		tooltip: Number(getComputedStyle(root).zIndex),
		overlay: Number(getComputedStyle(document.querySelector("#overlay")!).zIndex)
	}));
	expect(layers.onBody).toBe(true);
	expect(layers.tooltip, "the tooltip should not be hidden behind the overlay").toBeGreaterThan(layers.overlay);
});

test("a password-reset link opens its form above first-run onboarding", async ({ page }) => {
	await stubExternalTraffic(page, []);
	// A device that has never finished onboarding, which is common when opening the emailed link.
	await installBrowserImport(page);
	await page.goto("/?recovery=1");

	const resetForm = page.locator("#form-password-reset");
	await expect(resetForm).toBeVisible();
	expect(await isTopmostAt(resetForm, resetForm), "the reset form should not be covered by onboarding").toBe(true);
});

test("the image lightbox opens above an open chat menu", async ({ page }) => {
	await openApp(page);
	await page.evaluate(async (pixel) => {
		const personalityService = await window.importModule<any>("/services/Personality.service.ts");
		const chatsService = await window.importModule<any>("/services/Chats.service.ts");
		await personalityService.add(
			{ name: "Painter", image: "", description: "", prompt: "", toneExamples: [], tags: [] },
			"persona-painter"
		);
		await chatsService.addChatRecord({
			id: "chat-lightbox",
			title: "Lightbox",
			timestamp: Date.now(),
			content: [
				{ role: "user", parts: [{ text: "Draw" }] },
				{
					role: "model",
					personalityid: "persona-painter",
					parts: [{ text: "Done" }],
					generatedImages: [{ mimeType: "image/svg+xml", base64: pixel }]
				}
			]
		});
	}, PICTURE_SVG);
	const row = page.locator("label[for='chatchat-lightbox']");
	await row.click();
	await row.locator(".chat-actions-button").click();
	const menu = page.locator(".chat-actions-menu.dropdown-menu--portal");
	await expect(menu).toBeVisible();

	await page.locator(".generated-image-wrapper").hover();
	await page.locator(".generated-image-overlay .btn-expand").click();
	const lightbox = page.locator(".lightbox");
	await expect(lightbox).toBeVisible();

	expect(await isTopmostAt(menu, lightbox), "the lightbox should cover the chat menu, not sit beneath it").toBe(true);
});

test("toasts stay usable while a focus-trapping sheet is open", async ({ page }) => {
	await openApp(page);
	// Any earlier toast in the session leaves the toast stack in place for the sheet to lock out.
	const earlier = await showToast(page, "Welcome back");
	await earlier.locator(".toast-close").click();
	await expect(earlier).toBeHidden();

	await page.locator("#btn-open-settings").click();
	await page.locator('[data-settings-target="data"]').click();
	await page.locator("#btn-export-data").click();
	await expect(page.locator("#takeout-export-sheet")).toBeVisible();

	const toast = await showToast(page, "Takeout created");
	// An inert toast never becomes clickable, so give the click a short window and judge by the outcome.
	await toast
		.locator(".toast-close")
		.click({ timeout: 2_000 })
		.catch(() => undefined);

	// Well inside the toast's own auto-dismiss time, so only the click can have closed it.
	await expect(toast, "the toast's close button should respond over the sheet").toBeHidden({ timeout: 1_000 });
});

test("toasts do not cover panel close buttons", async ({ page }) => {
	await openApp(page);
	await page.locator("#btn-open-settings").click();
	const close = page.locator("#btn-close-settings");
	await expect(close).toBeVisible();

	await expect(page.locator("#settings-sidebar")).toBeInViewport({ ratio: 1 });
	await showToast(page, "Settings saved");

	await expect
		.poll(() => isTopmostAt(close, close), {
			message: "a toast should not sit on top of the settings close button"
		})
		.toBe(true);
});

test.describe("on a phone", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("toasts do not cover the sidebar close button", async ({ page }) => {
		await openApp(page);
		await page.locator("#btn-show-sidebar").click();
		const close = page.locator("#btn-hide-sidebar");
		await expect(close).toBeVisible();

		await showToast(page, "Chat deleted");

		await expect
			.poll(() => isTopmostAt(close, close), {
				message: "a toast should not sit on top of the sidebar close button"
			})
			.toBe(true);
	});
});
