import { afterEach, describe, expect, it, vi } from "vitest";

import {
	CHAT_MODELS,
	DEFAULT_OPENROUTER_TITLE_MODEL,
	ImageModelId,
	ImageModelProvider,
	ImagePromptType,
	OPENROUTER_CHAT_MODELS,
	formatOriginModelLabel,
	getAccessibleChatModels,
	getAccessibleRoleplaySuggestionModels,
	getChatModelDefinition,
	getValidChatModel,
	getValidRoleplaySuggestionModel,
	modelRequiresThinking,
	type ChatModelAccess
} from "../../src/types/Models";
import { DEFAULT_IMAGE_EDIT_MODEL, DEFAULT_IMAGE_MODEL, IMAGE_MODELS } from "../../src/constants/ImageModels";

// Which chat models are offered depends on the clock once a model has a deprecation date.
const BEFORE_ANY_DEPRECATION = "2026-10-01T00:00:00Z";

function setNow(isoDateTime: string): void {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date(isoDateTime));
}

afterEach(() => {
	vi.useRealTimers();
});

describe("default model roles", () => {
	it("uses GLM 5 for local OpenRouter chat title generation", () => {
		expect(DEFAULT_OPENROUTER_TITLE_MODEL).toBe("z-ai/glm-5");
	});
});

describe("image model definitions", () => {
	it("represents current image generation and editing models once", () => {
		const modelIds = IMAGE_MODELS.map((model) => model.id);

		expect(new Set(modelIds).size).toBe(modelIds.length);
		expect(modelIds.sort()).toEqual(
			[
				ImageModelId.ILLUSTRIOUS,
				ImageModelId.BLXL,
				ImageModelId.QWEN,
				ImageModelId.SEEDREAM,
				ImageModelId.PRUNA,
				ImageModelId.SEEDREAM_5_0_PRO,
				ImageModelId.SEEDREAM_4_5,
				ImageModelId.QWEN_2_0_PRO,
				ImageModelId.QWEN_2_0,
				ImageModelId.GEMINI_2_5_FLASH_IMAGE,
				ImageModelId.GEMINI_3_PRO_IMAGE_PREVIEW,
				ImageModelId.GEMINI_3_1_FLASH_IMAGE_PREVIEW,
				ImageModelId.GROK_IMAGINE_IMAGE_QUALITY
			].sort()
		);
	});

	it("keeps image defaults pointed at valid model capabilities", () => {
		expect(IMAGE_MODELS.find((model) => model.id === DEFAULT_IMAGE_MODEL)?.generation).toBe(true);
		expect(IMAGE_MODELS.find((model) => model.id === DEFAULT_IMAGE_EDIT_MODEL)?.editing).toBe(true);
	});

	it("records provider routes for dedicated image models", () => {
		for (const model of IMAGE_MODELS.filter((candidate) => !candidate.openRouterModelId)) {
			expect(model.providers).toEqual([ImageModelProvider.EDGE]);
		}
		for (const modelId of [
			ImageModelId.GEMINI_2_5_FLASH_IMAGE,
			ImageModelId.GEMINI_3_PRO_IMAGE_PREVIEW,
			ImageModelId.GEMINI_3_1_FLASH_IMAGE_PREVIEW
		]) {
			expect(IMAGE_MODELS.find((model) => model.id === modelId)?.providers).toEqual([
				ImageModelProvider.EDGE,
				ImageModelProvider.OPENROUTER,
				ImageModelProvider.GOOGLE
			]);
		}
		expect(IMAGE_MODELS.find((model) => model.id === ImageModelId.GROK_IMAGINE_IMAGE_QUALITY)?.providers).toEqual([
			ImageModelProvider.EDGE,
			ImageModelProvider.OPENROUTER
		]);
	});

	it("stores prompt type per image model", () => {
		expect(IMAGE_MODELS.find((model) => model.id === ImageModelId.ILLUSTRIOUS)?.promptType).toBe(
			ImagePromptType.TAG
		);
		expect(IMAGE_MODELS.find((model) => model.id === ImageModelId.BLXL)?.promptType).toBe(ImagePromptType.TAG);

		for (const modelId of [
			ImageModelId.QWEN,
			ImageModelId.SEEDREAM,
			ImageModelId.PRUNA,
			ImageModelId.SEEDREAM_5_0_PRO,
			ImageModelId.SEEDREAM_4_5,
			ImageModelId.QWEN_2_0_PRO,
			ImageModelId.QWEN_2_0
		]) {
			expect(IMAGE_MODELS.find((model) => model.id === modelId)?.promptType).toBe(ImagePromptType.SEMANTIC);
		}
	});

	it("declares Runware LoRA support only for open-weight models", () => {
		expect(IMAGE_MODELS.find((model) => model.id === ImageModelId.ILLUSTRIOUS)?.loraArchitecture).toBe(
			"illustrious"
		);
		expect(IMAGE_MODELS.find((model) => model.id === ImageModelId.BLXL)?.loraArchitecture).toBe("sdxl");

		for (const model of IMAGE_MODELS.filter(
			(candidate) => candidate.id !== ImageModelId.ILLUSTRIOUS && candidate.id !== ImageModelId.BLXL
		)) {
			expect(model.loraArchitecture).toBeUndefined();
		}
	});

	it("stores editing input image limits in image model metadata", () => {
		expect(IMAGE_MODELS.find((model) => model.id === ImageModelId.QWEN)?.maxInputImages).toBe(3);
		expect(IMAGE_MODELS.find((model) => model.id === ImageModelId.SEEDREAM)?.maxInputImages).toBe(5);
		expect(IMAGE_MODELS.find((model) => model.id === ImageModelId.PRUNA)?.maxInputImages).toBe(5);
		expect(IMAGE_MODELS.find((model) => model.id === ImageModelId.SEEDREAM_5_0_PRO)?.maxInputImages).toBe(5);
		expect(IMAGE_MODELS.find((model) => model.id === ImageModelId.SEEDREAM_4_5)?.maxInputImages).toBe(5);
		expect(IMAGE_MODELS.find((model) => model.id === ImageModelId.QWEN_2_0_PRO)?.maxInputImages).toBe(3);
		expect(IMAGE_MODELS.find((model) => model.id === ImageModelId.QWEN_2_0)?.maxInputImages).toBe(3);
		expect(IMAGE_MODELS.find((model) => model.id === ImageModelId.GEMINI_2_5_FLASH_IMAGE)?.maxInputImages).toBe(5);
		expect(IMAGE_MODELS.find((model) => model.id === ImageModelId.GEMINI_3_PRO_IMAGE_PREVIEW)?.maxInputImages).toBe(
			5
		);
		expect(
			IMAGE_MODELS.find((model) => model.id === ImageModelId.GEMINI_3_1_FLASH_IMAGE_PREVIEW)?.maxInputImages
		).toBe(5);
		expect(IMAGE_MODELS.find((model) => model.id === ImageModelId.GROK_IMAGINE_IMAGE_QUALITY)?.maxInputImages).toBe(
			3
		);
	});
});

