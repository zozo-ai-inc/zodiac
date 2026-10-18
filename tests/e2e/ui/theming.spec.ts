import { expect, test, type Locator, type Page } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";
import type * as OverlayService from "../../../src/services/Overlay.service";
import type * as ToastService from "../../../src/services/Toast.service";

async function openAppInTheme(page: Page, colorTheme: string, mode: "light" | "dark"): Promise<void> {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.addInitScript(
		([theme, themeMode]) =>
			localStorage.setItem(
				"theme-settings",
				JSON.stringify({ colorTheme: theme, mode: themeMode, preference: "manual" })
			),
		[colorTheme, mode]
	);
	await page.goto("/");
	await expect(page.locator("html")).toHaveAttribute("data-theme", colorTheme);
	await expect(page.locator("html")).toHaveAttribute("data-mode", mode);
}

type Rgba = [number, number, number, number];

/** Every colour in a computed style string, in order. Mixed colours compute to `color(srgb r g b / a)`. */
function parseColors(value: string): Rgba[] {
	const pattern =
		/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)|color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/g;
	return Array.from(value.matchAll(pattern), (match): Rgba => {
		if (match[1] !== undefined) {
			return [
				Number(match[1]),
				Number(match[2]),
				Number(match[3]),
				match[4] === undefined ? 1 : Number(match[4])
			];
		}
		return [
			Number(match[5]) * 255,
			Number(match[6]) * 255,
			Number(match[7]) * 255,
			match[8] === undefined ? 1 : Number(match[8])
		];
	});
}

function contrast(a: Rgba, b: Rgba): number {
	const luminance = ([r, g, b]: Rgba) =>
		[r, g, b]
			.map((channel) => {
				const value = channel / 255;
				return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
			})
			.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
}

/** The first opaque-enough background behind an element, walking up its ancestors. */
async function backdropColor(locator: Locator): Promise<Rgba> {
	const value = await locator.evaluate((element) => {
		for (let node: Element | null = element.parentElement; node; node = node.parentElement) {
			const background = getComputedStyle(node).backgroundColor;
			const alpha = Number(background.match(/rgba?\([^)]*?,\s*([\d.]+)\)$/)?.[1] ?? 1);
			if (background !== "transparent" && alpha >= 0.5) return background;
		}
		return "rgb(255, 255, 255)";
	});
	return parseColors(value)[0];
}

async function showToast(page: Page): Promise<Locator> {
	await page.evaluate(async () => {
		const toastService = await window.importModule<typeof ToastService>("/services/Toast.service.ts");
		toastService.info({ title: "Saved", text: "Your settings are saved." });
	});
	const toast = page.locator(".toast--normal").last();
	await expect(toast).toBeVisible();
	return toast;
}

test("normal toasts take their colour from the active palette", async ({ browser }) => {
	const toastBackground = async (colorTheme: string) => {
		const page = await browser.newPage();
		await openAppInTheme(page, colorTheme, "light");
		const toast = await showToast(page);
		const background = await toast.evaluate((element) => getComputedStyle(element).backgroundColor);
		await page.close();
		return background;
	};

	expect(await toastBackground("green"), "a green-palette toast should not reuse the blue palette's colour").not.toBe(
		await toastBackground("blue")
	);
});

test("subscription screen text stays readable in light mode", async ({ page }) => {
	await openAppInTheme(page, "blue", "light");
	await page.evaluate(async () => {
		const overlayService = await window.importModule<typeof OverlayService>("/services/Overlay.service.ts");
		overlayService.show("form-subscription");
	});

	const maxTitle = page.locator("#form-subscription .tier-badge-max");
	await expect(maxTitle).toBeVisible();
	// The title is painted with a text gradient, so every stop has to read against the plan card.
	const gradientStops = parseColors(await maxTitle.evaluate((element) => getComputedStyle(element).backgroundImage));
	const card = await backdropColor(maxTitle);
	for (const stop of gradientStops) {
		expect(contrast(stop, card), "the Max plan title should be readable on its card").toBeGreaterThanOrEqual(3);
	}

	const eyebrow = page.locator("#form-subscription .subscription-faq-eyebrow");
	const eyebrowColor = parseColors(await eyebrow.evaluate((element) => getComputedStyle(element).color))[0];
	expect(
		contrast(eyebrowColor, await backdropColor(eyebrow)),
		"the FAQ eyebrow should be readable on its panel"
	).toBeGreaterThanOrEqual(3);
});

