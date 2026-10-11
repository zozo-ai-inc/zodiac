import { expect, test } from "@playwright/test";

import { seedLocalSettings, stubExternalTraffic } from "../helpers/app";

test("a click on the about menu's own padding leaves it open", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");

	const aboutButton = page.locator("#btn-about");
	const menu = page.locator("#about-menu");

	await aboutButton.click();
	await expect(menu).toBeVisible();

	// Aim at the menu surface itself, between its edge and the items.
	const point = await menu.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		const firstItem = element.querySelector(".about-menu-item")!.getBoundingClientRect();
		const x = (rect.left + firstItem.left) / 2;
		const y = rect.top + rect.height / 2;
		return { x, y, gap: firstItem.left - rect.left, hitId: document.elementFromPoint(x, y)?.id ?? null };
	});
	expect(point.gap, "the menu should have padding around its items to click on").toBeGreaterThan(1);
	expect(point.hitId, "the click should land on the menu surface, not an item").toBe("about-menu");

	await page.mouse.click(point.x, point.y);

	await expect(menu, "clicking the menu's own padding should not dismiss it").toBeVisible();
	await expect(aboutButton).toHaveAttribute("aria-expanded", "true");
});

test("tabbing past the last about menu item closes the menu", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");

	const aboutButton = page.locator("#btn-about");
	const menu = page.locator("#about-menu");
	const items = menu.locator(".about-menu-item");

	await aboutButton.click();
	await expect(menu).toBeVisible();
	await expect(items.first()).toBeFocused();

	const itemCount = await items.count();
	for (let index = 1; index < itemCount; index++) {
		await page.keyboard.press("Tab");
	}
	await expect(items.last()).toBeFocused();

	await page.keyboard.press("Tab");
	await expect(items.last()).not.toBeFocused();

	await expect(menu, "tabbing out of the About menu should close it").toBeHidden();
	await expect(aboutButton).toHaveAttribute("aria-expanded", "false");
});

test("the about button and menu expose menu semantics", async ({ page }) => {
	await stubExternalTraffic(page, []);
	await seedLocalSettings(page);
	await page.goto("/");

	await expect(page.locator("#btn-about"), "the About button should announce a menu popup").toHaveAttribute(
		"aria-haspopup",
		"menu"
	);
	await expect(page.locator("#about-menu"), "the About menu should have the menu role").toHaveAttribute(
		"role",
		"menu"
	);
});
