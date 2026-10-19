import { describe, expect, it, vi } from "vitest";

// Sync-implementation test: what fetchSyncedChatsMetadata reports when Supabase fails to return the chats.
const supabaseState = vi.hoisted(() => ({ chatsError: { message: "network request failed" } as unknown }));

function query(result: () => unknown) {
	// A chainable stand-in for the Supabase query builder that resolves to `result` when awaited.
	const builder: Record<string, unknown> = {};
	for (const method of ["select", "eq", "order", "limit", "gt"]) builder[method] = () => builder;
	builder.maybeSingle = async () => result();
	builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
	return builder;
}

vi.mock("../../../src/services/Supabase.service", () => ({
	supabase: {
		from: (table: string) =>
			table === "user_sync_preferences"
				? query(() => ({
						data: {
							sync_enabled: true,
							encryption_salt: null,
							key_verification: null,
							key_verification_iv: null
						},
						error: null
					}))
				: query(() => ({ data: null, error: supabaseState.chatsError }))
	},
	getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
	getSubscriptionTier: vi.fn(),
	getUserSubscription: vi.fn()
}));

vi.mock("../../../src/services/Crypto.service", () => ({
	isUnlocked: vi.fn(() => true),
	getCachedKey: vi.fn(() => ({})),
	fromHex: vi.fn(() => new Uint8Array())
}));

vi.mock("../../../src/services/BlobStore.service", () => ({}));
vi.mock("../../../src/services/Toast.service", () => ({ warn: vi.fn() }));
vi.mock("../../../src/services/Db.service", () => ({ db: {} }));
vi.mock("../../../src/utils/helpers", () => ({ fileToBase64: vi.fn() }));
vi.mock("../../../src/events", () => ({ dispatchAppEvent: vi.fn() }));

describe("synced chat metadata", () => {
	it("reports a failed read as missing rather than as an empty chat list", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const syncService = await import("../../../src/services/Sync.service");
		await syncService.fetchSyncPreferences();
		expect(syncService.isSyncActive()).toBe(true);

		const chats = await syncService.fetchSyncedChatsMetadata();

		expect(chats, "callers must be able to tell a failed read from an account with no chats").toBeNull();
	});
});
