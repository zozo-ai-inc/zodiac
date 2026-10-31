import * as syncService from "./Sync.service";

/** Lives apart from Takeout.service so Chats.service can share it without an import cycle. */
export function assertCloudExportReady(): void {
	if (!syncService.isSyncActive()) {
		throw new Error("Unlock Cloud Sync before exporting a complete takeout.");
	}
	const status = syncService.getSyncStatus();
	if (status === "offline") throw new Error("Cloud Sync is offline. Reconnect and sync before exporting.");
	if (status === "syncing") throw new Error("Cloud Sync is still syncing. Wait for it to finish before exporting.");
	if (status === "error") throw new Error("Cloud Sync has an error. Resolve it before exporting.");
	if (syncService.getPendingSyncOperationCount() > 0) {
		throw new Error("Cloud Sync has pending changes. Sync them before exporting.");
	}
}