test("a checked toggle's knob stands out from its track in monochrome dark", async ({ page }) => {
	await openAppInTheme(page, "monochrome", "dark");
	await page.locator("#btn-open-settings").click();
	await page.locator('[data-settings-target="personalisation"]').click();

	// Autoscroll is switched on by the seeded settings.
	const toggle = page.locator("#autoscroll");
	await expect(toggle).toBeChecked();
	await expect(toggle).toBeVisible();
	const [track, knob] = await toggle.evaluate((element) => [
		getComputedStyle(element).backgroundColor,
		getComputedStyle(element, "::before").backgroundColor
	]);
	expect(
		contrast(parseColors(track)[0], parseColors(knob)[0]),
		"the checked toggle's knob should be visible against its track"
	).toBeGreaterThanOrEqual(3);
});

test("adaptive sheets keep a visible outline in dark mode", async ({ page }) => {
	await openAppInTheme(page, "blue", "dark");
	await page.locator("#btn-open-settings").click();
	await page.locator('[data-settings-target="data"]').click();
	await page.locator("#btn-export-data").click();
	const sheet = page.locator("#takeout-export-sheet");
	await expect(sheet).toBeVisible();

	const [border, surface] = await sheet.evaluate((element) => [
		getComputedStyle(element).borderTopColor,
		getComputedStyle(element).backgroundColor
	]);
	const [r, g, b, alpha] = parseColors(border)[0];
	const [sr, sg, sb] = parseColors(surface)[0];
	// Composite the translucent outline over the sheet to see what actually reaches the screen.
	const shown: Rgba = [r * alpha + sr * (1 - alpha), g * alpha + sg * (1 - alpha), b * alpha + sb * (1 - alpha), 1];
	expect(
		contrast(shown, [sr, sg, sb, 1]),
		"the sheet outline should be visible against the sheet"
	).toBeGreaterThanOrEqual(1.2);
});

test("the Add LoRA button keeps its primary button colour", async ({ page }) => {
	await openAppInTheme(page, "blue", "light");
	await page.locator("#btn-open-settings").click();
	await page.locator('[data-settings-target="image"]').click();

	const addLora = page.locator("#btn-add-lora");
	await expect(addLora).toBeVisible();
	const [background, primary] = await addLora.evaluate((element) => {
		const probe = document.createElement("div");
		probe.style.backgroundColor = "var(--primary)";
		document.body.append(probe);
		const primaryColor = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return [getComputedStyle(element).backgroundColor, primaryColor];
	});
	expect(background, "Add LoRA should be filled with the primary colour").toBe(primary);
});

// The quota bar only shows with cloud sync on; its track colour is what matters, so read it as rendered on a light surface.
test("the cloud sync quota track is visible on light surfaces", async ({ page }) => {
	await openAppInTheme(page, "blue", "light");
	const track = await page
		.locator(".cloud-sync-quota-bar")
		.first()
		.evaluate((element) => getComputedStyle(element).backgroundColor);
	const [r, g, b, alpha] = parseColors(track)[0];
	const white: Rgba = [255, 255, 255, 1];
	const shown: Rgba = [
		r * alpha + 255 * (1 - alpha),
		g * alpha + 255 * (1 - alpha),
		b * alpha + 255 * (1 - alpha),
		1
	];
	expect(contrast(shown, white), "the empty quota track should show against a light card").toBeGreaterThanOrEqual(
		1.15
	);
});
