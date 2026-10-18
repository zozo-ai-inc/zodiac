import * as helpers from "../../utils/helpers";
import * as personalityService from "../../services/Personality.service";
import * as chatsService from "../../services/Chats.service";
import { db } from "../../services/Db.service";
import "./ChatSearch.component";

const hideSidebarButton = document.querySelector<HTMLButtonElement>("#btn-hide-sidebar");
const showSidebarButton = document.querySelector<HTMLButtonElement>("#btn-show-sidebar");
const sidebarViews = document.querySelectorAll<HTMLElement>(".sidebar-section");
const sidebar = document.querySelector<HTMLDivElement>(".sidebar");
const clearAllPersonalitiesButton = document.querySelector("#btn-clearall-personality");
const deleteAllChatsButton = document.querySelector("#btn-reset-chat");

const importPersonalityButton = document.querySelector("#btn-import-personality");
const clearAllDataButton = document.querySelector("#btn-clear-all-data");

if (
	!sidebar ||
	!hideSidebarButton ||
	!showSidebarButton ||
	!sidebarViews ||
	!clearAllPersonalitiesButton ||
	!deleteAllChatsButton ||
	!importPersonalityButton ||
	!clearAllDataButton
) {
	console.error("Sidebar component is missing some elements. Please check the HTML structure.");
	throw new Error("Sidebar component is not properly initialized.");
}
const mobileLayoutQuery = window.matchMedia("(max-width: 1032px)");

function isMobileSidebarOpen(): boolean {
	return mobileLayoutQuery.matches && !sidebar!.classList.contains("hidden") && sidebar!.style.display === "flex";
}

// Several modules hide the sidebar directly, so the toggle's state follows the element rather than the handlers.
function syncShowSidebarExpanded(): void {
	showSidebarButton!.setAttribute("aria-expanded", String(isMobileSidebarOpen()));
}

new MutationObserver(syncShowSidebarExpanded).observe(sidebar, {
	attributes: true,
	attributeFilter: ["class", "style"]
});
mobileLayoutQuery.addEventListener("change", syncShowSidebarExpanded);
syncShowSidebarExpanded();

function closeMobileSidebar(): void {
	helpers.hideElement(sidebar!);
	showSidebarButton!.focus({ preventScroll: true });
}

hideSidebarButton.addEventListener("click", closeMobileSidebar);
showSidebarButton.addEventListener("click", () => {
	sidebar.style.display = "flex";
	helpers.showElement(sidebar, false);
});

// Layers opened from the sidebar (menus, settings, overlays, sheets) claim Escape first.
document.addEventListener("keydown", (event) => {
	if (event.key !== "Escape" || event.defaultPrevented || !isMobileSidebarOpen()) return;
	if (document.body.classList.contains("settings-open")) return;
	if (!document.querySelector<HTMLElement>("#overlay")?.classList.contains("hidden")) return;
	if (document.querySelector("#surface-plane > .surface-plane__item:not(.hidden)")) return;
	event.preventDefault();
	closeMobileSidebar();
});
clearAllPersonalitiesButton.addEventListener(
	"click",
	() =>
		void (async () => {
			const confirmation = await helpers.confirmDialogDanger(
				"You are about to clear all your custom personalities. This action cannot be undone!"
			);
			if (confirmation) {
				void personalityService.removeAll();
			}
		})()
);
deleteAllChatsButton.addEventListener(
	"click",
	() =>
		void (async () => {
			const confirmation = await helpers.confirmDialogDanger(
				"You are about to wipe your chats. This action cannot be undone!"
			);
			if (confirmation) {
				await chatsService.deleteAllChats(db);
			}
		})()
);

importPersonalityButton.addEventListener("click", () => {
	document.querySelector<HTMLButtonElement>("#btn-import-data")?.click();
});

clearAllDataButton.addEventListener(
	"click",
	() =>
		void (async () => {
			const confirmation = await helpers.confirmDialogDanger(
				"You are about to clear all your data. This action cannot be undone!"
			);
			if (confirmation) {
				await db.delete();
				localStorage.clear();
				window.location.reload();
			}
		})()
);

// The mobile open/close leaves inline display, opacity and transition behind, and may have a fade still pending.
// Crossing the breakpoint hands the sidebar back to the stylesheet: always shown on desktop, closed on mobile.
mobileLayoutQuery.addEventListener("change", () => {
	helpers.cancelVisibilityChange(sidebar);
	sidebar.classList.remove("hidden");
	sidebar.style.removeProperty("display");
	sidebar.style.removeProperty("opacity");
	sidebar.style.removeProperty("transition");
});
