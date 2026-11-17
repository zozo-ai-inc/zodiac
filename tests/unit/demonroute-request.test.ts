import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/utils/helpers", () => ({
	fileToBase64: vi.fn()
}));

import { buildOpenRouterRequest } from "../../src/services/OpenRouter.service";
import { validateDemonRouteApiKey } from "../../src/services/ApiKeyValidation.service";
import {
	DEMONROUTE_CHAT_MODELS,
	getAccessibleChatModels,
	isDemonRouteModel,
	type ChatModelAccess
} from "../../src/types/Models";

const demonRouteOnlyAccess: ChatModelAccess = {
	hasGeminiAccess: false,
	hasOpenRouterAccess: false,
	hasDemonRouteAccess: true
};

const noDemonRouteAccess: ChatModelAccess = {
	hasGeminiAccess: true,
	hasOpenRouterAccess: true,
	hasDemonRouteAccess: false
};

describe("Demon Route chat models", () => {
	it("recognizes Demon Route model ids and no others", () => {
		for (const model of DEMONROUTE_CHAT_MODELS) {
			expect(isDemonRouteModel(model.id)).toBe(true);
		}
		expect(isDemonRouteModel("z-ai/glm-5")).toBe(false);
		expect(isDemonRouteModel("gemini-3-flash-preview")).toBe(false);
		expect(isDemonRouteModel(null)).toBe(false);
	});

	it("offers Demon Route models only when the user has a Demon Route key", () => {
		const accessibleIds = getAccessibleChatModels(demonRouteOnlyAccess).map((model) => model.id);
		expect(accessibleIds).toEqual(DEMONROUTE_CHAT_MODELS.map((model) => model.id));

		const withoutKeyIds = getAccessibleChatModels(noDemonRouteAccess).map((model) => model.id);
		for (const model of DEMONROUTE_CHAT_MODELS) {
			expect(withoutKeyIds).not.toContain(model.id);
		}
	});

	it("never offers Demon Route models through the premium endpoint, which cannot serve them", () => {
		const premiumAccess: ChatModelAccess = { ...demonRouteOnlyAccess, isPremiumEndpointPreferred: true };
		expect(getAccessibleChatModels(premiumAccess)).toEqual([]);
	});
});

describe("Demon Route request building", () => {
	it("drops the OpenRouter-only body fields for a Demon Route model", () => {
		const request = buildOpenRouterRequest({
			model: "zerofata/G4-LuneLight-31B",
			messages: [{ role: "user", content: "Hello" }],
			stream: false,
			maxTokens: 1024,
			temperature: 0.8,
			enableThinking: true,
			reasoningEffort: "high",
			isInternetSearchEnabled: true
		});

		expect(request.model).toBe("zerofata/G4-LuneLight-31B");
		expect(request.max_tokens).toBe(1024);
		expect(request.temperature).toBe(0.8);
		expect(request.reasoning).toBeUndefined();
		expect(request.plugins).toBeUndefined();
		expect(request.provider).toBeUndefined();
		expect(request.modalities).toBeUndefined();
	});

	it("keeps the OpenRouter-only body fields for an OpenRouter model", () => {
		const request = buildOpenRouterRequest({
			model: "openai/gpt-4o",
			messages: [{ role: "user", content: "Hello" }],
			stream: false,
			maxTokens: 1024,
			temperature: 0.8,
			enableThinking: false,
			reasoningEffort: "high",
			isInternetSearchEnabled: true
		});

		expect(request.plugins).toEqual([{ id: "web" }]);
		expect(request.provider).toEqual({ require_parameters: false });
	});
});

describe("Demon Route API key validation", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("accepts a key the models endpoint answers with success, sending only the Authorization header", async () => {
		const fetchMock = vi.fn(async () => ({ ok: true }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(validateDemonRouteApiKey("test-key")).resolves.toBe(true);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("https://api.demonroute.com/v1/models");
		expect(init.method).toBe("GET");
		// Demon Route's CORS preflight allows only Authorization and Content-Type, so the
		// OpenRouter attribution headers must not be sent here.
		expect(Object.keys(init.headers as Record<string, string>)).toEqual(["Authorization"]);
		expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
	});

	it("rejects a key the models endpoint refuses", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: false, status: 401 }))
		);

		await expect(validateDemonRouteApiKey("bad-key")).resolves.toBe(false);
	});

	it("rejects an empty key without calling the endpoint", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(validateDemonRouteApiKey("   ")).resolves.toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects the key when the request itself fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("network down");
			})
		);

		await expect(validateDemonRouteApiKey("test-key")).resolves.toBe(false);
	});
});
