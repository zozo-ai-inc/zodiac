import { expect, test, type Page } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";
import type * as ChatsService from "../../../src/services/Chats.service";

async function openApp(page: Page): Promise<void> {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");
	await expect(page.locator("#main-container")).toHaveAttribute("aria-busy", "false");
}

async function seedChats(page: Page, titles: string[]): Promise<void> {
	await page.evaluate(async (chatTitles) => {
		const chatsService = await window.importModule<any>("/services/Chats.service.ts");
		for (const [index, title] of chatTitles.entries()) {
			await chatsService.addChatRecord({
				id: `chat-${index}`,
				title,
				timestamp: Date.now() + index,
				content: [{ role: "user", parts: [{ text: `Message in ${title}` }] }]
			});
		}
	}, titles);
}

test("keyboard users can switch between the Chats and Personas tabs", async ({ page }) => {
	await openApp(page);

	const chatsTab = page.locator(".sidebar").getByRole("tab", { name: "Chats" });
	const personasTab = page.locator(".sidebar").getByRole("tab", { name: "Personas" });
	await expect(chatsTab, "the sidebar tabs should be exposed as tabs").toHaveAttribute("aria-selected", "true");

	await page.keyboard.press("Tab");
	await chatsTab.focus();
	await expect(chatsTab, "the active tab should take keyboard focus").toBeFocused();
	await page.keyboard.press("ArrowRight");

	await expect(personasTab).toBeFocused();
	await expect(personasTab).toHaveAttribute("aria-selected", "true");
	await expect(chatsTab).toHaveAttribute("tabindex", "-1");
	await expect(page.locator("#persona-search-input")).toBeVisible();
});

test("keyboard users can open a chat from the sidebar list", async ({ page }) => {
	await openApp(page);
	await seedChats(page, ["Alpha", "Beta"]);

	const alpha = page.getByRole("radio", { name: "Alpha" });
	await alpha.focus();
	await expect(alpha, "the chat list should accept keyboard focus").toBeFocused();
	await page.keyboard.press("Space");

	await expect(page.locator(".message-text", { hasText: "Message in Alpha" })).toBeVisible();
	const currentChatId = await page.evaluate(async () => {
		const chatsService = await window.importModule<typeof ChatsService>("/services/Chats.service.ts");
		return chatsService.getCurrentChatId();
	});
	expect(currentChatId).toBe("chat-0");
});

test("keyboard users can open the add-persona dialog", async ({ page }) => {
	await openApp(page);
	await page.locator(".sidebar").getByText("Personas", { exact: true }).click();

	const addPersona = page.getByRole("button", { name: "Add persona" });
	await addPersona.focus();
	await expect(addPersona, "the add-persona card should accept keyboard focus").toBeFocused();
	await page.keyboard.press("Enter");

	await expect(page.locator("#modal-add-persona")).toBeVisible();
});
