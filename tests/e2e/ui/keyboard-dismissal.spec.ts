import { expect, test, type Locator, type Page } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";
import type * as Helpers from "../../../src/utils/helpers";

async function openApp(page: Page): Promise<void> {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");
	await expect(page.locator("#main-container")).toHaveAttribute("aria-busy", "false");
}

/** Focuses the control the way a keyboard user would arrive at it, so :focus-visible applies. */
async function keyboardFocus(page: Page, control: Locator): Promise<void> {
	await page.keyboard.press("Tab");
	await control.focus();
}

async function focusRing(control: Locator): Promise<{ outline: string; boxShadow: string }> {
	return await control.evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			outline: style.outlineStyle === "none" ? "none" : `${style.outlineWidth} ${style.outlineStyle}`,
			boxShadow: style.boxShadow
		};
	});
}

test("keyboard-focused buttons show a focus ring", async ({ page }) => {
	await openApp(page);

	const expectFocusRing = async (selector: string) => {
		const control = page.locator(selector);
		await keyboardFocus(page, control);
		const ring = await focusRing(control);
		expect(ring.outline !== "none" || ring.boxShadow !== "none", `${selector} has no visible focus ring`).toBe(
			true
		);
	};

	await expectFocusRing("#btn-new-chat");
	await expectFocusRing("#btn-chat-sort");

	// Settings can push the sidebar off-screen, so its controls are checked last.
	await page.locator("#btn-open-settings").click();
	await page.locator('[data-settings-target="chat"]').click();
	await expectFocusRing("#btn-settings-back");
	await expectFocusRing("#btn-close-settings");
});

test("Escape closes the full-screen overlay", async ({ page }) => {
	await openApp(page);
	await page.locator(".sidebar .navbar-tab", { hasText: "Personas" }).click();
	await page.locator("#btn-add-personality").click();
	const overlay = page.locator("#overlay");
	await expect(page.locator("#modal-add-persona")).toBeVisible();

	await page.keyboard.press("Escape");

	await expect(overlay, "Escape should close the overlay").toBeHidden();
});

test("Escape closes the mobile sidebar and returns focus to its toggle", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openApp(page);

	const showSidebar = page.locator("#btn-show-sidebar");
	await showSidebar.click();
	const sidebar = page.locator(".sidebar");
	await expect(sidebar).toBeInViewport();
	await expect(showSidebar).toHaveAttribute("aria-expanded", "true");

	await page.keyboard.press("Escape");

	await expect(sidebar, "Escape should close the mobile sidebar").not.toBeInViewport();
	await expect(showSidebar).toHaveAttribute("aria-expanded", "false");
	await expect(showSidebar).toBeFocused();
});

test("Escape cancels the confirm dialog", async ({ page }) => {
	await openApp(page);

	const answer = page.evaluate(async () => {
		const helpers = await window.importModule<typeof Helpers>("/utils/helpers.ts");
		return await helpers.confirmDialog("Discard this draft?");
	});
	const dialog = page.getByRole("dialog", { name: "Discard this draft?" });
	await expect(dialog).toBeVisible();
	await expect(page.locator("#btn-dialog-cancel"), "the dialog should take focus").toBeFocused();

	await page.keyboard.press("Escape");

	expect(await answer, "Escape should resolve the dialog as cancelled").toBe(false);
	await expect(dialog).toBeHidden();
});

test("Escape closes the chat sort menu and returns focus to its button", async ({ page }) => {
	await openApp(page);

	const sortButton = page.locator("#btn-chat-sort");
	await sortButton.click();
	await expect(sortButton).toHaveAttribute("aria-expanded", "true");

	await page.keyboard.press("Escape");

	await expect(sortButton, "Escape should close the sort menu").toHaveAttribute("aria-expanded", "false");
	await expect(page.locator(".chat-sort-menu")).toBeHidden();
	await expect(sortButton).toBeFocused();
});
