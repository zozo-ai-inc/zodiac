import * as overlayService from "../../services/Overlay.service";
import { getVersion } from "../../utils/helpers";

const whatsNewButton = document.querySelector("#btn-whatsnew")!;
const aboutButton = document.querySelector("#btn-about")!;

//setup version number on the about menu entry and header
whatsNewButton.querySelector("#whatsnew-version")!.textContent = `${getVersion()}`;
document.querySelector("#header-version")!.textContent = `What's New in ${getVersion()}`;

whatsNewButton.addEventListener("click", () => {
	overlayService.showChangelog();
});
//an unseen version marks the about btn and glows the changelog entry until the about menu is dismissed
if (localStorage.getItem("version") != getVersion()) {
	aboutButton.classList.add("has-update");
	whatsNewButton.classList.add("unread");
	window.addEventListener(
		"about-menu-closed",
		() => {
			localStorage.setItem("version", getVersion());
			aboutButton.classList.remove("has-update");
			whatsNewButton.classList.remove("unread");
		},
		{ once: true }
	);
}
