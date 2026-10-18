import { expect, test, type Page } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";

async function openAppWithChat(page: Page): Promise<void> {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");
	await expect(page.locator("#main-container")).toHaveAttribute("aria-busy", "false");
	await page.evaluate(async () => {
		const chatsService = await window.importModule<any>("/services/Chats.service.ts");
		await chatsService.addChatRecord({
			id: "chat-rename",
			title: "Original title",
			timestamp: Date.now(),
			content: [{ role: "user", parts: [{ text: "Hello" }] }]
		});
	});
}

async function rename(page: Page, typed: string): Promise<void> {
	const row = page.locator("label[for='chatchat-rename']");
	await row.locator(".chat-actions-button").click();
	await page
		.locator(".chat-actions-menu.dropdown-menu--portal .chat-actions-item", { hasText: "Edit title" })
		.click();
	const title = row.locator(".chat-title-text");
	await expect(title).toHaveAttribute("contenteditable", "true");
	await page.keyboard.press("ControlOrMeta+A");
	if (typed) await page.keyboard.type(typed);
	else await page.keyboard.press("Backspace");
	await page.keyboard.press("Enter");
	await expect(title).not.toHaveAttribute("contenteditable", "true");
}

async function storedTitle(page: Page): Promise<string | undefined> {
	return await page.evaluate(async () => {
		const { db } = await window.importModule<any>("/services/Db.service.ts");
		return (await db.chats.get("chat-rename"))?.title;
	});
}

test("clearing a chat's name while renaming keeps its old name", async ({ page }) => {
	await openAppWithChat(page);

	await rename(page, "");

	await expect(
		page.locator("label[for='chatchat-rename'] .chat-title-text"),
		"a blank rename should not leave the chat nameless in the sidebar"
	).toHaveText("Original title");
	expect(await storedTitle(page)).toBe("Original title");
});

test("renaming a chat back to its original name is saved", async ({ page }) => {
	await openAppWithChat(page);

	await rename(page, "Second title");
	await expect.poll(() => storedTitle(page)).toBe("Second title");
	await rename(page, "Original title");

	await expect
		.poll(() => storedTitle(page), { message: "the sidebar and the saved title should agree" })
		.toBe("Original title");
});

test("a rename that cannot be saved puts the old name back", async ({ page }) => {
	await openAppWithChat(page);
	const row = page.locator("label[for='chatchat-rename']");
	await row.locator(".chat-actions-button").click();
	await page
		.locator(".chat-actions-menu.dropdown-menu--portal .chat-actions-item", { hasText: "Edit title" })
		.click();
	await expect(row.locator(".chat-title-text")).toHaveAttribute("contenteditable", "true");
	// The chat disappears from storage mid-rename (deleted on another device), so the new name cannot be saved.
	await page.evaluate(async () => {
		const { db } = await window.importModule<any>("/services/Db.service.ts");
		await db.chats.delete("chat-rename");
	});
	await page.keyboard.press("ControlOrMeta+A");
	await page.keyboard.type("Never saved");
	await page.keyboard.press("Enter");

	await expect(row.locator(".chat-title-text"), "the sidebar should not show a name that was never saved").toHaveText(
		"Original title"
	);
});
