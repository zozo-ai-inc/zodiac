import { getChatModelDefinition, REASONING_EFFORT_LABELS, resolveReasoningEffort } from "../../types/Models";
import { getStoredReasoningEffort } from "../../services/Settings.service";
import { onDocumentEvent } from "../../events";
import { modelSelect } from "./ModelSelector.component";
import { createThinkingToggledEvent } from "./ThinkingSelector.component";

const reasoningEffortSetting = document.querySelector<HTMLDivElement>("#reasoning-effort-setting");
const reasoningEffortSelect = document.querySelector<HTMLSelectElement>("#reasoningEffort");

if (!reasoningEffortSetting || !reasoningEffortSelect) {
	console.error("Reasoning effort select component initialization failed");
	throw new Error("Missing DOM element: #reasoning-effort-setting or #reasoningEffort");
}

//offers only the selected model's levels and shows the saved preference moved to the nearest one.
//the preference itself is only rewritten when the user picks a level (see Settings.service)
function renderReasoningEffortOptions(): void {
	const model = modelSelect?.value;
	const efforts = getChatModelDefinition(model)?.reasoningEfforts ?? [];
	reasoningEffortSetting!.style.display = efforts.length > 0 ? "" : "none";
	reasoningEffortSelect!.replaceChildren(
		...efforts.map((effort) => new Option(REASONING_EFFORT_LABELS[effort], effort))
	);
	const selected = resolveReasoningEffort(model, getStoredReasoningEffort());
	if (selected) reasoningEffortSelect!.value = selected;
}

//if thinking is disabled, disable the effort select
document.addEventListener("thinking-toggled", (event: CustomEventInit) => {
	const { enabled } = event.detail;
	reasoningEffortSelect.disabled = !enabled;
});

//also fires after settings are reloaded from storage, e.g. by cloud sync
onDocumentEvent("chat-model-changed", renderReasoningEffortOptions);

renderReasoningEffortOptions();
//initial state, we trigger the event to set the correct state
reasoningEffortSelect.dispatchEvent(createThinkingToggledEvent());
