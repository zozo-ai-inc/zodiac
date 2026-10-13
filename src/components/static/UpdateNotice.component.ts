import { APP_VERSION, LATEST_RELEASE_API_URL, OFFICIAL_HOSTNAME } from "../../constants/App";
import { onAppEvent } from "../../events";
import { getDeployUpdate, getReleaseUpdate, type AppUpdate } from "../../utils/versionCheck";

const RELOADED_BUILD_STORAGE_KEY = "update_notice_reloaded_build";
const DISMISSED_RELEASE_STORAGE_KEY = "update_notice_dismissed_release";
const MINUTE_MS = 60_000;

const messageBoxElement = document.querySelector<HTMLDivElement>("#message-box");
const messageInputElement = document.querySelector<HTMLDivElement>("#messageInput");
const attachmentsInputElement = document.querySelector<HTMLInputElement>("#attachments");
const noticeElement = document.querySelector<HTMLDivElement>("#update-notice");
const titleElement = document.querySelector<HTMLElement>("#update-notice-title");
const descriptionElement = document.querySelector<HTMLElement>("#update-notice-description");
const refreshButtonElement = document.querySelector<HTMLButtonElement>("#btn-update-refresh");
const releaseLinkElement = document.querySelector<HTMLAnchorElement>("#link-update-release");
const dismissButtonElement = document.querySelector<HTMLButtonElement>("#btn-update-dismiss");

if (
	!messageBoxElement ||
	!messageInputElement ||
	!attachmentsInputElement ||
	!noticeElement ||
	!titleElement ||
	!descriptionElement ||
	!refreshButtonElement ||
	!releaseLinkElement ||
	!dismissButtonElement
) {
	throw new Error("Missing update notice DOM elements");
}

const messageBox = messageBoxElement;
const messageInput = messageInputElement;
const attachmentsInput = attachmentsInputElement;
const notice = noticeElement;
const title = titleElement;
const description = descriptionElement;
const refreshButton = refreshButtonElement;
const releaseLink = releaseLinkElement;
const dismissButton = dismissButtonElement;

const buildId = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : null;
// Only the official deployment moves to a new build on refresh. Anywhere else the
// build is whatever the host served, so the notice points at the newer release instead.
const isOfficialHost = window.location.hostname === OFFICIAL_HOSTNAME;
const checkIntervalMs = isOfficialHost ? 5 * MINUTE_MS : 6 * 60 * MINUTE_MS;
const refocusCheckGapMs = isOfficialHost ? MINUTE_MS : checkIntervalMs;

let pendingUpdate: AppUpdate | null = null;
let anyGenerating = false;
let lastCheckedAt = 0;
let checkTimer: number | undefined;

function readStorage(storage: "localStorage" | "sessionStorage", key: string): string | null {
	try {
		return window[storage].getItem(key);
	} catch {
		return null;
	}
}

function writeStorage(storage: "localStorage" | "sessionStorage", key: string, value: string): void {
	try {
		window[storage].setItem(key, value);
	} catch {
		// Storage unavailable; the choice only lasts for this page load.
	}
}

async function fetchJson(url: string): Promise<unknown> {
	try {
		const response = await fetch(url, { cache: "no-store" });
		return response.ok ? await response.json() : null;
	} catch {
		return null;
	}
}

async function findUpdate(currentBuildId: string): Promise<AppUpdate | null> {
	if (isOfficialHost) {
		const update = getDeployUpdate(await fetchJson("/version.json"), currentBuildId);
		// A refresh that still served this build must not lock the composer again for the same deploy.
		return update?.kind === "deploy" && update.buildId === readStorage("sessionStorage", RELOADED_BUILD_STORAGE_KEY)
			? null
			: update;
	}

	const update = getReleaseUpdate(await fetchJson(LATEST_RELEASE_API_URL), APP_VERSION);
	return update?.kind === "release" && update.version === readStorage("localStorage", DISMISSED_RELEASE_STORAGE_KEY)
		? null
		: update;
}

function isComposerIdle(): boolean {
	return !anyGenerating && !messageInput.textContent?.trim() && !attachmentsInput.files?.length;
}

// Taking over mid-draft or mid-response would cost the user their work, so wait for a quiet composer.
function presentPendingUpdate(): void {
	if (!pendingUpdate || !isComposerIdle() || messageBox.classList.contains("update-notice-active")) {
		return;
	}

	const isRelease = pendingUpdate.kind === "release";
	if (pendingUpdate.kind === "release") {
		title.textContent = `Zozo Chat ${pendingUpdate.version} is available`;
		description.textContent = `You're running ${APP_VERSION}. Update your installation to get the latest changes.`;
		releaseLink.href = pendingUpdate.url;
	} else {
		title.textContent = "A new version of Zozo Chat is available";
		description.textContent = "Refresh to keep chatting.";
	}
	refreshButton.classList.toggle("hidden", isRelease);
	releaseLink.classList.toggle("hidden", !isRelease);
	dismissButton.classList.toggle("hidden", !isRelease);

	if (messageInput.contains(document.activeElement)) {
		messageInput.blur();
	}
	notice.classList.remove("hidden");
	messageBox.classList.add("update-notice-active");
}

export function showUpdateNotice(update: AppUpdate): void {
	pendingUpdate = update;
	window.clearInterval(checkTimer);
	presentPendingUpdate();
}

async function checkForUpdate(currentBuildId: string): Promise<void> {
	if (pendingUpdate) {
		return;
	}

	lastCheckedAt = Date.now();
	const update = await findUpdate(currentBuildId);
	if (update) {
		showUpdateNotice(update);
	}
}

refreshButton.addEventListener("click", () => {
	if (pendingUpdate?.kind === "deploy") {
		writeStorage("sessionStorage", RELOADED_BUILD_STORAGE_KEY, pendingUpdate.buildId);
	}
	window.location.reload();
});

dismissButton.addEventListener("click", () => {
	if (pendingUpdate?.kind !== "release") {
		return;
	}

	writeStorage("localStorage", DISMISSED_RELEASE_STORAGE_KEY, pendingUpdate.version);
	pendingUpdate = null;
	notice.classList.add("hidden");
	messageBox.classList.remove("update-notice-active");
});

messageInput.addEventListener("input", presentPendingUpdate);
// The chat input drops the file from its own state while handling this same event.
document.addEventListener("attachmentremoved", () => window.setTimeout(presentPendingUpdate), true);
onAppEvent("generation-state-changed", (event) => {
	anyGenerating = event.detail.anyGenerating;
	presentPendingUpdate();
});

// The dev server has no build identity and changes constantly, so it never checks.
if (buildId) {
	checkTimer = window.setInterval(() => void checkForUpdate(buildId), checkIntervalMs);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible" && Date.now() - lastCheckedAt >= refocusCheckGapMs) {
			void checkForUpdate(buildId);
		}
	});
	void checkForUpdate(buildId);
}
