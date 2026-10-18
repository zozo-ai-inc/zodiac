import { expect, test, type Page } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";
import type * as GroupChatService from "../../../src/services/GroupChat.service";
import type * as OverlayService from "../../../src/services/Overlay.service";

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

async function openCreatePersonaForm(page: Page): Promise<void> {
	await page.locator(".sidebar .navbar-tab", { hasText: "Personas" }).click();
	await page.locator("#btn-persona-add").click();
	await page.getByRole("menuitem", { name: "Create persona" }).click();
	await expect(page.locator("#form-add-personality")).toBeVisible();
}

test("editing a group chat leaves the persona form's personality step in place", async ({ page }) => {
	await openApp(page);
	const chatId = await page.evaluate(async () => {
		const personalityService = await window.importModule<any>("/services/Personality.service.ts");
		const groupChatService = await window.importModule<typeof GroupChatService>("/services/GroupChat.service.ts");
		for (const name of ["Ada", "Grace"]) {
			await personalityService.add({ name, image: "", description: "", prompt: "", toneExamples: [], tags: [] });
		}
		const personas = await personalityService.getAll();
		return await groupChatService.createDynamicGroupChat({
			participantIds: [personas[0].id, personas[1].id],
			allowPings: true,
			maxMessageGuardById: {}
		});
	});

	const row = page.locator(`label[for='chat${chatId}']`);
	await row.locator(".chat-actions-button").click();
	await page
		.locator(".chat-actions-menu.dropdown-menu--portal .chat-actions-item", { hasText: "Group Settings" })
		.click();
	await expect(page.locator("#form-create-group-chat")).toBeVisible();
	await page.locator("#btn-hide-overlay").click();
	await expect(page.locator("#overlay")).toBeHidden();

	await openCreatePersonaForm(page);
	const form = page.locator("#form-add-personality");
	await form.locator('input[name="name"]').fill("Third");
	await form.locator(".btn-stepper-next").click();

	await expect(
		form.locator("#internet-access"),
		"the persona form should still offer its personality step after editing a group chat"
	).toBeVisible();
});

test("chat rows keep their dimmed resting look after a search is cleared", async ({ page }) => {
	await openApp(page);
	await seedChats(page, ["Alpha", "Beta"]);
	const row = page.locator("label[for='chatchat-0']");
	await expect(row).toBeVisible();
	const restingOpacity = await row.evaluate((element) => getComputedStyle(element).opacity);

	const other = page.locator("label[for='chatchat-1']");
	await page.locator("#chat-search-input").fill("Alpha");
	await expect(other).toBeHidden();
	await page.locator("#chat-search-input").fill("");
	await expect(other).toBeVisible();
	await page.mouse.move(900, 500);
	await page.waitForTimeout(500);

	await expect
		.poll(() => row.evaluate((element) => getComputedStyle(element).opacity), {
			message: "a chat row should return to its resting opacity once the search is cleared"
		})
		.toBe(restingOpacity);
});

test("chat sort menu marks the chosen order as checked", async ({ page }) => {
	await openApp(page);
	const sort = page.locator("#btn-chat-sort");

	await sort.click();
	await page.getByRole("menuitemradio", { name: "Last interaction" }).click();
	await sort.click();

	await expect(page.getByRole("menuitemradio", { name: "Last interaction" })).toHaveAttribute("aria-checked", "true");
	await expect(page.getByRole("menuitemradio", { name: "Created date" })).toHaveAttribute("aria-checked", "false");
});

test("persona form labels focus their fields and name the sliders", async ({ page }) => {
	await openApp(page);
	await openCreatePersonaForm(page);
	const form = page.locator("#form-add-personality");

	await form.locator("label", { hasText: "Description:" }).click();
	await expect(form.locator('input[name="description"]'), "clicking a label should focus its field").toBeFocused();

	await form.locator('input[name="name"]').fill("Labelled");
	await form.locator(".btn-stepper-next").click();
	await expect(form.getByRole("slider", { name: "Aggressiveness" })).toBeVisible();
});

test("the login form opens empty after being closed with typed details", async ({ page }) => {
	await openApp(page);
	await page.locator("#btn-login").click();
	const login = page.locator("#login");
	await expect(login).toBeVisible();
	await login.locator('input[type="email"]').fill("someone@example.com");
	await login.locator('input[type="password"]').fill("hunter2");

	await page.locator("#btn-hide-overlay").click();
	await expect(page.locator("#overlay")).toBeHidden();
	await page.locator("#btn-login").click();
	await expect(login).toBeVisible();

	await expect(
		login.locator('input[type="email"]'),
		"a closed login form should not keep the typed email"
	).toHaveValue("");
	await expect(login.locator('input[type="password"]')).toHaveValue("");
});

