import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "../../../src/services/Db.service";
import { exportChat } from "../../../src/services/Chats.service";
import * as blobStore from "../../../src/services/BlobStore.service";
import * as syncService from "../../../src/services/Sync.service";
import * as toastService from "../../../src/services/Toast.service";
import type { DbChat } from "../../../src/types/Chat";
import type { Message } from "../../../src/types/Message";
import { deserializeTakeoutChat, parseImportText, planTakeoutImport } from "../../../src/utils/takeout";
import { makeChat } from "../../fixtures/chats";
import { makeTextFile } from "../../fixtures/files";
import { makeUserMessage } from "../../fixtures/messages";

// Only the network edge is faked: materializeMessagesForPortableExport stays real, so these tests
// follow the same blob-to-bytes path the app takes.
vi.mock("../../../src/services/Sync.service", async (importOriginal) => ({
	...(await importOriginal<typeof syncService>()),
	isOnlineSyncEnabled: vi.fn(),
	isSyncActive: vi.fn(),
	getSyncStatus: vi.fn(),
	getPendingSyncOperationCount: vi.fn(),
	isChatSnapshotFullyHydrated: vi.fn(),
	fetchSyncedChatMetadata: vi.fn(),
	fetchAllSyncedChatMessages: vi.fn()
}));
vi.mock("../../../src/services/BlobStore.service", async (importOriginal) => ({
	...(await importOriginal<typeof blobStore>()),
	downloadDecryptedBlob: vi.fn()
}));
vi.mock("../../../src/services/Toast.service", () => ({ info: vi.fn(), warn: vi.fn(), danger: vi.fn() }));
// These query the full app shell at import time and take no part in exporting.
vi.mock("../../../src/services/Settings.service", () => ({ isMobile: vi.fn(() => false) }));
vi.mock("../../../src/services/Message.service", () => ({ ensureRoundBlockUi: vi.fn() }));
vi.mock("../../../src/components/dynamic/message", () => ({ messageElement: vi.fn() }));

const blobRef = (blobId: string) => ({ __blob: true as const, blobId, mimeType: "image/png", size: 4, iv: "00" });

/** The shape deserializeMessage gives a synced message: empty placeholders that only hold blob refs. */
function makeSyncedMessage(): Message {
	const placeholder = new File([], "photo.png", { type: "image/png" });
	(placeholder as File & { _blobRef?: unknown })._blobRef = blobRef("attachment-blob");
	return {
		role: "model",
		parts: [{ text: "here", attachments: [placeholder] }],
		generatedImages: [{ mimeType: "image/png", base64: "", _blobRef: blobRef("image-blob") }]
	} as Message;
}

function enableCloudSync(chatId: string): void {
	vi.mocked(syncService.isOnlineSyncEnabled).mockReturnValue(true);
	vi.mocked(syncService.isSyncActive).mockReturnValue(true);
	vi.mocked(syncService.getSyncStatus).mockReturnValue("synced");
	vi.mocked(syncService.getPendingSyncOperationCount).mockReturnValue(0);
	vi.mocked(syncService.isChatSnapshotFullyHydrated).mockReturnValue(true);
	vi.mocked(syncService.fetchSyncedChatMetadata).mockResolvedValue(makeChat({ id: chatId, content: [] }));
	vi.mocked(syncService.fetchAllSyncedChatMessages).mockResolvedValue([makeSyncedMessage()]);
	vi.mocked(blobStore.downloadDecryptedBlob).mockResolvedValue({
		data: new Uint8Array([137, 80, 78, 71]),
		mimeType: "image/png"
	});
}

async function exportedText(chatId: string): Promise<string> {
	const createObjectURL = vi.mocked(URL.createObjectURL);
	await exportChat(chatId);
	expect(createObjectURL).toHaveBeenCalledOnce();
	return await (createObjectURL.mock.calls[0][0] as Blob).text();
}

// jsdom Files do not survive Node's structuredClone, so this stops at the deserializer rather than
// planTakeoutImport. The real-browser path is covered by tests/e2e/settings/data-takeout.spec.ts.
async function restore(text: string): Promise<DbChat> {
	const parsed = await parseImportText(text, "chat_export.json");
	expect(parsed.kind).toBe("unified");
	return deserializeTakeoutChat(parsed.payload.chats![0]);
}

