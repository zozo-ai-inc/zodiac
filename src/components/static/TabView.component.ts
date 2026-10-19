import * as helpers from "../../utils/helpers";
const tabGroups = document.querySelectorAll<HTMLElement>(".navbar");

interface TabView {
	setActiveTab: (targetIndex: number) => void;
	activeTabIndex: number;
	tabs: NodeListOf<HTMLElement>;
	tabHighlight: HTMLElement;
	views: HTMLCollectionOf<HTMLElement>;
}

for (const tabGroup of tabGroups) {
	if (tabGroup.dataset.tabview === "manual") {
		continue;
	}
	const tabHighlight = tabGroup.querySelector<HTMLElement>(".navbar-tab-highlight");
	const tabs = tabGroup.querySelectorAll<HTMLElement>(".navbar-tab");
	const views = document.querySelector(`#${tabGroup.dataset.targetId}`)!.children as HTMLCollectionOf<HTMLElement>;
	if (!tabHighlight) {
		console.error("Tab highlight element not found. Please check the HTML structure.");
		throw new Error("Tab highlight element is not properly initialized.");
	}
	//tab setup
	if (tabs.length === 0) {
		console.error("No tabs found in the tab view. Please check the HTML structure.");
		throw new Error("Tab view is not properly initialized.");
	}
	if (views.length === 0) {
		console.error("No views found in the tab view. Please check the HTML structure.");
		throw new Error("Tab view is not properly initialized.");
	}
	if (tabs.length !== views.length) {
		console.error("Number of tabs and views do not match. Please check the HTML structure.");
		throw new Error("Tab view is not properly initialized.");
	}
	if (!tabHighlight) {
		console.error("Tab highlight element not found. Please check the HTML structure.");
		throw new Error("Tab highlight element is not properly initialized.");
	}
	const highlightInset = "0.1875rem";
	const availableWidth = `calc(100% - (${highlightInset} * 2))`;
	tabHighlight!.style.width = `calc(${availableWidth} / ${tabs.length})`;
	tabHighlight!.style.left = highlightInset;
	//set the first tab as active
	tabs[0].classList.add("navbar-tab-active");
	tabGroup.setAttribute("role", "tablist");
	tabs.forEach((tab, index) => {
		tab.setAttribute("role", "tab");
		tab.setAttribute("aria-selected", String(index === 0));
		tab.tabIndex = index === 0 ? 0 : -1;
	});

	const t: TabView = {
		setActiveTab: (targetIndex: number) => {
			if (targetIndex === t.activeTabIndex) {
				return;
			}
			const currentTab = t.tabs[t.activeTabIndex];
			const currentView = t.views[t.activeTabIndex];
			currentTab.classList.remove("navbar-tab-active");
			currentTab.setAttribute("aria-selected", "false");
			currentTab.tabIndex = -1;
			const targetView = t.views[targetIndex];
			const targetTab = t.tabs[targetIndex];
			targetTab.classList.add("navbar-tab-active");
			targetTab.setAttribute("aria-selected", "true");
			targetTab.tabIndex = 0;
			tabHighlight!.style.left = `calc(${highlightInset} + ((${availableWidth} / ${tabs.length}) * ${targetIndex}))`;
			helpers.hideElement(currentView);
			t.activeTabIndex = targetIndex;
			helpers.showElement(targetView, true);
		},
		activeTabIndex: 0,
		tabs: tabs,
		tabHighlight: tabHighlight,
		views: views
	};

	for (const tab of tabs) {
		tab.addEventListener("click", () => {
			const targetTabIndex = Array.from(tabs).indexOf(tab);
			t.setActiveTab(targetTabIndex);
		});
	}

	t.setActiveTab(0);
}

// Keyboard support for every tab strip, including the manually driven ones, which switch on click.
document.addEventListener("keydown", (event) => {
	const tab = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('.navbar [role="tab"]') : null;
	if (!tab) return;
	const tabs = Array.from(tab.parentElement!.querySelectorAll<HTMLElement>(':scope > [role="tab"]'));
	const index = tabs.indexOf(tab);
	let next: HTMLElement | undefined;
	if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
	else if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
	else if (event.key === "Home") next = tabs[0];
	else if (event.key === "End") next = tabs.at(-1);
	else if (event.key === "Enter" || event.key === " ") next = tab;
	if (!next) return;
	event.preventDefault();
	next.click();
	next.focus();
});
