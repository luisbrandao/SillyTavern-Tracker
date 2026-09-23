import { saveChatConditional, chat, chat_metadata, setExtensionPrompt, extension_prompt_roles, deactivateSendButtons, activateSendButtons, getBiasStrings, system_message_types, sendSystemMessage, sendMessageAsUser, removeMacros, extractMessageBias, messageFormatting } from "../../../../../script.js";

import { hasPendingFileAttachment } from "../../../../../scripts/chats.js";
import { getMessageTimeStamp } from "../../../../../scripts/RossAscends-mods.js";
import { debug, error, log, getLastMessageWithTracker, getLastNonSystemMessageIndex, getNextNonSystemMessageIndex, getPreviousNonSystemMessageIndex, isSystemMessage, shouldGenerateTracker, shouldShowPopup, warn } from "../lib/utils.js";
import { extensionSettings } from "../index.js";
import { generateTracker, getRequestPrompt } from "./generation.js";
import { generationModes, generationTargets, trackerFormat, trackerInjectionRoles } from "./settings/settings.js";
import { jsonToYAML } from "../lib/ymlParser.js";
import { FIELD_INCLUDE_OPTIONS, getDefaultTracker, OUTPUT_FORMATS, getTracker as getCleanTracker, trackerExists, cleanTracker } from "./trackerDataHandler.js";
import { TrackerEditorModal } from "./ui/trackerEditorModal.js";
import { TrackerPreviewManager } from "./ui/trackerPreviewManager.js";
import { isToolInjectionActive, setToolInjectionPayload } from "./toolInjection.js";

// Constants
const ACTION_TYPES = {
	CONTINUE: "continue",
	SWIPE: "swipe",
	REGENERATE: "regenerate",
	QUIET: "quiet",
	IMPERSONATE: "impersonate",
	ASK_COMMAND: "ask_command",
};

const EXTENSION_PROMPT_ROLES = {
	SYSTEM: extension_prompt_roles.SYSTEM,
	USER: extension_prompt_roles.USER,
	ASSISTANT: extension_prompt_roles.ASSISTANT,
};

/**
 * Restores the send/swipe buttons after the tracker's transient "busy" state WITHOUT emitting
 * GENERATION_ENDED.
 *
 * Core's activateSendButtons() calls hideStopButton(), which emits GENERATION_ENDED whenever it
 * hides a *visible* stop button. The tracker shows/hides the stop button at GENERATION_AFTER_COMMANDS
 * — while a host generation (e.g. a Guided Generations swipe/response) is still in flight and before
 * core has shown its own stop button — so that spurious GENERATION_ENDED would fire mid-generation and
 * flush other extensions' ephemeral injects (e.g. Guided's `/inject ... ephemeral=true`), wiping their
 * instructions out of the prompt. Pre-hiding the stop button makes hideStopButton()'s visibility guard
 * a no-op, so activateSendButtons() still runs its remaining UI cleanup but emits no event.
 */
function restoreSendButtons() {
	$("#mes_stop").css("display", "none");
	activateSendButtons();
}

/**
 * Serializes a tracker object into the string form configured by the "Tracker Format" setting
 * (JSON or YAML). Injection paths previously hardcoded YAML, so the injected/inline tracker block
 * ignored the setting; this keeps the injected block in the chosen format.
 * @param {object} trackerObject - The tracker as a plain JS object.
 * @returns {string} The serialized tracker.
 */
function serializeTracker(trackerObject) {
	if (extensionSettings.trackerFormat === trackerFormat.JSON) {
		return JSON.stringify(trackerObject, null, 2);
	}
	return jsonToYAML(trackerObject);
}

//#region Tracker Functions

/**
 * Stores a tracker on a message, saves the chat and refreshes that message's preview.
 * Post-state semantics: the tracker on message N describes the world AFTER message N.
 * @param {number} mesId - The message index.
 * @param {object} tracker - The tracker object.
 */
async function saveTrackerOnMessage(mesId, tracker) {
	debug("Saving tracker on message:", { mesId, tracker });
	chat[mesId].tracker = tracker;
	// Remember which swipe this tracker describes; isTrackerStale() compares it with the swipe shown.
	chat[mesId].trackerSwipeId = chat[mesId].swipe_id ?? 0;
	delete chat[mesId].trackerDirty;
	await saveChatConditional();
	TrackerPreviewManager.updatePreview(mesId);
}

