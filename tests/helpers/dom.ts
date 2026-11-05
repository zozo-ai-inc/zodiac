import appHtml from "../../src/index.html?raw";

const APP_MARKUP = new DOMParser().parseFromString(appHtml, "text/html").body.innerHTML;

export function bootstrapDom(markup = ""): void {
	document.body.innerHTML = markup;
}

// The real app shell from src/index.html, so tests break when the markup and components disagree.
// Its scripts stay inert: markup set through innerHTML never runs them.
export function bootstrapAppDom(): void {
	document.body.innerHTML = APP_MARKUP;
}

export function addHighlightThemeLink(): HTMLLinkElement {
	const link = document.createElement("link");
	link.setAttribute("data-highlight-theme", "true");
	document.head.append(link);
	return link;
}
