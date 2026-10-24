import type { Content, ThinkingConfig as GeminiThinkingConfig } from "@google/genai";
import { type GenerateContentConfig } from "@google/genai";
import type { ReasoningEffort } from "./Models";

export namespace PremiumEndpoint {
	export interface Request {
		message: string;
		settings: RequestSettings;
		history: Content[];
		pinnedHistoryIndices?: number[];
	}

	// reasoningEffort replaces thinkingBudget when present; thinking is still turned on/off with includeThoughts
	export type ThinkingConfig = GeminiThinkingConfig & { reasoningEffort?: ReasoningEffort };

	export interface RequestSettings extends Omit<GenerateContentConfig, "thinkingConfig"> {
		thinkingConfig?: ThinkingConfig;
		model: string;
		streamResponses: boolean;
		generate?: boolean; // whether to generate a new response or just continue the chat
		generatePurpose?: "chat_title" | "roleplay_suggestion";
	}
}