describe("image models are not chat models", () => {
	it("keeps dedicated image model IDs out of the chat catalog", () => {
		for (const model of [
			"gemini-2.5-flash-image",
			"gemini-3-pro-image-preview",
			"gemini-3.1-flash-image-preview",
			"google/gemini-2.5-flash-image",
			"google/gemini-3-pro-image-preview",
			"google/gemini-3.1-flash-image-preview",
			"x-ai/grok-imagine-image-quality"
		]) {
			expect(getChatModelDefinition(model)).toBeUndefined();
		}
	});
});

describe("roleplay suggestion models", () => {
	it("requires thinking for Gemini 3.5 Flash local and OpenRouter variants", () => {
		expect(modelRequiresThinking("gemini-3.5-flash")).toBe(true);
		expect(modelRequiresThinking("google/gemini-3.5-flash")).toBe(true);
	});

	it("includes only models flagged for roleplay suggestions", () => {
		setNow(BEFORE_ANY_DEPRECATION);
		const fullAccess: ChatModelAccess = { hasGeminiAccess: true, hasOpenRouterAccess: true };

		const expectedModels = [
			"Gemini 3.1 Flash Lite",
			"Gemini 3.1 Flash Lite via OpenRouter",
			"Gemini 3 Flash Preview",
			"Gemini 3 Flash Preview via OpenRouter",
			"Gemini 3.5 Flash",
			"Gemini 3.5 Flash via OpenRouter",
			"Gemini 3.1 Pro Preview",
			"Gemini 3.1 Pro Preview via OpenRouter",
			"Gemini 3.5 Flash Lite",
			"Gemini 3.6 Flash",
			"Gemini 3.7 Flash",
			"Gemini 3.8 Flash",
			"GPT-OSS 120B",
			"Claude Sonnet 4.6",
			"Claude Haiku 4.5",
			"Claude Sonnet 5",
			"Claude Sonnet 5.5",
			"Claude Haiku 5.5",
			"DeepSeek V4 Flash",
			"DeepSeek V4.1 Flash",
			"GLM 5",
			"GLM 5.1",
			"GLM 5.2",
			"GLM 5.3",
			"GLM 5.3 Flash",
			"GLM 5.3 FlashX",
			"GLM 5.3 Prime",
			"Gemma 4 31B",
			"Grok 4.3",
			"Grok 4.5",
			"Grok 4.6",
			"Grok 4.7",
			"Kimi K3",
			"Mistral Large 4",
			"Qwen3.5 397B",
			"Qwen3.5 Plus",
			"Qwen3.6 Max Preview",
			"Qwen3.6 Plus",
			"Qwen3.7 Max",
			"Qwen3.7 Plus",
			"Qwen3.7 Flash",
			"Qwen3.8 Flash",
			"Qwen3.8 Max",
			"Qwen3.8 Max Prime"
		];
		const receivedModels = getAccessibleRoleplaySuggestionModels(fullAccess).map((model) => model.label);

		expect(receivedModels.sort()).toEqual(expectedModels.sort());
	});

	it("maps local-only Gemini suggestion models to OpenRouter variants for premium endpoint access", () => {
		const premiumAccess: ChatModelAccess = {
			hasGeminiAccess: true,
			hasOpenRouterAccess: true,
			isPremiumEndpointPreferred: true
		};

		expect(getValidRoleplaySuggestionModel("gemini-3.5-flash", premiumAccess)).toBe("google/gemini-3.5-flash");
	});
});