/**
 * Whether the tracker on a message no longer matches its text: the user navigated to a different
 * swipe than the one it was generated for, or edited the message since. Trackers saved before the
 * swipe marker existed count as clean.
 * @param {number} mesId - The message index.
 * @returns {boolean}
 */
function isTrackerStale(mesId) {
	const mes = chat[mesId];
	if (!mes || !trackerExists(mes.tracker, extensionSettings.trackerDef)) return false;
	if (mes.trackerDirty) return true;
	if (mes.trackerSwipeId === undefined) return false;
	return (mes.swipe_id ?? 0) !== mes.trackerSwipeId;
}

/**
 * Flags a message's tracker as stale (called on MESSAGE_EDITED). Lazy: nothing is regenerated until
 * the tracker is actually needed, in ensureFreshTracker().
 * @param {number} mesId - The message index.
 */
export async function markTrackerDirty(mesId) {
	const mes = chat[mesId];
	if (!mes || !trackerExists(mes.tracker, extensionSettings.trackerDef) || mes.trackerDirty) return;
	mes.trackerDirty = true;
	log("Tracker marked stale after message edit", { mesId });
	await saveChatConditional();
}

/**
 * Regenerates the tracker on `mesId` if it is stale, right before it is used as the injected state or
 * as the base for the next tracker. Swipe navigation and edits therefore cost nothing by themselves;
 * one regeneration happens on the next send that depends on that message, for the swipe then shown.
 * @param {number|null} mesId - The message index, or null/-1 for "nothing to check".
 */
async function ensureFreshTracker(mesId) {
	if (mesId === null || mesId === undefined || mesId === -1) return;
	if (extensionSettings.generationTarget === generationTargets.NONE) return;
	if (!isTrackerStale(mesId)) return;
	const mes = chat[mesId];
	log("Tracker is stale for the displayed swipe or edited text; regenerating before use", { mesId, swipeId: mes.swipe_id ?? 0, trackerSwipeId: mes.trackerSwipeId, edited: !!mes.trackerDirty });
	const tracker = await generateTracker(mesId);
	if (tracker) await saveTrackerOnMessage(mesId, tracker);
	else warn("Stale tracker regeneration returned nothing; keeping the old one", { mesId });
}

/**
 * Injects the inline prompt into the extension prompt system.
 * @param {boolean} clearTracker - If true, clears the inline prompt.
 */
async function injectInlinePrompt(clearTracker = false) {
	// FIELD_INCLUDE_OPTIONS.DYNAMIC matches the field set used by staged generation; the old `false`
	// argument matched no include option, so {{trackerFieldPrompt}} always expanded to an empty string.
	const inlinePrompt = clearTracker ? "" : getRequestPrompt(extensionSettings.inlineRequestPrompt, null, FIELD_INCLUDE_OPTIONS.DYNAMIC);
	if(!clearTracker) debug("Injecting inline prompt:", inlinePrompt);
	await setExtensionPrompt("inlineTrackerEnhancedPrompt", inlinePrompt, 1, 0, true, EXTENSION_PROMPT_ROLES.SYSTEM);
}

/**
 * Resolves the configured "Tracker Injection Role" setting to a core extension prompt role.
 * System injects a nameless narrator block that some backends/instruct formats merge into the
 * adjacent turn; User/Assistant make the tracker its own named message in the chat history.
 * @returns {number} The extension prompt role.
 */
function getTrackerInjectionRole() {
	switch (extensionSettings.trackerInjectionRole) {
		case trackerInjectionRoles.USER:
			return EXTENSION_PROMPT_ROLES.USER;
		case trackerInjectionRoles.ASSISTANT:
			return EXTENSION_PROMPT_ROLES.ASSISTANT;
		default:
			return EXTENSION_PROMPT_ROLES.SYSTEM;
	}
}

/**
 * Injects the tracker into the extension prompt system.
 * @param {object} tracker - The tracker object.
 * @param {number} position - The position to inject the tracker.
 */
