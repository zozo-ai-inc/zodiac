import { onAppEvent } from "../../events";

const settingsSidebarElement = document.querySelector<HTMLElement>("#settings-sidebar");
const openSettingsButtonElement = document.querySelector<HTMLButtonElement>("#btn-open-settings");
const closeSettingsButtonElement = document.querySelector<HTMLButtonElement>("#btn-close-settings");

if (!settingsSidebarElement || !openSettingsButtonElement || !closeSettingsButtonElement) {
	throw new Error("Missing DOM elements: #settings-sidebar, #btn-open-settings or #btn-close-settings");
}

const settingsSidebar = settingsSidebarElement;
const openSettingsButton = openSettingsButtonElement;
const closeSettingsButton = closeSettingsButtonElement;

// On <body> because the sidebar also reacts: on narrower desktops it gives way while settings is open.
const OPEN_CLASS = "settings-open";

let focusRestoreTarget: HTMLElement | null = null;

function isOpen(): boolean {
	return document.body.classList.contains(OPEN_CLASS);
}

function openSettings(): void {
	if (isOpen()) return;
	focusRestoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	settingsSidebar.inert = false;
	document.body.classList.add(OPEN_CLASS);
	openSettingsButton.setAttribute("aria-expanded", "true");
	settingsSidebar.focus({ preventScroll: true });
}

function closeSettings(): void {
	if (!isOpen()) return;
	const hadFocus = settingsSidebar.contains(document.activeElement);
	document.body.classList.remove(OPEN_CLASS);
	// Closed, the panel is only moved off-screen, so it must not stay reachable by keyboard.
	settingsSidebar.inert = true;
	openSettingsButton.setAttribute("aria-expanded", "false");
	if (hadFocus && focusRestoreTarget?.isConnected) {
		focusRestoreTarget.focus({ preventScroll: true });
	}
	focusRestoreTarget = null;
}

openSettingsButton.addEventListener("click", () => {
	if (isOpen()) {
		closeSettings();
	} else {
		openSettings();
	}
});

closeSettingsButton.addEventListener("click", closeSettings);

settingsSidebar.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && !event.defaultPrevented) {
		closeSettings();
	}
});

onAppEvent("open-settings", openSettings);