describe("thinking-required models", () => {
	it("requires thinking for exactly the OpenRouter models whose reasoning is mandatory", () => {
		const expectedModels = [
			"google/gemini-3.5-flash",
			"google/gemini-3.5-flash-lite",
			"google/gemini-3.6-flash",
			"google/gemini-3.7-flash",
			"google/gemini-3.8-flash",
			"google/gemini-3.1-pro-preview",
			"google/gemini-2.5-pro",
			"openai/gpt-5.4-pro",
			"openai/gpt-6-astra",
			"openai/gpt-6.1-sol",
			"openai/gpt-oss-120b",
			"anthropic/claude-fable-5",
			"anthropic/claude-fable-5.1",
			"anthropic/claude-opus-5.5",
			"anthropic/claude-sonnet-5.5",
			"z-ai/glm-5.3",
			"z-ai/glm-5.3-flash",
			"z-ai/glm-5.3-flashx",
			"z-ai/glm-5.3-prime",
			"qwen/qwen3.8-max-0902",
			"qwen/qwen3.8-max-prime",
			"x-ai/grok-4.5",
			"x-ai/grok-4.6",
			"x-ai/grok-4.7"
		];
		const receivedModels = OPENROUTER_CHAT_MODELS.filter((model) => model.requiresThinking).map(
			(model) => model.id
		);

		expect(receivedModels.sort()).toEqual(expectedModels.sort());
	});
});

