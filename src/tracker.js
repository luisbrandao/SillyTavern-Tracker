import { saveChatConditional, chat, chat_metadata, setExtensionPrompt, extension_prompt_roles, deactivateSendButtons, activateSendButtons, getBiasStrings, system_message_types, sendSystemMessage, sendMessageAsUser, removeMacros, extractMessageBias, messageFormatting } from "../../../../../script.js";

import { hasPendingFileAttachment } from "../../../../../scripts/chats.js";
import { getMessageTimeStamp } from "../../../../../scripts/RossAscends-mods.js";
import { debug, getLastMessageWithTracker, getLastNonSystemMessageIndex, getNextNonSystemMessageIndex, getPreviousNonSystemMessageIndex, isSystemMessage, shouldGenerateTracker, shouldShowPopup, warn } from "../lib/utils.js";
import { extensionSettings } from "../index.js";
import { generateTracker, getRequestPrompt } from "./generation.js";
import { generationModes, trackerFormat, trackerInjectionRoles } from "./settings/settings.js";
import { jsonToYAML } from "../lib/ymlParser.js";
import { FIELD_INCLUDE_OPTIONS, getDefaultTracker, OUTPUT_FORMATS, getTracker as getCleanTracker, trackerExists, cleanTracker } from "./trackerDataHandler.js";
import { TrackerEditorModal } from "./ui/trackerEditorModal.js";
import { TrackerPreviewManager } from "./ui/trackerPreviewManager.js";

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
 * Injects the inline prompt into the extension prompt system.
 * @param {boolean} clearTracker - If true, clears the inline prompt.
 */
