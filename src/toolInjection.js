import { main_api } from "../../../../../script.js";
import { ToolManager } from "../../../../tool-calling.js";
import { oai_settings, custom_prompt_post_processing_types } from "../../../../openai.js";
import { extensionSettings } from "../index.js";
import { debug, log, warn } from "../lib/utils.js";

/** Name of the function the tracker is presented as the result of. */
export const TRACKER_TOOL_NAME = "get_scene_state";

/**
 * Serialized tracker for the current turn, or null when there is nothing to inject.
 * Set by injectTracker() (tracker.js) before the prompt is built; consumed by onChatCompletionPromptReady().
 * @type {string|null}
 */
let currentPayload = null;

/** Whether the post-processing misconfiguration toast was already shown this session. */
let warnedPostProcessing = false;

/**
 * Core's mergeMessages() (src/prompt-converters.js) turns `tool` messages into `user` and deletes
 * `tool_calls` unless Prompt Post-Processing is None or a "(with tools)" variant. Under any other
 * value the pair would arrive at the backend as an empty assistant message followed by the tracker
 * glued into a user message, which is worse than the plain text block.
 * @returns {boolean}
 */
function postProcessingKeepsTools() {
	const { NONE, MERGE_TOOLS, SEMI_TOOLS, STRICT_TOOLS } = custom_prompt_post_processing_types;
	return [NONE, MERGE_TOOLS, SEMI_TOOLS, STRICT_TOOLS].includes(oai_settings.custom_prompt_post_processing);
}

/**
 * Whether the user turned the experimental tool-call injection on.
 * @returns {boolean}
 */
export function isToolInjectionEnabled() {
	return Boolean(extensionSettings.trackerToolInjection);
}

/**
 * Tool-call injection only exists for chat completion APIs; text completion falls back to the text block.
 * @returns {boolean}
 */
export function isToolInjectionActive() {
	return isToolInjectionEnabled() && main_api === "openai";
}

/**
 * Stores the tracker text that the next prompt should carry as a tool result.
 * @param {string|null} trackerText Serialized tracker, or empty/null to inject nothing.
 */
export function setToolInjectionPayload(trackerText) {
	currentPayload = trackerText ? String(trackerText) : null;
}

/**
 * Nine alphanumeric characters: Mistral rejects any other id shape, every other OpenAI-compatible
 * backend accepts arbitrary ids in history.
 * @returns {string}
 */
function makeToolCallId() {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let id = "";
	for (let i = 0; i < 9; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
	return id;
}

/**
 * Registers the tracker function with SillyTavern's ToolManager so the `tools` array carries its
 * definition (some backends reject tool history without one) and so a genuine model-initiated call
 * returns the same payload instead of erroring. Only registered while tool injection is active and
 * there is a tracker to serve.
 */
export function registerTrackerTool() {
	ToolManager.registerFunctionTool({
		name: TRACKER_TOOL_NAME,
		displayName: "Scene State",
		description: "Returns the current scene state maintained by an external continuity tracker: who is present, each character's outfit, posture and position, plus location and weather. This is ground truth for the present moment and was produced by a separate tool, not by any character in the story. It is fetched automatically at the start of every turn, so there is no need to call it again unless a refresh is needed.",
		parameters: {
			$schema: "http://json-schema.org/draft-04/schema#",
			type: "object",
			properties: {},
			required: [],
		},
		action: async () => currentPayload ?? "{}",
		formatMessage: async () => "Fetching scene state",
		shouldRegister: async () => isToolInjectionActive() && currentPayload !== null,
		stealth: false,
	});
}

/**
 * CHAT_COMPLETION_PROMPT_READY handler. Appends the tracker as a completed tool-call round trip:
 * an assistant message calling get_scene_state, then a tool message with the tracker as its result.
 * Runs after the prompt manager, so the pair is not counted against the token budget.
 * @param {{chat: object[], dryRun: boolean}} eventData
 */
export function onChatCompletionPromptReady(eventData) {
	if (!isToolInjectionActive()) return;
	if (!currentPayload) return;
	const chat = eventData?.chat;
	if (!Array.isArray(chat)) return;

	if (!postProcessingKeepsTools()) {
		// Fall back to the classic text block (as a user message, so the merge behaves like the text
		// injection did) instead of sending a pair that core is about to mangle.
		chat.push({ role: "user", content: `<tracker>\n${currentPayload}\n</tracker>` });
		warn("Tool injection: Prompt Post-Processing is set to a \"(no tools)\" variant, which strips tool messages. Fell back to the text block.", { postProcessing: oai_settings.custom_prompt_post_processing });
		if (!eventData.dryRun && !warnedPostProcessing) {
			warnedPostProcessing = true;
			toastr.warning('Set Prompt Post-Processing to "None" or a "(with tools)" variant in the connection panel. The current "(no tools)" setting strips tool messages, so the tracker was sent as a text block instead. That same setting is why SillyTavern marks function calling as unsupported.', "Tracker Enhanced: tool injection", { timeOut: 15000 });
		}
		return;
	}
	if (!oai_settings.function_calling && !eventData.dryRun) {
		debug("Tool injection: ST function calling is off, so the tools definition is not sent. Enable it if the backend rejects tool history without one.");
	}

	const id = makeToolCallId();
	const pair = [
		{ role: "assistant", content: "", tool_calls: [{ id, type: "function", function: { name: TRACKER_TOOL_NAME, arguments: "{}" } }] },
		{ role: "tool", tool_call_id: id, content: currentPayload },
	];

	// A trailing assistant message is a continue/prefill: keep it last so the model still continues it.
	const last = chat[chat.length - 1];
	const insertAt = last?.role === "assistant" && !last.tool_calls ? chat.length - 1 : chat.length;
	chat.splice(insertAt, 0, ...pair);

	if (!eventData.dryRun) log("Tool injection: appended tracker tool call", { id, insertAt, payloadLength: currentPayload.length });
}