describe("exportChat", () => {
	beforeEach(() => {
		URL.createObjectURL = vi.fn(() => "blob:chat-export");
		URL.revokeObjectURL = vi.fn();
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("writes local attachment bytes into the file so a deleted chat can be restored from it", async () => {
		vi.mocked(syncService.isOnlineSyncEnabled).mockReturnValue(false);
		const attachment = makeTextFile("hello from the attachment", "note.txt");
		// Read through a spy for the same reason: fake-indexeddb would flatten the File.
		vi.spyOn(db.chats, "get").mockResolvedValue(
			makeChat({
				id: "local-chat",
				content: [
					makeUserMessage("see attached", { parts: [{ text: "see attached", attachments: [attachment] }] })
				]
			}) as never
		);

		const restored = await restore(await exportedText("local-chat"));

		const [file] = Array.from(restored.content[0].parts[0].attachments ?? []);
		expect(file?.name).toBe("note.txt");
		expect(await file?.text()).toBe("hello from the attachment");
	});

	it("writes cloud media bytes into the file instead of blob references", async () => {
		enableCloudSync("cloud-chat");

		const text = await exportedText("cloud-chat");

		expect(text).not.toContain("-blob");
		const [message] = (await restore(text)).content;
		const [file] = Array.from(message.parts[0].attachments ?? []);
		expect(file?.size).toBe(4);
		expect(message.generatedImages?.[0].base64).toBe("iVBORw==");
	});

	it("leaves the chat id out of the file so importing always creates a new chat", async () => {
		vi.mocked(syncService.isOnlineSyncEnabled).mockReturnValue(false);
		vi.spyOn(db.chats, "get").mockResolvedValue(makeChat({ id: "exported-chat" }) as never);

		const text = await exportedText("exported-chat");

		expect(text).not.toContain("exported-chat");
		const parsed = await parseImportText(text, "chat_export.json");
		const plan = planTakeoutImport({
			payload: parsed.payload,
			existingChats: [makeChat({ id: "exported-chat", content: [makeUserMessage("moved ahead")] })],
			existingPersonas: [],
			resolution: "overwrite",
			createId: () => "new-chat"
		});
		expect(plan.chats.map((chat) => chat.id)).toEqual(["new-chat"]);
		expect(plan.conflicts.chats).toBe(0);
	});

	it("exports the rest of a chat and names what is gone when a blob no longer exists", async () => {
		enableCloudSync("lost-blob-chat");
		vi.mocked(blobStore.downloadDecryptedBlob).mockRejectedValue(new blobStore.BlobNotFoundError("image-blob"));

		const text = await exportedText("lost-blob-chat");

		const [message] = (await restore(text)).content;
		expect(message.parts[0].text).toBe("here");
		expect(message.parts[0].attachments ?? []).toHaveLength(0);
		expect(message.generatedImages ?? []).toHaveLength(0);
		expect(toastService.warn).toHaveBeenCalledWith(expect.objectContaining({ title: "Chat exported" }));
		expect(toastService.warn).toHaveBeenCalledWith(
			expect.objectContaining({ text: expect.stringMatching(/2 attachments or images/) })
		);
	});

	it("refuses to export when media cannot be downloaded right now", async () => {
		enableCloudSync("offline-blob-chat");
		vi.mocked(blobStore.downloadDecryptedBlob).mockRejectedValue(new Error("BlobStore: download failed"));

		await exportChat("offline-blob-chat");

		expect(URL.createObjectURL).not.toHaveBeenCalled();
		expect(toastService.danger).toHaveBeenCalledWith(expect.objectContaining({ title: "Export Failed" }));
	});

	it("refuses to export while local changes have not reached the cloud", async () => {
		enableCloudSync("pending-chat");
		vi.mocked(syncService.getPendingSyncOperationCount).mockReturnValue(1);

		await exportChat("pending-chat");

		expect(URL.createObjectURL).not.toHaveBeenCalled();
		expect(toastService.danger).toHaveBeenCalledWith(expect.objectContaining({ title: "Export Failed" }));
	});

	it("refuses to export a cloud chat whose message history came back incomplete", async () => {
		enableCloudSync("partial-chat");
		vi.mocked(syncService.isChatSnapshotFullyHydrated).mockReturnValue(false);

		await exportChat("partial-chat");

		expect(URL.createObjectURL).not.toHaveBeenCalled();
		expect(toastService.danger).toHaveBeenCalledWith(expect.objectContaining({ title: "Export Failed" }));
	});
});
