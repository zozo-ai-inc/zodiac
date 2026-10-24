import type { Page, Route } from "@playwright/test";

declare global {
	interface Window {
		importModule<T = unknown>(path: string): Promise<T>;
	}
}

type MockOpenRouterResponse = {
	text: string;
};

function buildOpenRouterPayload(response: MockOpenRouterResponse): string {
	return JSON.stringify({
		choices: [
			{
				finish_reason: "stop",
				message: {
					content: response.text
				}
			}
		]
	});
}

async function fulfillStaticExternal(route: Route): Promise<void> {
	const resourceType = route.request().resourceType();

	if (resourceType === "stylesheet") {
		await route.fulfill({
			status: 200,
			contentType: "text/css",
			body: ""
		});
		return;
	}

	if (resourceType === "script") {
		await route.fulfill({
			status: 200,
			contentType: "application/javascript",
			body: ""
		});
		return;
	}

	await route.fulfill({
		status: 204,
		body: ""
	});
}

export async function stubExternalTraffic(page: Page, openRouterResponses: MockOpenRouterResponse[]): Promise<void> {
	await page.route("https://**/*", async (route) => {
		const url = new URL(route.request().url());

		if (url.hostname === "openrouter.ai" && url.pathname === "/api/v1/chat/completions") {
			const nextResponse = openRouterResponses.shift();
			if (!nextResponse) {
				throw new Error(`Unexpected OpenRouter request: ${route.request().method()} ${url.pathname}`);
			}

			await route.fulfill({
				status: 200,
				contentType: "application/json",
				headers: {
					"access-control-allow-origin": "*"
				},
				body: buildOpenRouterPayload(nextResponse)
			});
			return;
		}

		if (["www.googletagmanager.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"].includes(url.hostname)) {
			await fulfillStaticExternal(route);
			return;
		}

		await route.continue();
	});
}

export async function seedLocalSettings(page: Page): Promise<void> {
	await installBrowserImport(page);
	await page.addInitScript(() => {
		localStorage.setItem("onboardingCompleted", "true");
		localStorage.setItem("OPENROUTER_API_KEY", "test-openrouter-key");
		localStorage.setItem("model", "openai/gpt-5.4");
		localStorage.setItem("maxTokens", "256");
		localStorage.setItem("TEMPERATURE", "50");
		localStorage.setItem("streamResponses", "false");
		localStorage.setItem("enableThinking", "false");
		localStorage.setItem("autoscroll", "true");
	});
}

// Lets page.evaluate callbacks load the app's own modules, which only exist in the browser.
export async function installBrowserImport(page: Page): Promise<void> {
	await page.addInitScript(() => {
		window.importModule = (path) => import(path);
	});
}
