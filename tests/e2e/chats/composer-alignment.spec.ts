import { expect, test, type Page } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";

// Headless Chromium hides scrollbars by default, which would make every layout here trivially symmetric.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

type ComposerLayout = {
	scrollbarWidth: number;
	spaceLeftOfComposer: number;
	spaceRightOfComposer: number;
	composerCenter: number;
	messageColumnCenter: number;
};

async function readComposerLayout(page: Page): Promise<ComposerLayout> {
	return await page.evaluate(() => {
		const chatArea = document.querySelector<HTMLElement>("#scrollable-chat-container")!;
		const chatAreaBox = chatArea.getBoundingClientRect();
		const composerBox = document.querySelector<HTMLElement>("#message-box")!.getBoundingClientRect();
		const messageColumnBox = document.querySelector<HTMLElement>(".message-container")!.getBoundingClientRect();

		return {
			scrollbarWidth: chatArea.offsetWidth - chatArea.clientWidth,
			spaceLeftOfComposer: composerBox.left - chatAreaBox.left,
			spaceRightOfComposer: chatAreaBox.right - composerBox.right,
			composerCenter: composerBox.left + composerBox.width / 2,
			messageColumnCenter: messageColumnBox.left + messageColumnBox.width / 2
		};
	});
}

test("the composer has equal space on both sides while the chat does not scroll", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");
	await expect(page.locator("#message-box")).toBeVisible();

	const layout = await readComposerLayout(page);

	expect(layout.spaceRightOfComposer).toBeCloseTo(layout.spaceLeftOfComposer, 0);
	expect(layout.scrollbarWidth).toBe(0);
});

test("the composer stays aligned with the message column once the chat scrolls", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");

	await page.evaluate(async () => {
		const chatsService = await window.importModule<any>("/services/Chats.service.ts");

		await chatsService.addChatRecord({
			id: "scrolling-chat",
			title: "Scrolling Chat",
			timestamp: Date.now(),
			content: Array.from({ length: 40 }, (_unused, index) => ({
				role: "user",
				parts: [{ text: `Message ${index + 1}` }]
			}))
		});
	});

	await page.locator("label[for='chatscrolling-chat']").click();
	await expect(page.locator("#chat-title")).toHaveText("Scrolling Chat");
	await expect(page.locator(".message").first()).toBeVisible();

	await expect.poll(async () => (await readComposerLayout(page)).scrollbarWidth).toBeGreaterThan(0);
	await expect
		.poll(async () => {
			const layout = await readComposerLayout(page);
			return Math.abs(layout.composerCenter - layout.messageColumnCenter);
		})
		.toBeLessThan(1);
});
