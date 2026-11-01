import { beforeEach, describe, expect, it, vi } from "vitest";

const download = vi.hoisted(() => vi.fn());

vi.mock("../../src/services/Supabase.service", () => ({
	getCurrentUser: vi.fn(async () => ({ id: "user" })),
	supabase: { storage: { from: () => ({ download }) } }
}));
vi.mock("../../src/services/Crypto.service", () => ({ getCachedKey: vi.fn(() => ({})), fromHex: vi.fn() }));

import { BlobNotFoundError, downloadDecryptedBlob } from "../../src/services/BlobStore.service";

const ref = { __blob: true as const, blobId: "blob", mimeType: "image/png", size: 4, iv: "00" };

describe("downloadDecryptedBlob", () => {
	beforeEach(() => download.mockReset());

	it("reports a blob that no longer exists, which storage answers with HTTP 400", async () => {
		download.mockResolvedValue({
			data: null,
			error: { message: "Object not found", status: 400, statusCode: "404" }
		});

		await expect(downloadDecryptedBlob(ref)).rejects.toBeInstanceOf(BlobNotFoundError);
	});

	it("keeps other failures retryable", async () => {
		download.mockResolvedValue({
			data: null,
			error: { message: "Service unavailable", status: 503, statusCode: "503" }
		});

		const failure = await downloadDecryptedBlob(ref).catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(Error);
		expect(failure).not.toBeInstanceOf(BlobNotFoundError);
	});
});
