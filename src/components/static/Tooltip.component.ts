import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";
import "tippy.js/themes/material.css";

const tooltips = document.querySelectorAll(".tooltip");
// Tooltips sit on the body, so they take the app's tooltip layer to stay above overlays and sheets.
const tooltipLayer = Number(getComputedStyle(document.documentElement).getPropertyValue("--layer-tooltip")) || 10040;

for (const tooltip of tooltips) {
	tippy(tooltip, {
		content: tooltip.getAttribute("info") || "",
		theme: "material",
		placement: "top",
		arrow: true,
		zIndex: tooltipLayer
	});
}
