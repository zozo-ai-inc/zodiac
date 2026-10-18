import * as helpers from "../../utils/helpers";

const chatSearchInput = document.querySelector<HTMLInputElement>("#chat-search-input");
const chatSearchEmpty = document.querySelector<HTMLElement>("#chat-search-empty");

// Debounce timer for chat search
let chatSearchDebounceTimer: number;

if (!chatSearchInput || !chatSearchEmpty) {
	console.error("ChatSearch component is missing the search input element. Please check the HTML structure.");
	throw new Error("ChatSearch component is not properly initialized.");
}

chatSearchInput.addEventListener("input", () => {
	// Clear existing timer
	clearTimeout(chatSearchDebounceTimer);

	// Set new timer with 300ms delay
	chatSearchDebounceTimer = window.setTimeout(() => {
		performSearch();
	}, 300);
});

/**
 * Perform the actual search operation using fuzzy search
 */
function performSearch(): void {
	if (!chatSearchInput) {
		return;
	}

	const searchTerm = chatSearchInput.value.trim();
	const chatHistorySection = document.querySelector("#chatHistorySection");

	if (!chatHistorySection) {
		return;
	}

	const chatElements = chatHistorySection.querySelectorAll<HTMLLabelElement>(".label-currentchat");

	// If search term is empty, show all chats
	if (searchTerm === "") {
		chatSearchEmpty?.classList.add("hidden");
		chatElements.forEach((chatElement) => {
			chatElement.classList.remove("hidden");
		});
		return;
	}

	// Create array of chat elements with their fuzzy search scores
	const chatElementsWithScores: Array<{
		element: HTMLLabelElement;
		score: number;
	}> = [];

	chatElements.forEach((chatElement) => {
		const chatName = chatElement.querySelector(".chat-title-text")?.textContent;
		if (chatName) {
			const score = helpers.fuzzySearch(searchTerm, chatName);
			if (score !== null && score > 0.1) {
				// Minimum threshold for fuzzy matches
				chatElementsWithScores.push({
					element: chatElement,
					score: score
				});
			}
		}
	});

	// Sort by score (highest first) and show/hide elements
	chatElementsWithScores.sort((a, b) => b.score - a.score);

	const matchingElements = new Set(chatElementsWithScores.map((item) => item.element));
	// With no chats at all, the list's own empty state already speaks for itself.
	chatSearchEmpty?.classList.toggle("hidden", chatElements.length === 0 || matchingElements.size > 0);

	chatElements.forEach((chatElement) => {
		if (matchingElements.has(chatElement)) {
			chatElement.classList.remove("hidden");
		} else {
			chatElement.classList.add("hidden");
		}
	});
}
