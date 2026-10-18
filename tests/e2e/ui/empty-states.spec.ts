import { expect, test, type Page } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";

async function openApp(page: Page): Promise<void> {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");
	await expect(page.locator("#main-container")).toHaveAttribute("aria-busy", "false");
}

test("an empty chat list tells the user there are no chats yet", async ({ page }) => {
	await openApp(page);

	await expect(page.locator(".sidebar").getByText("No chats yet")).toBeVisible();
});

test("the empty chat list message goes away once a chat exists", async ({ page }) => {
	await openApp(page);
	await expect(page.locator(".sidebar").getByText("No chats yet")).toBeVisible();

	await page.evaluate(async () => {
		const chatsService = await window.importModule<any>("/services/Chats.service.ts");
		await chatsService.addChatRecord({
			id: "chat-first",
			title: "First",
			timestamp: Date.now(),
			content: [{ role: "user", parts: [{ text: "Hello" }] }]
		});
	});

	await expect(page.locator("label[for='chatchat-first']")).toBeVisible();
	await expect(page.locator(".sidebar").getByText("No chats yet")).toBeHidden();
});

test("a chat search with no matches says so", async ({ page }) => {
	await openApp(page);
	await page.evaluate(async () => {
		const chatsService = await window.importModule<any>("/services/Chats.service.ts");
		await chatsService.addChatRecord({
			id: "chat-search",
			title: "Holiday plans",
			timestamp: Date.now(),
			content: [{ role: "user", parts: [{ text: "Hello" }] }]
		});
	});
	await expect(page.locator("label[for='chatchat-search']")).toBeVisible();

	await page.locator("#chat-search-input").fill("zzzz-no-match");

	await expect(page.locator(".sidebar").getByText("No chats match your search")).toBeVisible();

	await page.locator("#chat-search-input").fill("Holiday");
	await expect(page.locator("label[for='chatchat-search']")).toBeVisible();
	await expect(page.locator(".sidebar").getByText("No chats match your search")).toBeHidden();
});

test("a persona search with no matches says so", async ({ page }) => {
	await openApp(page);
	await page.locator(".sidebar").getByText("Personas", { exact: true }).click();

	await page.locator("#persona-search-input").fill("zzzz-no-match");

	await expect(page.locator(".sidebar").getByText("No personas match your search")).toBeVisible();
});
