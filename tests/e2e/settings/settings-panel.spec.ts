import { expect, test } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";
import type * as GroupChatService from "../../../src/services/GroupChat.service";

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
	await expect(page.locator("#btn-chat-add")).toBeVisible();

	// Seed the chat through the services; the button under test is the real entry point.
	await page.evaluate(async () => {
		const personalityService = await window.importModule<any>("/services/Personality.service.ts");
		const groupChatService = await window.importModule<typeof GroupChatService>("/services/GroupChat.service.ts");

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
	await expect(page.locator("#btn-persona-add")).toBeVisible();
});

test("an open settings page takes over the panel title and offers the way back", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");

	const settings = page.locator("#settings-sidebar");
	const heading = settings.getByRole("heading", { level: 2 });
	const back = settings.getByRole("button", { name: "Back to settings", exact: true });

	await page.locator("#btn-open-settings").click();
	await expect(heading).toHaveText("Settings");
	await expect(back).toBeHidden();

	await page.locator('[data-settings-target="personalisation"]').click();
	await expect(page.locator('[data-settings-page="personalisation"]')).toBeVisible();
	await expect(heading, "the panel title should name the open page").toHaveText("Personalisation");
	await expect(
		settings.getByText("Settings", { exact: true }),
		"the page should not repeat a Settings title"
	).toHaveCount(0);
	await expect(back).toBeVisible();

	await back.click();
	await expect(page.locator("#settings-home")).toBeVisible();
	await expect(page.locator('[data-settings-page="personalisation"]')).toBeHidden();
	await expect(heading).toHaveText("Settings");
	await expect(back).toBeHidden();

	await page.keyboard.press("Escape");
	await expect(settings, "Escape should still close the panel after going back").toBeHidden();
});
