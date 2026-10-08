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
		}
	});
	// The portal moves the menu to the end of <body>, out of the button's tab order.
	aboutMenu.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
}

aboutButton.addEventListener("click", () => {
	if (menuPortal) {
		menuPortal.close();
	} else {
		openMenu();
	}
});

document.addEventListener("click", (event) => {
	// Clicks on the button are left to its own toggle; anything else, including a followed link, closes the menu.
	if (menuPortal && !aboutButton.contains(event.target as Node | null)) {
		menuPortal.close();
	}
});

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && menuPortal) {
		menuPortal.close();
		aboutButton.focus({ preventScroll: true });
	}
});
