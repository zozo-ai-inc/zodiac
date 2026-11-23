import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Message } from "../../../src/types/Message";
import { makeUserMessage } from "../../fixtures/messages";
import { waitForCondition } from "../../helpers/async";

// Render-contract checks for the user message attachment chips. They call
// messageElement() directly in JSDOM, so they do not cover the composer or
// the send flow that stores the attachment.

const chatState: { content: Message[] } = { content: [] };

vi.mock("highlight.js", () => ({ default: { highlightAll: vi.fn() } }));

vi.mock("../../../src/services/Settings.service", () => ({ isMobile: vi.fn(() => false) }));

vi.mock("../../../src/services/Personality.service", () => ({
	get: vi.fn(async () => undefined),
	getDefault: vi.fn(() => ({ name: "Mock Persona", image: "" }))
}));

vi.mock("../../../src/services/Chats.service", () => ({
	getCurrentChat: vi.fn(async () => ({ id: "chat", content: chatState.content }))
}));

vi.mock("../../../src/services/Message.service", () => ({
	regenerate: vi.fn(async () => {}),
	ensureRoundBlockUi: vi.fn()
}));

vi.mock("../../../src/services/Overlay.service", () => ({ showMessageDebugModal: vi.fn() }));

vi.mock("../../../src/services/Parser.service", () => ({
	parseMarkdownToHtml: vi.fn(async (text: string) => text),
	parseHtmlToMarkdown: vi.fn((text: string) => text)
}));

vi.mock("../../../src/services/Toast.service", () => ({ info: vi.fn(), warn: vi.fn(), danger: vi.fn() }));

vi.mock("../../../src/utils/helpers", () => ({
	getDecoded: vi.fn(async (value: string) => value),
	getSanitized: vi.fn((value: string) => value),
	messageContainerScrollToBottom: vi.fn(),
	hideElement: vi.fn(),
	showElement: vi.fn()
}));

vi.mock("../../../src/utils/codeBlocks", () => ({
	enhanceCodeBlocks: vi.fn(),
	stripCodeBlockEnhancements: vi.fn()
}));

vi.mock("../../../src/utils/blobResolver", () => ({
	resolveAttachmentFile: vi.fn(),
	resolveGeneratedImageSrc: vi.fn(),
	resolveThoughtSignature: vi.fn(async () => undefined)
}));

vi.mock("../../../src/events", () => ({ dispatchAppEvent: vi.fn() }));

function chipNames(element: HTMLElement): string[] {
	return Array.from(element.querySelectorAll<HTMLElement>(".attachment-preview-container .attachment-name")).map(
		(name) => name.textContent ?? ""
	);
}

async function renderMessageWithAttachments(): Promise<HTMLElement> {
	const { messageElement } = await import("../../../src/components/dynamic/message");
	const message = makeUserMessage("see attached", {
		parts: [
			{
				text: "see attached",
				attachments: [
					new File(['{"a":1}'], "data.json", { type: "application/json" }),
					new File(["# notes"], "notes.md", { type: "text/markdown" })
				]
			}
		]
	});
	chatState.content = [message];
	const element = await messageElement(message, 0);
	document.body.replaceChildren(element);
	return element;
}

describe("user message attachment chips", () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.replaceChildren();
	});

	it("shows a chip for JSON and Markdown attachments on a sent message", async () => {
		const element = await renderMessageWithAttachments();

		expect(chipNames(element)).toEqual(["data.json", "notes.md"]);
	});

	it("keeps JSON and Markdown attachment chips while editing the message", async () => {
		const element = await renderMessageWithAttachments();

		element.querySelector<HTMLButtonElement>(".btn-edit")?.click();
		await waitForCondition(
			() => element.querySelector(".message-text")?.getAttribute("contenteditable") === "true",
			"Timed out waiting for message edit mode"
		);

		expect(element.querySelectorAll(".editable-attachment")).toHaveLength(2);
		expect(chipNames(element)).toEqual(["data.json", "notes.md"]);

		// Removing one attachment re-renders the remaining editable chips.
		element.querySelector<HTMLButtonElement>(".btn-remove-attachment")?.click();
		expect(chipNames(element)).toEqual(["notes.md"]);

		// Escape restores the original attachment list.
		element
			.querySelector<HTMLElement>(".message-text")
			?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		expect(chipNames(element)).toEqual(["data.json", "notes.md"]);
	});
});