async function injectTracker(tracker = "", position = 0) {
	let trackerBlock = "";
	let trackerText = "";
	const role = getTrackerInjectionRole();
	if(trackerExists(tracker, extensionSettings.trackerDef) && tracker != "") {
		// Clean to a JSON object (strips defaults), then serialize in the user's configured format.
		const cleaned = cleanTracker(tracker, extensionSettings.trackerDef, OUTPUT_FORMATS.JSON);
		if(cleaned && Object.keys(cleaned).length) {
			trackerText = serializeTracker(cleaned);
			debug("Injecting tracker:", { tracker: trackerText, position, format: extensionSettings.trackerFormat, role: extensionSettings.trackerInjectionRole, toolMode: isToolInjectionActive() });
			trackerBlock = `<tracker>\n${trackerText}\n</tracker>`;
		}
	}
	// Experimental tool mode (chat completion only): the tracker travels as a tool-call result appended
	// in onChatCompletionPromptReady() (src/toolInjection.js). Keep the text injection empty so it
	// doesn't double up, and so a stale text block is cleared when the mode is switched mid-session.
	log("Injecting tracker", { mode: isToolInjectionActive() ? "tool" : "text", role: extensionSettings.trackerInjectionRole, position, empty: trackerText === "" });
	if (isToolInjectionActive()) {
		setToolInjectionPayload(trackerText);
		await setExtensionPrompt("trackerEnhanced", "", 1, position, true, role);
		return;
	}
	setToolInjectionPayload(null);
	position = Math.max(extensionSettings.minimumDepth, position);
	// An assistant-role injection at depth 0 would be the final message in the prompt: Claude-style
	// backends treat a trailing assistant message as a prefill and continue writing from the tracker
	// instead of answering the player. Keep it at least one message up.
	if (role === EXTENSION_PROMPT_ROLES.ASSISTANT) {
		position = Math.max(1, position);
	}
	await setExtensionPrompt("trackerEnhanced", trackerBlock, 1, position, true, role);
}

/**
 * Clears all injected prompts.
 */
export async function clearInjects() {
	debug("Clearing injects");
	await injectInlinePrompt(true);
	await injectTracker("", 0);
}

/**
 * Adds inline trackers to the specified messages.
 * @param {number} lastMesId - The last message ID to consider.
 * @param {boolean} noSave - If true, skips saving the chat.
 */
async function addInlineTrackers(lastMesId, noSave = false) {
	const numberOfMessages = extensionSettings.numberOfMessages === 0 ? chat.length : extensionSettings.numberOfMessages;
	const messages = chat
		.slice(0, lastMesId + 1)
		.map((mes, index) => ({ index, mes }))
		.filter(({ index, mes }) => !isSystemMessage(index) && mes.tracker)
		.slice(-numberOfMessages)
		.map(({ index }) => index);

	for (const mesId of messages) {
		const mes = chat[mesId];
		const trackerText = serializeTracker(mes.tracker);
		mes.mes = `<tracker>${trackerText}</tracker>\n\n${mes.mes.trim()}`;
		mes.has_inline_tracker = true;
	}

	if (!noSave) await saveChatConditional();
}

/**
 * Removes inline trackers from messages.
 * @param {boolean} noSave - If true, skips saving the chat.
 */
async function removeInlineTrackers(noSave = false) {
	const messages = chat
		.slice()
		.map((mes, index) => ({ index, mes }))
		.filter(({ mes }) => mes.has_inline_tracker)
		.map(({ index }) => index);

	for (const mesId of messages) {
		await extractAndSaveInlineTracker(mesId, true);
		delete chat[mesId].has_inline_tracker;
	}

	if (!noSave) await saveChatConditional();
}

/**
 * Extracts the inline tracker from a message and saves it.
 * @param {number} mesId - The message ID.
 * @param {boolean} noSave - If true, skips saving the chat.
 */
async function extractAndSaveInlineTracker(mesId, noSave = false) {
	const mes = chat[mesId];

	// Regex to extract the tracker content
	const trackerRegex = /<tracker>([\s\S]*?)<\/tracker>/;
	const trackerMatch = mes.mes.match(trackerRegex);

	if (trackerMatch && !mes.tracker) {
		const trackerYAML = trackerMatch[1];
		const tracker = getCleanTracker(trackerYAML, extensionSettings.trackerDef, FIELD_INCLUDE_OPTIONS.ALL, true, OUTPUT_FORMATS.JSON);

		// Save the tracker JSON back to the message object
		if (tracker) {
			mes.tracker = tracker;
			mes.mes = mes.mes.replace(trackerRegex, "").trim();
		} else {
			warn(`Failed to parse tracker YAML for message ID ${mesId}`);
			noSave = true;
		}
	}

	if (!noSave) await saveChatConditional();

	TrackerPreviewManager.updatePreview(mesId);
}

/**
 * Refreshes inline trackers.
 * @param {number} lastMesId - The last message ID to consider.
 * @param {boolean} noSave - If true, skips saving the chat.
 */
