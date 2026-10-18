import { themeService } from "./services/Theme.service";
import * as personalityService from "./services/Personality.service";
import * as settingsService from "./services/Settings.service";
import * as overlayService from "./services/Overlay.service";
import * as chatsService from "./services/Chats.service";
import * as onboardingService from "./services/Onboarding.service";
import * as syncService from "./services/Sync.service";
import * as toastService from "./services/Toast.service";

//load all component code
//eager ensures the modules execute at startup (no async race / ordering surprises)
const components = import.meta.glob("./components/static/*.ts", { eager: true });
void components;

export async function initializeApp(options: { deferOnboarding?: boolean } = {}): Promise<void> {
	try {
		// Initialize theme service first (before DOM is fully rendered)
		themeService.initialize();

		// Initialize in the correct order
		settingsService.initialize();

		// Initialize database
		await chatsService.initialize();
		await personalityService.initialize();
		personalityService.initSyncModalHandlers();
		personalityService.initAddPersonaModalHandlers();

		// Initialize cloud sync (attaches Dexie hooks + online/offline listeners)
		syncService.initialize();

		//event listeners
		const hideOverlayButton = document.querySelector("#btn-hide-overlay");
		hideOverlayButton?.addEventListener("click", () => overlayService.closeOverlay());

		// Check if onboarding should show on first run
		if (!options.deferOnboarding && (await onboardingService.shouldShowOnboarding())) {
			onboardingService.show();
		}
	} catch (error) {
		console.error("App initialization failed", error);
		toastService.danger({
			title: "Zozo Chat couldn't load your data",
			text: "Your chats and personas may be missing until you reload. If this keeps happening, check that this browser allows site storage."
		});
		throw error;
	} finally {
		// The app shell blocks pointer input while busy; never leave it blocked after a failed start.
		document.querySelector("#main-container")?.setAttribute("aria-busy", "false");
	}
}
