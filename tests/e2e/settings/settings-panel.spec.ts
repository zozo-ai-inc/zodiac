import { expect, test } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";

test("settings opens and closes from the sidebar footer", async ({ page }) => {
	// Wide enough for both sidebars, so the gear stays reachable while settings is open.
	await page.setViewportSize({ width: 1600, height: 900 });
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");

	const settings = page.locator("#settings-sidebar");
	const gear = page.locator("#btn-open-settings");
	await expect(settings).toBeHidden();

	await gear.click();
	await expect(settings).toBeInViewport({ ratio: 1 });
	await expect(page.locator('[data-settings-target="chat"]')).toBeVisible();
	await expect(gear).toHaveAttribute("aria-expanded", "true");

	await gear.click();
	await expect(settings).toBeHidden();
	await expect(gear).toHaveAttribute("aria-expanded", "false");
});

test("RPG settings button opens settings on the group chat page", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");
	await expect(page.locator("#btn-new-chat")).toBeVisible();

	// Seed the chat through the services; the button under test is the real entry point.
	await page.evaluate(async () => {
		const importModule = new Function("path", "return import(path);") as (path: string) => Promise<any>;
		const personalityService = await importModule("/services/Personality.service.ts");
		const groupChatService = await importModule("/services/GroupChat.service.ts");

		await personalityService.add({ name: "RPG Persona 1" });
		await personalityService.add({ name: "RPG Persona 2" });
		const [first, second] = (await personalityService.getAll()).map((persona: { id: string }) => persona.id);

		// The user goes first, so the chat waits for input instead of requesting a reply.
		await groupChatService.createRpgGroupChat({
			participantIds: [first, second],
			turnOrder: ["user", first, second]
		});
	});

	await page.locator("#btn-rpg-settings").click();

	await expect(page.locator('[data-settings-page="groupchat"]')).toBeVisible();
	await expect(page.locator("#settings-sidebar")).toBeInViewport();
	await expect(page.locator("#settings-home")).toBeHidden();
});

test("closing settings on mobile returns to the sidebar", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");

	await page.locator("#btn-show-sidebar").click();
	await page.locator("#btn-open-settings").click();

	const settings = page.locator("#settings-sidebar");
	await expect(settings).toBeInViewport({ ratio: 1 });

	await page.locator("#btn-close-settings").click();
	await expect(settings).toBeHidden();

	// The sidebar is usable again, not just present underneath.
	await page.locator(".sidebar .navbar-tab", { hasText: "Personas" }).click();
	await expect(page.locator("#btn-import-personality")).toBeVisible();
});
