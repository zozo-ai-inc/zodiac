import { beforeEach, describe, expect, it, vi } from "vitest";

import { bootstrapAppDom } from "../../helpers/dom";

async function loadChatTitle(): Promise<{ button: HTMLButtonElement; title: HTMLElement }> {
	await import("../../../src/components/static/ChatTitle.component");
	return {
		button: document.querySelector<HTMLButtonElement>("#btn-chat-title")!,
		title: document.querySelector<HTMLElement>("#chat-title")!
	};
}

describe("mobile chat title", () => {
	beforeEach(() => {
		vi.resetModules();
		bootstrapAppDom();
	});

	it("expands to the full title when pressed and collapses when pressed again", async () => {
		const { button, title } = await loadChatTitle();
		title.textContent = "A title far too long to fit on one line of a phone screen";

		button.click();
		expect(button.getAttribute("aria-expanded")).toBe("true");

		button.click();
		expect(button.getAttribute("aria-expanded")).toBe("false");
	});

	it("starts collapsed again when another chat's title loads", async () => {
		const { button, title } = await loadChatTitle();
		title.textContent = "First chat";
		button.click();

		title.textContent = "Second chat";
		// The reset runs from a MutationObserver, which reports after the current task.
		await Promise.resolve();

		expect(button.getAttribute("aria-expanded")).toBe("false");
	});
});