async function injectInlinePrompt(clearTracker = false) {
	const inlinePrompt = clearTracker ? "" : getRequestPrompt(extensionSettings.inlineRequestPrompt, null, false);
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
	const role = getTrackerInjectionRole();
	if(trackerExists(tracker, extensionSettings.trackerDef) && tracker != "") {
		// Clean to a JSON object (strips defaults), then serialize in the user's configured format.
		const cleaned = cleanTracker(tracker, extensionSettings.trackerDef, OUTPUT_FORMATS.JSON);
		if(cleaned && Object.keys(cleaned).length) {
			const trackerText = serializeTracker(cleaned);
			debug("Injecting tracker:", { tracker: trackerText, position, format: extensionSettings.trackerFormat, role: extensionSettings.trackerInjectionRole });
			trackerBlock = `<tracker>\n${trackerText}\n</tracker>`;
		}
	}
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
	if (type === ACTION_TYPES.CONTINUE) {
		await refreshInlineTrackers(mesId - 1, true);
	}
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

	chat_metadata.tracker.tempTrackerId = null;
	chat_metadata.tracker.tempTracker = null;

	const mesId = getLastNonSystemMessageIndex();
	if (mesId === -1) {
		if (manageStopButton) restoreSendButtons();
		return;
	}

	if (shouldShowPopup(mesId, type)) {
		const manualTracker = await showManualTrackerPopup(mesId);
		if (manualTracker) {
			chat[mesId].tracker = manualTracker;
			await saveChatConditional();
			TrackerPreviewManager.updatePreview(mesId);
		}
	}

	const lastMes = chat[mesId];

	let tracker;
	let position;

	if ([ACTION_TYPES.CONTINUE, ACTION_TYPES.SWIPE, ACTION_TYPES.REGENERATE].includes(type)) {
		const hasTracker = trackerExists(lastMes.tracker, extensionSettings.trackerDef);
		if (!hasTracker && shouldGenerateTracker(mesId, type)) {
			const previousMesId = getPreviousNonSystemMessageIndex(mesId);
			lastMes.tracker = await generateTracker(previousMesId);
			if (type !== ACTION_TYPES.REGENERATE) {
				await saveChatConditional();
				TrackerPreviewManager.updatePreview(mesId);
			}
		}

		if (type === ACTION_TYPES.REGENERATE && hasTracker) {
			chat_metadata.tracker.tempTrackerId = mesId;
			chat_metadata.tracker.tempTracker = lastMes.tracker;
			await saveChatConditional();
			TrackerPreviewManager.updatePreview(mesId);
		}

		position = 0;
		tracker = lastMes.tracker;
	} else {
		// Deferred tracker generation for new responses.
		//
		// Previously we generated the upcoming message's tracker HERE — up front, blocking the main
		// response — so clicking "send" produced a tracker first and only then started the reply.
		// We now skip that auto-generation: the main prompt is injected with the LAST AVAILABLE
		// tracker (the fallback below), the response generates immediately, and the fresh tracker for
		// the new message is generated AFTER it is rendered, in addTrackerToMessage() (its `else`
		// branch fires because no tempTracker is stashed here).
		//
		// Explicit, user-initiated trackers still apply up front: a command override
		// (`/tracker-enhanced-override`) and the manual tracker popup are deliberate "before the
		// response" inputs, so they are kept.
		if(chat_metadata.tracker.cmdTrackerOverride) {
			tracker = { ...chat_metadata.tracker.cmdTrackerOverride };
			chat_metadata.tracker.cmdTrackerOverride = null;
		} else if (shouldShowPopup(mesId + 1, type)) {
			const manualTracker = await showManualTrackerPopup(mesId + 1);
			if (manualTracker) tracker = manualTracker;
		}

		if (tracker) {
			chat_metadata.tracker.tempTrackerId = mesId + 1;
			chat_metadata.tracker.tempTracker = tracker;
			await saveChatConditional();

			position = 0;
		}
	}

	if (!tracker) {
		// Deferred generation: never generate a tracker before the response. Reuse the most recent
		// message that already has a tracker so the model still sees current state; the fresh tracker
		// for this turn is generated afterwards in addTrackerToMessage() (post-response), which saves
		// it to the message so the next turn has something to reuse here.
		//
		// The only gap is the very first message of a brand-new, tracker-less chat: there is nothing
		// to reuse yet, so nothing is injected for that one turn. It self-heals from the next turn on,
		// once the first post-response tracker has been saved.
		const lastMesWithTrackerIndex = getLastMessageWithTracker(mesId);

		if (lastMesWithTrackerIndex !== null) {
			const lastMesWithTracker = chat[lastMesWithTrackerIndex];

			tracker = getCleanTracker(lastMesWithTracker.tracker, extensionSettings.trackerDef, FIELD_INCLUDE_OPTIONS.ALL, true, OUTPUT_FORMATS.JSON);
			position = 0;
		} else {
			tracker = "";
			position = 0;
		}
	}

	await injectTracker(tracker, position);

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

	/**
	 * Saves the tracker to the message and updates the chat metadata.
	 * @param {number} mesId - The message ID.
	 * @param {object} tracker - The tracker object.
	 */
	const saveTrackerToMessage = async (mesId, tracker) => {
		debug("Adding tracker to message:", { mesId, mes: chat[mesId], tracker });
		chat[mesId].tracker = tracker;
		if(typeof chat_metadata.tracker !== "undefined"){
			chat_metadata.tracker.tempTrackerId = null;
			chat_metadata.tracker.tempTracker = null;
			chat_metadata.tracker.cmdTrackerOverride = null;
		}
		await saveChatConditional();
		TrackerPreviewManager.updatePreview(mesId);

		if (manageStopButton) restoreSendButtons();
	};

	if (extensionSettings.generationMode === generationModes.INLINE) {
		const tempId = chat_metadata?.tracker?.inlineTrackerId ?? null;
		if (getNextNonSystemMessageIndex(tempId) === mesId) {
			await extractAndSaveInlineTracker(mesId, true);
			await removeInlineTrackers(true);
		}
		if(chat_metadata.tracker) chat_metadata.tracker.inlineTrackerId = null;
		await saveChatConditional();

		if (manageStopButton) restoreSendButtons();
		return;
	} else {
		if(isSystemMessage(mesId)) return;
		const tempId = chat_metadata?.tracker?.tempTrackerId ?? null;
		if(chat_metadata?.tracker?.cmdTrackerOverride) {
			saveTrackerToMessage(mesId, chat_metadata.tracker.cmdTrackerOverride);
		} else if (tempId != null) {
			debug("Checking for temp tracker match", { mesId, tempId });
			const trackerMesId = isSystemMessage(tempId) ? getNextNonSystemMessageIndex(tempId) : tempId;
			const tracker = chat_metadata.tracker.tempTracker;
			if (trackerMesId === mesId) {
				await saveTrackerToMessage(mesId, tracker);
			}
		} else {
			const previousMesId = getPreviousNonSystemMessageIndex(mesId);
			if (previousMesId !== -1 && shouldGenerateTracker(mesId, undefined)) {
				debug("Generating for message with missing tracker:", mesId);
				const tracker = await generateTracker(previousMesId);
				await saveTrackerToMessage(mesId, tracker);
			}
		}
	}
	} catch (e) {
		if (manageStopButton) restoreSendButtons();
	}
	if (manageStopButton) restoreSendButtons();
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