async function refreshInlineTrackers(lastMesId, noSave = false) {
	await removeInlineTrackers(true);
	await addInlineTrackers(lastMesId, true);
	if (!noSave) await saveChatConditional();
}

//#endregion

//#region Message Generation Functions

/**
 * Prepares the message generation process based on the generation mode.
 * @param {string} type - The type of message generation (e.g., 'continue', 'swipe', 'regenerate').
 * @param {object} options - Additional options for message generation.
 * @param {boolean} dryRun - If true, the function will simulate the operation without side effects.
 */
export async function prepareMessageGeneration(type, options, dryRun) {
	if (!chat_metadata.tracker) chat_metadata.tracker = {};

	if (extensionSettings.generationMode === generationModes.INLINE) {
		await handleInlineGeneration(type);
	} else {
		await handleStagedGeneration(type, options, dryRun);
	}
}

/**
 * Handles inline message generation.
 * @param {string} type - The type of message generation.
 */
async function handleInlineGeneration(type) {
	const mesId = getLastNonSystemMessageIndex();
	// Note: CONTINUE deliberately falls through to the trailing else (refresh up to mesId + inline
	// prompt). An older version also refreshed up to mesId-1 first, which the else immediately superseded.
	if ([ACTION_TYPES.SWIPE, ACTION_TYPES.REGENERATE].includes(type)) {
		await refreshInlineTrackers(mesId - 1, true);
		const mes = chat[mesId];
		if (type === ACTION_TYPES.REGENERATE && mes.tracker && Object.keys(mes.tracker).length !== 0) {
			const tracker = serializeTracker(mes.tracker);
			mes.mes = `<tracker>${tracker}</tracker>\n\n`;
		} else if (type === ACTION_TYPES.SWIPE && mes.tracker && Object.keys(mes.tracker).length !== 0) {
			if (mes.swipe_id == null) {
				mes.swipe_id = 0;
			}
			if (!mes.swipes) {
				mes.swipes = [mes.mes];
			}
			if (!mes.swipe_info) {
				mes.swipe_info = [
					{
						send_date: mes.send_date,
						gen_started: mes.gen_started,
						gen_finished: mes.gen_finished,
						extra: structuredClone(mes.extra),
					},
				];
			}
			const tracker = serializeTracker(mes.tracker);
			const trackerString = `<tracker>${tracker}</tracker>\n\n`;
			mes.swipes.push(trackerString);
			mes.swipe_info.push({
				send_date: getMessageTimeStamp(),
				gen_started: null,
				gen_finished: null,
				extra: {
					bias: extractMessageBias(trackerString),
					gen_id: Date.now(),
					api: "manual",
					model: "slash command",
				},
			});
			mes.swipe_id = mes.swipes.length - 1;
			mes.mes = trackerString;
			const mesDom = document.querySelector(`#chat .mes[mesid="${mesId}"]`);
			mesDom.querySelector(".mes_text").innerHTML = messageFormatting(mes.mes, mes.name, mes.is_system, mes.is_user, Number(mesDom.getAttribute("mesid")));
			[...mesDom.querySelectorAll(".swipes-counter")].forEach((it) => {
				it.textContent = `${mes.swipe_id + 1}/${mes.swipes.length}`;
			});
		}
	} else {
		await refreshInlineTrackers(mesId, true);
		await injectInlinePrompt();
	}
	chat_metadata.tracker.inlineTrackerId = mesId;
	await saveChatConditional();
}

/**
 * Handles staged message generation.
 * @param {string} type - The type of message generation.
 * @param {object} options - Additional options for message generation.
 * @param {boolean} dryRun - If true, the function will simulate the operation without side effects.
 */