describe("chat model deprecation", () => {
	const fullAccess: ChatModelAccess = { hasGeminiAccess: true, hasOpenRouterAccess: true };
	const premiumAccess: ChatModelAccess = {
		hasGeminiAccess: true,
		hasOpenRouterAccess: true,
		isPremiumEndpointPreferred: true
	};

	it("stores the backend's deprecation dates, shared by the Gemini-key variants of those models", () => {
		const datedModels = Object.fromEntries(
			CHAT_MODELS.filter((model) => model.deprecationDate).map((model) => [model.id, model.deprecationDate])
		);

		expect(datedModels).toEqual({
			"gemini-2.5-flash": "2026-10-20T00:00:00Z",
			"gemini-2.5-flash-lite": "2026-10-20T00:00:00Z",
			"gemini-2.5-pro": "2026-10-20T00:00:00Z",
			"google/gemini-2.5-flash": "2026-10-20T00:00:00Z",
			"google/gemini-2.5-flash-lite": "2026-10-20T00:00:00Z",
			"google/gemini-2.5-pro": "2026-10-20T00:00:00Z",
			"openai/gpt-5.3-chat": "2026-10-08T00:00:00Z",
			"qwen/qwen3.6-max-preview": "2026-10-09T00:00:00Z"
		});
	});

	it("gives every deprecation date an explicit timezone", () => {
		for (const model of CHAT_MODELS.filter((candidate) => candidate.deprecationDate)) {
			expect(model.deprecationDate, model.id).toMatch(
				/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/
			);
			expect(Number.isFinite(Date.parse(model.deprecationDate!)), model.id).toBe(true);
		}
	});

	it("offers a model and its Gemini-key variant until the deprecation moment and not from then on", () => {
		setNow("2026-10-19T23:59:59.999Z");
		const offeredBefore = getAccessibleChatModels(fullAccess).map((model) => model.id);
		expect(offeredBefore).toContain("google/gemini-2.5-flash");
		expect(offeredBefore).toContain("gemini-2.5-flash");

		setNow("2026-10-20T00:00:00.000Z");
		const offeredFromThenOn = getAccessibleChatModels(fullAccess).map((model) => model.id);
		expect(offeredFromThenOn).not.toContain("google/gemini-2.5-flash");
		expect(offeredFromThenOn).not.toContain("gemini-2.5-flash");
	});

	it("drops a deprecated model from roleplay suggestions", () => {
		setNow("2026-10-08T23:59:59Z");
		expect(getAccessibleRoleplaySuggestionModels(fullAccess).map((model) => model.id)).toContain(
			"qwen/qwen3.6-max-preview"
		);

		setNow("2026-10-09T00:00:00Z");
		expect(getAccessibleRoleplaySuggestionModels(fullAccess).map((model) => model.id)).not.toContain(
			"qwen/qwen3.6-max-preview"
		);
	});

	it("replaces a saved model with the first offered one once it is deprecated", () => {
		setNow("2026-10-08T23:59:59Z");
		expect(getValidChatModel("qwen/qwen3.6-max-preview", premiumAccess)).toBe("qwen/qwen3.6-max-preview");

		setNow("2026-10-09T00:00:00Z");
		const replacement = getValidChatModel("qwen/qwen3.6-max-preview", premiumAccess);

		expect(replacement).not.toBe("qwen/qwen3.6-max-preview");
		expect(replacement).toBe(getAccessibleChatModels(premiumAccess)[0].id);
	});

	it("replaces a saved Gemini 2.5 Pro with Gemini 3 Flash Preview once it is deprecated", () => {
		setNow("2026-10-19T23:59:59Z");
		expect(getValidChatModel("google/gemini-2.5-pro", premiumAccess)).toBe("google/gemini-2.5-pro");

		setNow("2026-10-20T00:00:00Z");
		// Premium endpoint, whether the saved id is the OpenRouter or the Gemini-key one.
		expect(getValidChatModel("google/gemini-2.5-pro", premiumAccess)).toBe("google/gemini-3-flash-preview");
		expect(getValidChatModel("gemini-2.5-pro", premiumAccess)).toBe("google/gemini-3-flash-preview");
		// Own keys: each variant is replaced within its own provider.
		expect(getValidChatModel("google/gemini-2.5-pro", fullAccess)).toBe("google/gemini-3-flash-preview");
		expect(getValidChatModel("gemini-2.5-pro", fullAccess)).toBe("gemini-3-flash-preview");
	});

	it("falls back to the first offered model when the named replacement is not offered either", () => {
		setNow("2026-10-20T00:00:00Z");
		const openRouterOnly: ChatModelAccess = { hasGeminiAccess: false, hasOpenRouterAccess: true };

		expect(getValidChatModel("gemini-2.5-pro", openRouterOnly)).toBe(getAccessibleChatModels(openRouterOnly)[0].id);
	});

	it("names only replacements that exist, share the provider and are not retiring themselves", () => {
		for (const model of CHAT_MODELS.filter((candidate) => candidate.replacementModel)) {
			const replacement = getChatModelDefinition(model.replacementModel);

			expect(replacement, model.id).toBeDefined();
			expect(replacement?.provider, model.id).toBe(model.provider);
			expect(replacement?.deprecationDate, model.id).toBeUndefined();
		}
	});

	it("replaces a saved roleplay suggestion model with an offered one once it is deprecated", () => {
		setNow("2026-10-09T00:00:00Z");
		const replacement = getValidRoleplaySuggestionModel("qwen/qwen3.6-max-preview", premiumAccess);

		expect(replacement).not.toBe("qwen/qwen3.6-max-preview");
		expect(getAccessibleRoleplaySuggestionModels(premiumAccess).map((model) => model.id)).toContain(replacement);
	});

	it("keeps labelling messages written by a deprecated model", () => {
		setNow("2027-01-01T00:00:00Z");

		expect(formatOriginModelLabel("openai/gpt-5.3-chat")).toBe("GPT-5.3 Chat");
	});
});
