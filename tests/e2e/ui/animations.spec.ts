import { expect, test, type Page } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";
import type * as Helpers from "../../../src/utils/helpers";

const PICTURE_SVG = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#888"/></svg>'
).toString("base64");

async function openApp(page: Page): Promise<void> {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");
	await expect(page.locator("#main-container")).toHaveAttribute("aria-busy", "false");
}

/**
 * Samples an element over the next few frames: whether it is still rendered and its opacity.
 * Starting the sampler before the triggering click catches the very first frame of a change.
 */
async function startSampling(page: Page, selector: string): Promise<void> {
	await page.evaluate((target) => {
		const samples: Array<{ rendered: boolean; opacity: number }> = [];
		(window as unknown as { __samples: typeof samples }).__samples = samples;
		const sample = () => {
			const element = document.querySelector<HTMLElement>(target);
			const rendered = !!element && element.getClientRects().length > 0;
			samples.push({ rendered, opacity: rendered ? Number(getComputedStyle(element!).opacity) : 0 });
			if (samples.length < 12) requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	}, selector);
}

/**
 * Clicks inside the page and reports how long `target` stays rendered afterwards, in milliseconds.
 * A fade keeps the element in the layout until its 200ms timer ends; vanishing removes it within a frame.
 * Layout presence is timer-driven, so it is steadier on a busy CI runner than sampling the animated opacity.
 */
async function renderedMsAfterClick(page: Page, clickSelector: string, targetSelector: string): Promise<number> {
	return await page.evaluate(
		([button, target]) =>
			new Promise<number>((resolve) => {
				const start = performance.now();
				document.querySelector<HTMLElement>(button)!.click();
				const check = () => {
					const element = document.querySelector<HTMLElement>(target);
					const rendered = !!element && element.getClientRects().length > 0;
					if (!rendered) resolve(performance.now() - start);
					else if (performance.now() - start > 1000) resolve(1000);
					else requestAnimationFrame(check);
				};
				check();
			}),
		[clickSelector, targetSelector] as const
	);
}

async function readSamples(page: Page): Promise<Array<{ rendered: boolean; opacity: number }>> {
	await page.waitForTimeout(400);
	return await page.evaluate(
		() => (window as unknown as { __samples: Array<{ rendered: boolean; opacity: number }> }).__samples
	);
}

test("closing the overlay fades its content out together with the backdrop", async ({ page }) => {
	await openApp(page);
	await page.locator("#btn-login").click();
	await expect(page.locator("#login-register-tabs")).toBeVisible();
	await page.waitForTimeout(300);

	await startSampling(page, "#login-register-tabs");
	await page.locator("#btn-hide-overlay").click();
	const samples = await readSamples(page);

	// While the backdrop fades (about 200ms, over ten frames), the form should still be there, fading with it.
	expect(
		samples.slice(0, 4).every((frame) => frame.rendered),
		"the overlay's content should not blink out before its backdrop has faded"
	).toBe(true);
});

test("a closing overlay lets clicks through to the app straight away", async ({ page }) => {
	await openApp(page);
	await page.locator("#btn-login").click();
	await expect(page.locator("#login-register-tabs")).toBeVisible();
	const personasTab = page.locator(".sidebar .navbar-tab", { hasText: "Personas" });
	const box = (await personasTab.boundingBox())!;

	await page.locator("#btn-hide-overlay").click();
	// A raw click, without waiting for anything to settle, as a quick user would.
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

	await expect(
		page.locator("#persona-search-input"),
		"the click should reach the sidebar, not the fading backdrop"
	).toBeVisible();
});

test("the confirm dialog fades out when answered", async ({ page }) => {
	await openApp(page);
	void page.evaluate(async () => {
		const helpers = await window.importModule<typeof Helpers>("/utils/helpers.ts");
		return await helpers.confirmDialog("Continue?");
	});
	await expect(page.locator("#dialog")).toBeVisible();
	await page.waitForTimeout(300);

	// A fade keeps it on screen for most of its 200ms; vanishing takes about a frame.
	expect(
		await renderedMsAfterClick(page, "#btn-dialog-ok", "#dialog"),
		"the dialog should fade out rather than vanish in one frame"
	).toBeGreaterThanOrEqual(120);
});

test("the image lightbox fades in and out", async ({ page }) => {
	await openApp(page);
	await page.evaluate(async (picture) => {
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
					generatedImages: [{ mimeType: "image/svg+xml", base64: picture }]
				}
			]
		});
	}, PICTURE_SVG);
	await page.locator("label[for='chatchat-lightbox']").click();
	await page.locator(".generated-image-wrapper").hover();

	await startSampling(page, ".lightbox");
	await page.locator(".generated-image-overlay .btn-expand").click();
	const opening = await readSamples(page);
	expect(
		opening.some((frame) => frame.rendered && frame.opacity < 1),
		"the lightbox backdrop should fade in rather than appear at full strength"
	).toBe(true);

	await page.waitForTimeout(300);
	expect(
		await renderedMsAfterClick(page, ".lightbox-close", ".lightbox"),
		"the lightbox should fade out rather than disappear at once"
	).toBeGreaterThanOrEqual(120);
});

test("the sidebar keeps its slide on a narrow desktop after the mobile sidebar was used", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openApp(page);
	await page.locator("#btn-show-sidebar").click();
	await expect(page.locator(".sidebar")).toBeInViewport();
	await page.locator("#btn-hide-sidebar").click();
	await expect(page.locator(".sidebar")).not.toBeInViewport();

	await page.setViewportSize({ width: 1200, height: 800 });
	await expect(page.locator(".sidebar")).toBeInViewport();

	const transition = await page
		.locator(".sidebar")
		.evaluate((element) => getComputedStyle(element).transitionProperty);
	expect(transition, "the sidebar should still slide aside when settings opens").toContain("margin-left");
});
