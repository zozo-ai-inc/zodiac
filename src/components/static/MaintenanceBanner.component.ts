import { getRemoteKeyValue } from "../../services/Supabase.service";

type MaintenanceBannerStyle = "normal" | "warning";

interface MaintenanceBannerConfig {
	enabled?: boolean;
	message?: string;
	style?: MaintenanceBannerStyle;
	dismissible?: boolean;
}

const DISMISSED_STORAGE_KEY = "maintenance_banner_dismissed";

const maintenanceBannerElement = document.querySelector<HTMLDivElement>("#maintenance-banner");
const maintenanceBannerTextElement = document.querySelector<HTMLSpanElement>("#maintenance-banner-text");
const maintenanceBannerDismissElement = document.querySelector<HTMLButtonElement>("#maintenance-banner-dismiss");

if (!maintenanceBannerElement || !maintenanceBannerTextElement || !maintenanceBannerDismissElement) {
	throw new Error(
		"Missing DOM elements: #maintenance-banner, #maintenance-banner-text or #maintenance-banner-dismiss"
	);
}

const maintenanceBanner = maintenanceBannerElement;
const maintenanceBannerText = maintenanceBannerTextElement;
const maintenanceBannerDismiss = maintenanceBannerDismissElement;

let currentSignature = "";

function getSignature(config: MaintenanceBannerConfig): string {
	return JSON.stringify([config.style ?? "normal", config.message ?? ""]);
}

function isDismissed(signature: string): boolean {
	try {
		return localStorage.getItem(DISMISSED_STORAGE_KEY) === signature;
	} catch {
		return false;
	}
}

function persistDismissal(signature: string): void {
	try {
		localStorage.setItem(DISMISSED_STORAGE_KEY, signature);
	} catch {
		// Storage unavailable; dismissal only lasts for this session.
	}
}

function syncMaintenanceBannerHeight(): void {
	const bannerHeight = `${maintenanceBanner.offsetHeight}px`;
	document.documentElement.style.setProperty("--maintenance-banner-height", bannerHeight);
}

function isMaintenanceBannerStyle(value: unknown): value is MaintenanceBannerStyle {
	return value === "normal" || value === "warning";
}

function normalizeMaintenanceConfig(value: unknown): MaintenanceBannerConfig | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	const raw = value as Record<string, unknown>;
	const normalized: MaintenanceBannerConfig = {};

	if (typeof raw.enabled === "boolean") {
		normalized.enabled = raw.enabled;
	}

	if (typeof raw.message === "string") {
		normalized.message = raw.message.trim();
	}

	if (isMaintenanceBannerStyle(raw.style)) {
		normalized.style = raw.style;
	}

	if (typeof raw.dismissible === "boolean") {
		normalized.dismissible = raw.dismissible;
	}

	return normalized;
}

function hideMaintenanceBanner(): void {
	maintenanceBanner.classList.add("hidden");
	document.body.classList.remove("maintenance-banner-visible");
}

function showMaintenanceBanner(config: MaintenanceBannerConfig): void {
	const style = config.style ?? "normal";
	const text = config.message || "Maintenance is currently in progress.";

	maintenanceBannerText.textContent = text;
	maintenanceBanner.classList.toggle("maintenance-banner--warning", style === "warning");
	maintenanceBanner.classList.toggle("maintenance-banner--normal", style === "normal");
	const dismissible = config.dismissible !== false;
	maintenanceBannerDismiss.classList.toggle("hidden", !dismissible);
	maintenanceBanner.classList.toggle("maintenance-banner--dismissible", dismissible);
	maintenanceBanner.classList.remove("hidden");
	syncMaintenanceBannerHeight();
	document.body.classList.add("maintenance-banner-visible");
}

async function initializeMaintenanceBanner(): Promise<void> {
	const remoteValue = await getRemoteKeyValue<unknown>("maintenance_banner");
	const config = normalizeMaintenanceConfig(remoteValue);

	if (!config?.enabled) {
		hideMaintenanceBanner();
		return;
	}

	currentSignature = getSignature(config);
	if (config.dismissible !== false && isDismissed(currentSignature)) {
		hideMaintenanceBanner();
		return;
	}

	showMaintenanceBanner(config);
}

maintenanceBannerDismiss.addEventListener("click", () => {
	persistDismissal(currentSignature);
	hideMaintenanceBanner();
});

window.addEventListener("resize", () => {
	if (document.body.classList.contains("maintenance-banner-visible")) {
		syncMaintenanceBannerHeight();
	}
});

void initializeMaintenanceBanner();
