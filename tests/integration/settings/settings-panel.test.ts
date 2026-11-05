import { beforeEach, describe, expect, it, vi } from "vitest";

import { bootstrapAppDom } from "../../helpers/dom";

async function loadSettingsPanel(): Promise<void> {
	await import("../../../src/components/static/SettingsNavigation.component");
	await import("../../../src/components/static/SettingsPanel.component");
}

describe("chat header settings button", () => {
	beforeEach(() => {
		vi.resetModules();
		bootstrapAppDom();
	});

	it("opens settings on the page that was last open", async () => {
		await loadSettingsPanel();
		const headerGear = document.querySelector<HTMLButtonElement>("#btn-header-settings")!;
		const footerGear = document.querySelector<HTMLButtonElement>("#btn-open-settings")!;
		const settings = document.querySelector<HTMLElement>("#settings-sidebar")!;

		footerGear.click();
		document.querySelector<HTMLButtonElement>('[data-settings-target="chat"]')!.click();
		document.querySelector<HTMLButtonElement>("#btn-close-settings")!.click();
		expect(document.body.classList.contains("settings-open")).toBe(false);

		headerGear.click();

		expect(document.body.classList.contains("settings-open")).toBe(true);
		expect(settings.inert).toBe(false);
		expect(document.querySelector("#settings-sidebar-title")!.textContent).toBe("Chat Settings");
		expect(headerGear.getAttribute("aria-expanded")).toBe("true");
		expect(footerGear.getAttribute("aria-expanded")).toBe("true");
	});

	it("closes settings when tapped again", async () => {
		await loadSettingsPanel();
		const headerGear = document.querySelector<HTMLButtonElement>("#btn-header-settings")!;

		headerGear.click();
		headerGear.click();

		expect(document.body.classList.contains("settings-open")).toBe(false);
		expect(document.querySelector<HTMLElement>("#settings-sidebar")!.inert).toBe(true);
		expect(headerGear.getAttribute("aria-expanded")).toBe("false");
	});
});
