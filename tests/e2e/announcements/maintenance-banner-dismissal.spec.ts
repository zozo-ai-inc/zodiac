import { expect, test, type Page } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";

type BannerConfig = {
	enabled: boolean;
	message: string;
	style?: "normal" | "warning";
	dismissible?: boolean;
	id?: string;
};

// Type 3: the real banner component and DOM run. Only the remote
// `maintenance_banner` key is mocked, at the Supabase REST boundary.
async function serveBanner(page: Page, initial: BannerConfig): Promise<{ set: (next: BannerConfig) => void }> {
	let config = initial;
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.route("**/rest/v1/feature_flags*", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			headers: { "access-control-allow-origin": "*" },
			body: JSON.stringify([{ value: config }])
		});
	});
	return {
		set: (next) => {
			config = next;
		}
	};
}

// The banner starts hidden, so a "still hidden" assertion is only meaningful
// once the component has applied the remote config, which it marks with data-state.
async function loadWithBannerConfigApplied(page: Page, navigate: () => Promise<unknown>): Promise<void> {
	await navigate();
	await expect(page.locator("#maintenance-banner")).toHaveAttribute("data-state", /^(visible|hidden)$/);
}

async function mainContainerTop(page: Page): Promise<number> {
	return await page.locator("#main-container").evaluate((element) => element.getBoundingClientRect().top);
}

test("dismissing the maintenance banner hides it, restores the layout, and survives a reload", async ({ page }) => {
	await serveBanner(page, { enabled: true, message: "Scheduled maintenance tonight." });
	await loadWithBannerConfigApplied(page, () => page.goto("/"));

	const banner = page.locator("#maintenance-banner");
	await expect(banner).toBeVisible();
	await expect(banner).toContainText("Scheduled maintenance tonight.");
	expect(await mainContainerTop(page)).toBeGreaterThan(0);

	await page.locator("#maintenance-banner-dismiss").click();

	await expect(banner).toBeHidden();
	expect(await mainContainerTop(page)).toBe(0);

	await loadWithBannerConfigApplied(page, () => page.reload());

	await expect(banner).toBeHidden();
	expect(await mainContainerTop(page)).toBe(0);
});

test("a changed maintenance banner reappears after an earlier one was dismissed", async ({ page }) => {
	const remote = await serveBanner(page, { enabled: true, message: "Scheduled maintenance tonight." });
	await loadWithBannerConfigApplied(page, () => page.goto("/"));

	const banner = page.locator("#maintenance-banner");
	await page.locator("#maintenance-banner-dismiss").click();
	await expect(banner).toBeHidden();

	remote.set({ enabled: true, message: "Cloud sync is currently unavailable." });
	await loadWithBannerConfigApplied(page, () => page.reload());

	await expect(banner).toBeVisible();
	await expect(banner).toContainText("Cloud sync is currently unavailable.");

	await page.locator("#maintenance-banner-dismiss").click();
	await expect(banner).toBeHidden();

	remote.set({ enabled: true, message: "Cloud sync is currently unavailable.", style: "warning" });
	await loadWithBannerConfigApplied(page, () => page.reload());

	await expect(banner).toBeVisible();

	await page.locator("#maintenance-banner-dismiss").click();
	await expect(banner).toBeHidden();

	remote.set({ enabled: true, message: "Cloud sync is currently unavailable.", style: "warning", id: "2" });
	await loadWithBannerConfigApplied(page, () => page.reload());

	await expect(banner).toBeVisible();
});

test("a maintenance banner that was turned off and on again reappears after an earlier dismissal", async ({ page }) => {
	const remote = await serveBanner(page, { enabled: true, message: "Scheduled maintenance tonight." });
	await loadWithBannerConfigApplied(page, () => page.goto("/"));

	const banner = page.locator("#maintenance-banner");
	await page.locator("#maintenance-banner-dismiss").click();
	await expect(banner).toBeHidden();

	remote.set({ enabled: false, message: "Scheduled maintenance tonight." });
	await loadWithBannerConfigApplied(page, () => page.reload());

	await expect(banner).toBeHidden();

	remote.set({ enabled: true, message: "Scheduled maintenance tonight." });
	await loadWithBannerConfigApplied(page, () => page.reload());

	await expect(banner).toBeVisible();
	await expect(banner).toContainText("Scheduled maintenance tonight.");
});

test("a non-dismissible maintenance banner has no close button and ignores a saved dismissal", async ({ page }) => {
	const remote = await serveBanner(page, { enabled: true, message: "Scheduled maintenance tonight." });
	await loadWithBannerConfigApplied(page, () => page.goto("/"));

	const banner = page.locator("#maintenance-banner");
	await page.locator("#maintenance-banner-dismiss").click();
	await expect(banner).toBeHidden();

	remote.set({ enabled: true, message: "Scheduled maintenance tonight.", dismissible: false });
	await loadWithBannerConfigApplied(page, () => page.reload());

	await expect(banner).toBeVisible();
	await expect(page.locator("#maintenance-banner-dismiss")).toBeHidden();
});
