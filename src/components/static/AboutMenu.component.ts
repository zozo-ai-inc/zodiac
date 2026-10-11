import { dispatchEmptyAppEvent } from "../../events";
import { openDropdownPortal, type DropdownPortal } from "../../utils/dropdownPortal";

const aboutButtonElement = document.querySelector<HTMLButtonElement>("#btn-about");
const aboutMenuElement = document.querySelector<HTMLElement>("#about-menu");

if (!aboutButtonElement || !aboutMenuElement) {
	throw new Error("Missing DOM elements: #btn-about or #about-menu");
}

const aboutButton = aboutButtonElement;
const aboutMenu = aboutMenuElement;

let menuPortal: DropdownPortal | null = null;

function openMenu(): void {
	aboutButton.setAttribute("aria-expanded", "true");
	menuPortal = openDropdownPortal(aboutMenu, aboutButton, {
		offsetY: 4,
		onClose: () => {
			menuPortal = null;
			aboutButton.setAttribute("aria-expanded", "false");
			dispatchEmptyAppEvent("about-menu-closed");
		}
	});
	// The portal moves the menu to the end of <body>, out of the button's tab order.
	aboutMenu.querySelector<HTMLElement>(".about-menu-item")?.focus({ preventScroll: true });
}

aboutButton.addEventListener("click", () => {
	if (menuPortal) {
		menuPortal.close();
	} else {
		openMenu();
	}
});

document.addEventListener("click", (event) => {
	const target = event.target as Element | null;
	// Clicks on the button are left to its own toggle, and the menu's own padding is not a dismissal.
	if (!menuPortal || aboutButton.contains(target)) return;
	if (aboutMenu.contains(target) && !target?.closest(".about-menu-item")) return;
	// Anything else, including a followed link, closes the menu.
	menuPortal.close();
});

aboutMenu.addEventListener("focusout", (event) => {
	const next = event.relatedTarget as Node | null;
	// Focus leaving for anywhere but the menu or its button, as when tabbing past the last item, closes it.
	if (menuPortal && !aboutMenu.contains(next) && !aboutButton.contains(next)) {
		menuPortal.close();
	}
});

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && menuPortal) {
		menuPortal.close();
		aboutButton.focus({ preventScroll: true });
	}
});