async function handleStagedGeneration(type, options, dryRun) {
	const manageStopButton = $("#mes_stop").css("display") === "none";
	if (manageStopButton) deactivateSendButtons();

	await sendUserMessage(type, options, dryRun);

	// Legacy: older versions stashed a "tracker for the upcoming message" here. Post-state semantics
	// store explicit trackers directly on a message instead, so just drop any leftovers.
	delete chat_metadata.tracker.tempTrackerId;
	delete chat_metadata.tracker.tempTracker;

	const mesId = getLastNonSystemMessageIndex();
	if (mesId === -1) {
		if (manageStopButton) restoreSendButtons();
		return;
	}

	const lastMes = chat[mesId];
	const isRedo = [ACTION_TYPES.CONTINUE, ACTION_TYPES.SWIPE, ACTION_TYPES.REGENERATE].includes(type);
	// The slot that holds "the world as it stands right now": the player's message just sent, or,
	// when redoing `mesId`, the message before it.
	const nowSlot = isRedo ? getPreviousNonSystemMessageIndex(mesId) : mesId;

	if (isRedo && lastMes.tracker !== undefined) {
		// The target's own tracker describes the text about to be replaced or extended. Drop it so
		// addTrackerToMessage() regenerates it for the new text once it renders, and so it can never
		// be mistaken for the state to inject (a truthy-but-empty leftover used to skip the fallback).
		delete lastMes.tracker;
		delete lastMes.trackerSwipeId;
		delete lastMes.trackerDirty;
		await saveChatConditional();
		TrackerPreviewManager.updatePreview(mesId);
	}

	// Explicit, user-initiated trackers apply up front and are stored on `nowSlot` so the selection
	// below picks them up. (A command override may already have been applied to the player's message
	// when it rendered; see addTrackerToMessage.)
	if (chat_metadata.tracker.cmdTrackerOverride) {
		if (nowSlot !== -1) await saveTrackerOnMessage(nowSlot, { ...chat_metadata.tracker.cmdTrackerOverride });
		chat_metadata.tracker.cmdTrackerOverride = null;
		await saveChatConditional();
	} else if (shouldShowPopup(mesId, type)) {
		const manualTracker = await showManualTrackerPopup(mesId);
		if (manualTracker && nowSlot !== -1) await saveTrackerOnMessage(nowSlot, manualTracker);
	} else if (!isRedo && shouldShowPopup(mesId + 1, type)) {
		// "Popup for the upcoming character message": the state the reply starts from, i.e. the
		// state after the player's message.
		const manualTracker = await showManualTrackerPopup(mesId + 1);
		if (manualTracker) await saveTrackerOnMessage(mesId, manualTracker);
	}

	// Selection. The model must see the last tracker on or before `nowSlot`. For a fresh reply with
	// generation target User/Both that is the player's message itself (generated when it rendered);
	// with target Character it is the previous reply, so only the player's own text is not folded in.
	const sourceIndex = nowSlot === -1 ? null : getLastMessageWithTracker(nowSlot);
	log("Tracker selection", { type: type ?? "normal", mesId, nowSlot, source: sourceIndex !== null ? `message ${sourceIndex}` : "NONE: no tracker on or before nowSlot" });
	// Lazy per-swipe correctness: if the source was generated for another swipe (or edited since),
	// regenerate it now for the text actually shown, then inject.
	await ensureFreshTracker(sourceIndex);

	const tracker = sourceIndex !== null
		? getCleanTracker(chat[sourceIndex].tracker, extensionSettings.trackerDef, FIELD_INCLUDE_OPTIONS.ALL, true, OUTPUT_FORMATS.JSON)
		: "";

	await injectTracker(tracker, 0);

	if (manageStopButton) restoreSendButtons();
}

async function showManualTrackerPopup(mesId = null) {
	const lastMesWithTrackerIndex = getLastMessageWithTracker(mesId);
	const lastMesWithTracker = chat[lastMesWithTrackerIndex];

	let manualTracker;
	if (lastMesWithTracker) {
		manualTracker = getCleanTracker(lastMesWithTracker.tracker, extensionSettings.trackerDef, FIELD_INCLUDE_OPTIONS.ALL, true, OUTPUT_FORMATS.JSON);
	} else {
		manualTracker = getDefaultTracker(extensionSettings.trackerDef, FIELD_INCLUDE_OPTIONS.ALL, OUTPUT_FORMATS.JSON);
	}

	const trackerEditor = new TrackerEditorModal(mesId);
	const tracker = await trackerEditor.show(manualTracker);

	return tracker;
}

/**
 * Sends a user message based on the type and options provided.
 * @param {string} type - The type of message.
 * @param {object} options - Additional options.
 * @param {boolean} dryRun - If true, simulates the operation without side effects.
 */
