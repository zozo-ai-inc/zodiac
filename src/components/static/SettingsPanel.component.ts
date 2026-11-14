import { onAppEvent } from "../../events";

const settingsSidebarElement = document.querySelector<HTMLElement>("#settings-sidebar");
const openSettingsButtonElement = document.querySelector<HTMLButtonElement>("#btn-open-settings");
const headerSettingsButtonElement = document.querySelector<HTMLButtonElement>("#btn-header-settings");
const closeSettingsButtonElement = document.querySelector<HTMLButtonElement>("#btn-close-settings");

if (
	!settingsSidebarElement ||
	!openSettingsButtonElement ||
	!headerSettingsButtonElement ||
	!closeSettingsButtonElement
) {
	throw new Error(
		"Missing DOM elements: #settings-sidebar, #btn-open-settings, #btn-header-settings or #btn-close-settings"
	);
}

const settingsSidebar = settingsSidebarElement;
// The sidebar footer gear, and the mobile chat header's gear for reaching settings without the sidebar.
const openSettingsButtons = [openSettingsButtonElement, headerSettingsButtonElement];
const closeSettingsButton = closeSettingsButtonElement;

// On <body> because the sidebar also reacts: on narrower desktops it gives way while settings is open.
const OPEN_CLASS = "settings-open";

const NON_TEXT_INPUT_TYPES = ["button", "checkbox", "color", "file", "image", "radio", "range", "reset", "submit"];

let focusRestoreTarget: HTMLElement | null = null;

function isOpen(): boolean {
	return document.body.classList.contains(OPEN_CLASS);
}

function openSettings(): void {
	if (isOpen()) return;
	focusRestoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	settingsSidebar.inert = false;
	document.body.classList.add(OPEN_CLASS);
	for (const button of openSettingsButtons) button.setAttribute("aria-expanded", "true");
	settingsSidebar.focus({ preventScroll: true });
}

function closeSettings(): void {
	if (!isOpen()) return;
	const hadFocus = settingsSidebar.contains(document.activeElement);
	document.body.classList.remove(OPEN_CLASS);
	// Closed, the panel is only moved off-screen, so it must not stay reachable by keyboard.
	settingsSidebar.inert = true;
	for (const button of openSettingsButtons) button.setAttribute("aria-expanded", "false");
	if (hadFocus && focusRestoreTarget?.isConnected) {
		focusRestoreTarget.focus({ preventScroll: true });
	}
	focusRestoreTarget = null;
}

for (const button of openSettingsButtons) {
	button.addEventListener("click", () => {
		if (isOpen()) {
			closeSettings();
		} else {
			openSettings();
		}
	});
}

closeSettingsButton.addEventListener("click", closeSettings);

function isTextEntry(target: EventTarget | null): boolean {
	if (target instanceof HTMLTextAreaElement) return true;
	if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.includes(target.type);
	return target instanceof HTMLElement && target.isContentEditable;
}

settingsSidebar.addEventListener("keydown", (event) => {
	if (event.key !== "Escape" || event.defaultPrevented) return;
	// Escape in a field abandons the edit, not the panel.
	if (isTextEntry(event.target)) return;
	event.preventDefault();
	closeSettings();
});

onAppEvent("open-settings", openSettings);
