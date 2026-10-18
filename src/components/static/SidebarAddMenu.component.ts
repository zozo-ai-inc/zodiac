import { openDropdownPortal, type DropdownPortal } from "../../utils/dropdownPortal";
import * as overlayService from "../../services/Overlay.service";

// Each sidebar tab has a + beside its search that always opens a menu of that tab's add, import and clear actions.
// The items keep their own ids, so the modules that own each action attach their handlers directly.
const triggers = document.querySelectorAll<HTMLButtonElement>("[data-sidebar-menu]");
if (triggers.length === 0) throw new Error("Missing DOM element: [data-sidebar-menu]");

const createPersonaButton = document.querySelector<HTMLButtonElement>("#btn-create-persona");
if (!createPersonaButton) throw new Error("Missing DOM element: #btn-create-persona");

createPersonaButton.addEventListener("click", () => overlayService.showAddPersonalityForm());

for (const trigger of triggers) {
	const menuId = trigger.getAttribute("aria-controls");
	const menu = menuId ? document.getElementById(menuId) : null;
	if (!menu) throw new Error(`Missing DOM element: #${menuId}`);

	let portal: DropdownPortal | null = null;
	const items = () => Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));

	function resetMenuState(): void {
		portal = null;
		trigger.setAttribute("aria-expanded", "false");
		document.removeEventListener("pointerdown", handleOutsidePointer, true);
	}

	function handleOutsidePointer(event: PointerEvent): void {
		const target = event.target as Node | null;
		if (target && (menu!.contains(target) || trigger.contains(target))) return;
		portal?.close();
	}

	function open(focusFirstItem: boolean): void {
		trigger.setAttribute("aria-expanded", "true");
		portal = openDropdownPortal(menu!, trigger, { offsetY: 4, onClose: resetMenuState });
		document.addEventListener("pointerdown", handleOutsidePointer, true);
		if (focusFirstItem) items()[0]?.focus();
	}

	trigger.addEventListener("click", (event) => {
		if (portal) {
			portal.close();
			return;
		}
		// A keyboard press reports no pointer detail, so move focus into the menu for arrow-key use.
		open(event.detail === 0);
	});

	// The chosen item's own handler runs first; the menu then closes behind it.
	menu.addEventListener("click", (event) => {
		if ((event.target as HTMLElement).closest('[role="menuitem"]')) portal?.close();
	});

	menu.addEventListener("keydown", (event) => {
		if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
		event.preventDefault();
		const list = items();
		const index = list.indexOf(document.activeElement as HTMLElement);
		const next =
			event.key === "Home"
				? 0
				: event.key === "End"
					? list.length - 1
					: (index + (event.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
		list[next]?.focus();
	});
}
