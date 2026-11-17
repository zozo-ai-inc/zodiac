import { GoogleGenAI } from "@google/genai";

import { ChatModel } from "../types/Models";

const OPENROUTER_CHAT_COMPLETIONS_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_VALIDATION_MODEL = "openrouter/free";
const DEMONROUTE_MODELS_ENDPOINT = "https://api.demonroute.com/v1/models";

export async function validateGeminiApiKey(apiKey: string): Promise<boolean> {
	const trimmed = apiKey.trim();
	if (!trimmed) return false;

	try {
		const ai = new GoogleGenAI({ apiKey: trimmed });
		await ai.models.generateContent({
			model: ChatModel.FLASH_LITE,
			contents: "Say hello."
		});
		return true;
	} catch {
		return false;
	}
}

export async function validateOpenRouterApiKey(apiKey: string): Promise<boolean> {
	const trimmed = apiKey.trim();
	if (!trimmed) return false;

	try {
		const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_ENDPOINT, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${trimmed}`,
				"Content-Type": "application/json",
				"HTTP-Referer": window.location.origin,
				"X-OpenRouter-Title": "Zozo Chat"
			},
			body: JSON.stringify({
				model: OPENROUTER_VALIDATION_MODEL,
				messages: [{ role: "user", content: "hi" }],
				max_tokens: 1
			})
		});

		return response.ok;
	} catch {
		return false;
	}
}

export async function validateDemonRouteApiKey(apiKey: string): Promise<boolean> {
	const trimmed = apiKey.trim();
	if (!trimmed) return false;

	try {
		// The models list rejects an invalid key with a 401, so validation spends no completion.
		// Only the Authorization header is sent: Demon Route's CORS preflight allows just
		// Authorization and Content-Type, so the OpenRouter attribution headers would be blocked.
		const response = await fetch(DEMONROUTE_MODELS_ENDPOINT, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${trimmed}`
			}
		});

		return response.ok;
	} catch {
		return false;
	}
}
