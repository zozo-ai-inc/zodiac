import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "../../../src/services/Db.service";
import { makeChat } from "../../fixtures/chats";
import { resetIndexedDb } from "../../helpers/db";
import { bootstrapDom } from "../../helpers/dom";

vi.mock("highlight.js", () => ({
	default: {
		highlightAll: vi.fn()
	}
}));

vi.mock("../../../src/services/Settings.service", () => ({
	isMobile: vi.fn(() => false)
}));

vi.mock("../../../src/services/Personality.service", () => ({
	get: vi.fn(async () => ({
		name: "Mock Persona",
		image: "https://example.com/persona.png",
		description: "Mock persona",
		prompt: "Be helpful.",
		aggressiveness: 0,
		sensuality: 0,
		independence: 0,
		nsfw: false,
		internetEnabled: false,
		roleplayEnabled: false,
		toneExamples: [],
		tags: [],
		category: "assistant"
	})),
	getDefault: vi.fn(() => ({
		name: "Mock Persona",
		image: "https://example.com/persona.png",
		description: "Mock persona",
		prompt: "Be helpful.",
		aggressiveness: 0,
		sensuality: 0,
		independence: 0,
		nsfw: false,
		internetEnabled: false,
		roleplayEnabled: false,
		toneExamples: [],
		tags: [],
		category: "assistant"
	}))
}));

vi.mock("../../../src/services/Message.service", () => ({
	ensureRoundBlockUi: vi.fn()
}));

vi.mock("../../../src/services/Overlay.service", () => ({
	showMessageDebugModal: vi.fn()
}));

vi.mock("../../../src/services/Parser.service", () => ({
	parseMarkdownToHtml: vi.fn(async (text: string) => text),
	parseHtmlToMarkdown: vi.fn((text: string) => text)
}));

vi.mock("../../../src/services/Toast.service", () => ({
	info: vi.fn(),
	warn: vi.fn(),
	danger: vi.fn()
}));

// The sync boundary: tests switch cloud sync on and decide what reading synced chats returns.
const syncState = vi.hoisted(() => ({
	enabled: false,
	fetchSyncedChatsMetadata: vi.fn()
}));

vi.mock("../../../src/services/Sync.service", () => ({
	isOnlineSyncEnabled: vi.fn(() => syncState.enabled),
	isSyncActive: vi.fn(() => syncState.enabled),
	fetchSyncedChatsMetadata: syncState.fetchSyncedChatsMetadata,
	fetchSyncedChatMetadata: vi.fn(async () => null),
	hydrateLatestChatMessagesWindow: vi.fn(async () => null),
	hydrateOlderChatMessagesWindow: vi.fn(async () => null),
	upsertSyncedChat: vi.fn(async () => true),
	deleteSyncedChat: vi.fn(async () => true)
}));

vi.mock("../../../src/services/Pinning.service", () => ({
	getPinnedChatIds: vi.fn(() => []),
	isChatPinned: vi.fn(() => false),
	toggleChatPinned: vi.fn(async () => false),
	removeChatPin: vi.fn(async () => {}),
	clearChatPins: vi.fn(async () => {})
}));

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
	resolveThoughtSignature: vi.fn(async (part: { thoughtSignature?: string }) => part.thoughtSignature)
}));

vi.mock("../../../src/events", () => ({
	dispatchAppEvent: vi.fn((name: string, detail: unknown) => {
		window.dispatchEvent(new CustomEvent(name, { detail }));
	})
}));

function bootstrapChatDom(): void {
	bootstrapDom(`
        <div class="sidebar"></div>
        <div id="chatHistorySection"></div>
        <div id="chat-title"></div>
        <div id="chat-loading-indicator" class="hidden"></div>
        <div id="scrollable-chat-container">
            <div class="message-container"></div>
        </div>
    `);
}

async function loadServices() {
	const dbService = await import("../../../src/services/Db.service");
	const chatsService = await import("../../../src/services/Chats.service");
	return { db: dbService.db, chatsService };
}

function listedChatTitles(): string[] {
	return Array.from(document.querySelectorAll<HTMLElement>("#chatHistorySection .chat-title-text"), (element) =>
		(element.textContent ?? "").trim()
	);
}

describe("chat list refresh", () => {
	let db: Db | undefined;

	beforeEach(async () => {
		vi.resetModules();
		await resetIndexedDb();
		bootstrapChatDom();
		syncState.enabled = false;
		syncState.fetchSyncedChatsMetadata.mockReset();
	});

	afterEach(async () => {
		db?.close();
		db = undefined;
		await resetIndexedDb();
	});

	it("keeps the open chat open and highlighted when the list is rebuilt", async () => {
		const { db: testDb, chatsService } = await loadServices();
		db = testDb;
		await chatsService.addChatRecord(makeChat({ id: "chat-a", title: "Alpha", content: [] }));
		await chatsService.addChatRecord(makeChat({ id: "chat-b", title: "Beta", content: [] }));
		// Open the chat the way the sidebar does: its radio is checked and the chat is loaded.
		document.querySelector<HTMLInputElement>("#chatchat-b")!.click();
		await chatsService.loadChat("chat-b", testDb);
		expect(chatsService.getCurrentChatId()).toBe("chat-b");

		await chatsService.initialize();

		// The open chat is read from the sidebar, so losing the highlight would also make the app forget the chat.
		expect(chatsService.getCurrentChatId(), "the app should still know which chat is open").toBe("chat-b");
		expect(document.querySelector<HTMLInputElement>("input[name='currentChat']:checked")?.id).toBe("chatchat-b");
	});

	it("keeps the synced chat list when reading it from the cloud fails", async () => {
		syncState.enabled = true;
		syncState.fetchSyncedChatsMetadata
			.mockResolvedValueOnce([
				makeChat({ id: "chat-a", title: "Alpha", content: [] }),
				makeChat({ id: "chat-b", title: "Beta", content: [] })
			])
			// The read fails, for example because the device went offline before "Sync Now".
			.mockResolvedValueOnce(null);
		const { db: testDb, chatsService } = await loadServices();
		db = testDb;
		await chatsService.initialize();
		expect(listedChatTitles().sort()).toEqual(["Alpha", "Beta"]);

		await chatsService.initialize().catch(() => undefined);

		expect(listedChatTitles().sort(), "a failed refresh should not empty the sidebar").toEqual(["Alpha", "Beta"]);
	});
});
