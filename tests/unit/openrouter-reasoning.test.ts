import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/utils/helpers", () => ({
	fileToBase64: vi.fn()
}));

import { buildOpenRouterReasoning } from "../../src/services/OpenRouter.service";

describe("OpenRouter reasoning for own-key requests", () => {
	it("sends the chosen effort moved to the model's nearest level", () => {
		expect(
			buildOpenRouterReasoning({ model: "openai/gpt-5.4", enableThinking: true, reasoningEffort: "max" })
		).toEqual({ effort: "xhigh", exclude: false });
	});

	it("turns reasoning off for a model that can turn it off while thinking is off", () => {
		expect(
			buildOpenRouterReasoning({ model: "openai/gpt-5.4", enableThinking: false, reasoningEffort: "max" })
		).toEqual({ effort: "none", exclude: true });
	});

	it("runs a thinking-required model at its lowest level while thinking is off", () => {
		expect(
			buildOpenRouterReasoning({
				model: "anthropic/claude-opus-5.5",
				enableThinking: false,
				reasoningEffort: "max"
			})
		).toEqual({ effort: "low", exclude: false });
	});

	it("turns thinking on without an effort for models that only take on or off", () => {
		expect(
			buildOpenRouterReasoning({ model: "z-ai/glm-5", enableThinking: true, reasoningEffort: "high" })
		).toEqual({ enabled: true, exclude: false });
	});

	it("sends no reasoning settings for models without thinking", () => {
		expect(
			buildOpenRouterReasoning({ model: "openai/gpt-4o", enableThinking: true, reasoningEffort: "high" })
		).toBeUndefined();
	});
});