test("a profile card ends in a consistent state after a quick double click", async ({ page }) => {
	await openApp(page);
	// The profile panel sits behind sign-in; open it directly, since the card behaviour does not depend on the account.
	await page.evaluate(async () => {
		const overlayService = await window.importModule<typeof OverlayService>("/services/Overlay.service.ts");
		overlayService.show("profile");
	});
	const card = page.locator("#profile-info-card");
	const content = page.locator("#profile-info-content");
	await expect(card).toBeVisible();
	await expect(card).toHaveClass(/collapsed/);

	await card.locator(".collapsible-card-header").dblclick();
	await page.waitForTimeout(600);

	const state = await content.evaluate((element) => ({
		collapsed: element.closest(".profile-card")!.classList.contains("collapsed"),
		height: element.getBoundingClientRect().height
	}));
	expect(state.collapsed, "a collapsed card should show no content, and an open card should").toBe(state.height < 1);
	if (state.collapsed) {
		await expect(content, "controls inside a collapsed card should not be reachable").toHaveJSProperty(
			"inert",
			true
		);
	}
});

test("a message with grounding that has no carousel still renders", async ({ page }) => {
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));
	await openApp(page);
	await page.evaluate(async () => {
		const personalityService = await window.importModule<any>("/services/Personality.service.ts");
		const chatsService = await window.importModule<any>("/services/Chats.service.ts");
		await personalityService.add(
			{ name: "Researcher", image: "", description: "", prompt: "", toneExamples: [], tags: [] },
			"persona-research"
		);
		await chatsService.addChatRecord({
			id: "chat-grounding",
			title: "Grounding",
			timestamp: Date.now(),
			content: [
				{ role: "user", parts: [{ text: "Search something" }] },
				{
					role: "model",
					personalityid: "persona-research",
					parts: [{ text: "Here is what I found." }],
					groundingContent: "<div class='container'><span>Sources</span></div>"
				}
			]
		});
	});

	await page.locator("label[for='chatchat-grounding']").click();

	await expect(page.locator(".message", { hasText: "Here is what I found." })).toBeVisible();
	expect(pageErrors, "rendering grounding without a carousel should not throw").toEqual([]);
});

test.describe("on a phone", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("a closed sidebar stays closed after the window widens to desktop and narrows again", async ({ page }) => {
		await openApp(page);
		await page.locator("#btn-show-sidebar").click();
		await expect(page.locator(".sidebar")).toBeInViewport();
		await page.locator("#btn-hide-sidebar").click();
		await expect(page.locator(".sidebar")).not.toBeInViewport();

		await page.setViewportSize({ width: 1440, height: 900 });
		await expect(page.locator(".sidebar")).toBeInViewport();
		await page.setViewportSize({ width: 390, height: 844 });

		await expect(page.locator(".sidebar"), "the sidebar should not reopen over the chat").not.toBeInViewport();
	});

	test("the sidebar is still there on desktop when the window widens right after picking a chat", async ({
		page
	}) => {
		await openApp(page);
		await seedChats(page, ["Alpha"]);
		await page.locator("#btn-show-sidebar").click();
		await expect(page.locator(".sidebar")).toBeInViewport();

		// Picking a chat starts the sidebar's fade-out; the window then widens before the fade finishes.
		await page.locator("label[for='chatchat-0']").click();
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.waitForTimeout(400);

		await expect(page.locator(".sidebar"), "the desktop sidebar should not vanish").toBeVisible();
	});
});

// Render contract: the composer gets `.disabled` when it is not the user's RPG turn. Reaching that turn state
// needs a full multi-persona round, so this sets the class the composer itself uses and checks it reads as locked.
test("a locked composer looks unavailable", async ({ page }) => {
	await openApp(page);
	const composer = page.locator("#messageInput");
	const before = await composer.evaluate((element) => getComputedStyle(element).opacity);

	await composer.evaluate((element: HTMLElement) => {
		element.classList.add("disabled");
		element.contentEditable = "false";
	});

	const locked = await composer.evaluate((element) => ({
		opacity: getComputedStyle(element).opacity,
		cursor: getComputedStyle(element).cursor
	}));
	expect(locked.opacity, "a locked composer should be dimmed").not.toBe(before);
	expect(locked.cursor).toBe("not-allowed");
});

// The credits label only shows for signed-in accounts with image credits, so this clicks the label element
// directly; the popover logic under test is the same.
test("the image credits popover stays open when reopened right after closing", async ({ page }) => {
	await openApp(page);
	await page.evaluate(() => {
		const label = document.querySelector<HTMLElement>("#image-credits-label")!;
		label.click();
		label.click();
		label.click();
	});
	await page.waitForTimeout(400);

	await expect(
		page.locator("#image-credits-popover"),
		"a popover reopened during its closing fade should stay open"
	).not.toHaveClass(/(^|\s)hidden(\s|$)/);
});
