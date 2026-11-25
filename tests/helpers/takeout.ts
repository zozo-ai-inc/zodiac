import type { TakeoutDocument } from "../../src/types/Takeout";

// Re-signs a hand-edited takeout in place, the way createTakeoutDocument signs a real export.
export async function resign(takeout: TakeoutDocument): Promise<void> {
	const { integrity: _oldIntegrity, ...content } = takeout;
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(content)));
	takeout.integrity.digest = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
		""
	);
}
