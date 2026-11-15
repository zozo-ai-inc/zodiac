const chatTitleButton = document.querySelector<HTMLButtonElement>("#btn-chat-title");
const chatTitle = document.querySelector<HTMLElement>("#chat-title");
if (!chatTitleButton || !chatTitle) throw new Error("Missing DOM elements: #btn-chat-title or #chat-title");

// The mobile header cuts long titles to one line; pressing the title shows it in full.
chatTitleButton.addEventListener("click", () => {
	const expanded = chatTitleButton.getAttribute("aria-expanded") === "true";
	chatTitleButton.setAttribute("aria-expanded", String(!expanded));
});

// A new title starts cut off again, whichever path set it.
new MutationObserver(() => chatTitleButton.setAttribute("aria-expanded", "false")).observe(chatTitle, {
	childList: true,
	characterData: true,
	subtree: true
});

export { chatTitleButton };
