import { expect, test } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "./helpers/app";

test("random chat generation reports failures", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/?migration=empty");
	await page.locator("#btn-open-settings").click();
	await expect(page.locator("#debug-section")).toBeVisible();
	await page.evaluate(async () => {
		const debugButtons = await window.importModule<{
			generateRandomChats: (addChat: () => Promise<string>) => Promise<void>;
		}>("/components/static/DebugButtons.component.ts");
		await debugButtons.generateRandomChats(async () => {
			throw new Error("Cloud sync is enabled but locked. Unlock sync before creating chats.");
		});
	});

	await expect(page.locator(".toast--danger .toast-body")).toContainText(
		"Cloud sync is enabled but locked. Unlock sync before creating chats."
	);
});

test("random chat generation waits for every chat", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/?migration=empty");

	const completed = await page.evaluate(async () => {
		const debugButtons = await window.importModule<{
			generateRandomChats: (addChat: () => Promise<string>) => Promise<void>;
		}>("/components/static/DebugButtons.component.ts");
		let calls = 0;
		await debugButtons.generateRandomChats(
			() =>
				new Promise((resolve) => {
					setTimeout(() => {
						calls += 1;
						resolve(`chat-${calls}`);
					}, 10);
				})
		);
		return calls;
	});

	expect(completed).toBe(10);
});
