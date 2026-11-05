import { beforeEach, describe, expect, it, vi } from "vitest";

import { SETTINGS_STORAGE_KEYS } from "../../../src/constants/SettingsStorageKeys";
import { addHighlightThemeLink, bootstrapAppDom } from "../../helpers/dom";

const syncServiceMock = vi.hoisted(() => ({
	isSyncActive: vi.fn(() => true),
	queueSettingsPush: vi.fn()
}));

vi.mock("../../../src/services/Sync.service", () => syncServiceMock);

function setStoredTheme(colorTheme: string, mode: "light" | "dark"): void {
	localStorage.setItem(
		SETTINGS_STORAGE_KEYS.THEME_SETTINGS,
		JSON.stringify({
			colorTheme,
			mode,
			preference: "manual"
		})
	);
}

function bootstrapThemeControlsDom(): void {
	bootstrapAppDom();
}

describe("synced theme settings", () => {
	beforeEach(() => {
		vi.resetModules();
		syncServiceMock.isSyncActive.mockReturnValue(true);
		syncServiceMock.queueSettingsPush.mockClear();
		bootstrapThemeControlsDom();
		addHighlightThemeLink();
	});

	it("rehydrates applied styles and controls after synced settings replace storage", async () => {
		setStoredTheme("red", "dark");

		const { themeService } = await import("../../../src/services/Theme.service");
		themeService.initialize();
		await import("../../../src/components/static/SteppedSlider.component");
		await import("../../../src/components/static/ThemeControls.component");

		expect(document.documentElement.getAttribute("data-theme")).toBe("red");
		expect(document.documentElement.getAttribute("data-mode")).toBe("dark");
		expect(document.querySelector<HTMLInputElement>("#themeMode")?.value).toBe("2");

		setStoredTheme("blue", "light");
		window.dispatchEvent(new CustomEvent("settings-loaded-from-storage", { detail: {} }));

		expect(document.documentElement.getAttribute("data-theme")).toBe("blue");
		expect(document.documentElement.getAttribute("data-mode")).toBe("light");
		expect(document.querySelector<HTMLInputElement>("#themeMode")?.value).toBe("0");
		expect(document.querySelector<HTMLButtonElement>('[data-value="0"]')?.classList.contains("active")).toBe(true);
		expect(
			document.querySelector<HTMLButtonElement>('.theme-btn[data-theme="blue"]')?.classList.contains("active")
		).toBe(true);
		expect(syncServiceMock.queueSettingsPush).not.toHaveBeenCalled();
	});

	it("pushes current settings when the user changes theme color or mode", async () => {
		setStoredTheme("blue", "light");

		const { themeService } = await import("../../../src/services/Theme.service");
		themeService.initialize();
		await import("../../../src/components/static/SteppedSlider.component");
		await import("../../../src/components/static/ThemeControls.component");

		document.querySelector<HTMLButtonElement>('.theme-btn[data-theme="red"]')?.click();

		expect(themeService.getSettings().colorTheme).toBe("red");
		expect(syncServiceMock.queueSettingsPush).toHaveBeenCalledTimes(1);
		expect(syncServiceMock.queueSettingsPush).toHaveBeenLastCalledWith({ label: "theme settings" });

		document.querySelector<HTMLButtonElement>('[data-value="2"]')?.click();

		expect(themeService.getSettings().mode).toBe("dark");
		expect(syncServiceMock.queueSettingsPush).toHaveBeenCalledTimes(2);
		expect(syncServiceMock.queueSettingsPush).toHaveBeenLastCalledWith({ label: "theme settings" });
	});
});