async function sendUserMessage(type, options, dryRun) {
	if (![ACTION_TYPES.REGENERATE, ACTION_TYPES.SWIPE, ACTION_TYPES.QUIET, ACTION_TYPES.IMPERSONATE].includes(type) && !dryRun) {
		const textareaText = String($("#send_textarea").val());
		$("#send_textarea").val("").trigger("input");

		const { messageBias } = getBiasStrings(textareaText, type);

		const noAttachTypes = [ACTION_TYPES.REGENERATE, ACTION_TYPES.SWIPE, ACTION_TYPES.IMPERSONATE, ACTION_TYPES.QUIET, ACTION_TYPES.CONTINUE, ACTION_TYPES.ASK_COMMAND];

		if ((textareaText !== "" || (hasPendingFileAttachment() && !noAttachTypes.includes(type))) && !options.automatic_trigger) {
			if (messageBias && !removeMacros(textareaText)) {
				sendSystemMessage(system_message_types.GENERIC, " ", {
					bias: messageBias,
				});
			} else {
				await sendMessageAsUser(textareaText, messageBias);
			}
		}
	}
}

/**
 * Adds a tracker to a message.
 * @param {number} mesId - The message ID.
 */
export async function addTrackerToMessage(mesId) {
	const manageStopButton = $("#mes_stop").css("display") === "none";
	if (manageStopButton) deactivateSendButtons();
	try {
		if (extensionSettings.generationMode === generationModes.INLINE) {
			const tempId = chat_metadata?.tracker?.inlineTrackerId ?? null;
			// tempId null means no inline session is pending; without the guard, null arithmetic in
			// getNextNonSystemMessageIndex (null + 1 === 1) would match message 1 and run a pointless extraction.
			if (tempId != null && getNextNonSystemMessageIndex(tempId) === mesId) {
				await extractAndSaveInlineTracker(mesId, true);
				await removeInlineTrackers(true);
			}
			if(chat_metadata.tracker) chat_metadata.tracker.inlineTrackerId = null;
			await saveChatConditional();
			return;
		}

		if(isSystemMessage(mesId)) return;

		if (chat_metadata?.tracker?.cmdTrackerOverride) {
			// A pending /tracker-enhanced-override is "the state after this message": apply it instead
			// of generating, whatever the generation target.
			await saveTrackerOnMessage(mesId, { ...chat_metadata.tracker.cmdTrackerOverride });
			chat_metadata.tracker.cmdTrackerOverride = null;
			await saveChatConditional();
			return;
		}

		if (shouldGenerateTracker(mesId, undefined)) {
			// Post-state semantics: the tracker for message N is generated from the context up to and
			// including N, so it describes the world after N (see AGENTS.md, "Tracker semantics").
			// The base for this tracker is the last one before it; refresh it first if it is stale.
			await ensureFreshTracker(getLastMessageWithTracker(mesId - 1));
			log("Generating post-state tracker for rendered message", { mesId });
			const tracker = await generateTracker(mesId);
			if (tracker) await saveTrackerOnMessage(mesId, tracker);
			else warn("Tracker generation returned nothing; message left without a tracker", { mesId });
		}
	} catch (e) {
		error("Failed to add tracker to message:", { mesId, e });
	} finally {
		if (manageStopButton) restoreSendButtons();
	}
}

/**
 * Removes the tracker from a message: clears the stored tracker object, strips any inline
 * <tracker> block from the message text (inline mode), removes the preview, and saves the chat.
 * @param {number} mesId - The message index.
 * @returns {Promise<boolean>} true if a tracker was present and removed, false otherwise.
 */
export async function removeTrackerFromMessage(mesId) {
	const mes = chat[mesId];
	if (!mes) return false;

	const hadTracker = !!(mes.tracker && Object.keys(mes.tracker).length > 0);

	// Clear the canonical tracker store and any inline-tracker marker.
	delete mes.tracker;
	delete mes.has_inline_tracker;

	// Strip an inline <tracker> block from the message text (inline mode) and re-render its DOM.
	let inlineStripped = false;
	if (typeof mes.mes === "string" && /<tracker>[\s\S]*?<\/tracker>/i.test(mes.mes)) {
		mes.mes = mes.mes.replace(/<tracker>[\s\S]*?<\/tracker>/gi, "").trim();
		inlineStripped = true;
	}

	await saveChatConditional();

	// Re-render the preview (empty tracker => the preview block is removed).
	TrackerPreviewManager.updatePreview(mesId);

	if (inlineStripped) {
		const mesDom = document.querySelector(`#chat .mes[mesid="${mesId}"]`);
		const mesText = mesDom?.querySelector(".mes_text");
		if (mesText) mesText.innerHTML = messageFormatting(mes.mes, mes.name, mes.is_system, mes.is_user, Number(mesId));
	}

	return hadTracker;
}

//#endregion
