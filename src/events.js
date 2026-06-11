import { chat } from "../../../../../script.js";
import { selected_group, is_group_generating } from "../../../../../scripts/group-chats.js";
import { debug, getLastMessageWithTracker, log } from "../lib/utils.js";
import { isEnabled } from "./settings/settings.js";
import { prepareMessageGeneration, addTrackerToMessage, clearInjects } from "./tracker.js";
import { releaseGeneration } from "../lib/interconnection.js";
import { FIELD_INCLUDE_OPTIONS, getTracker, OUTPUT_FORMATS, saveTracker } from "./trackerDataHandler.js";
import { TrackerInterface } from "./ui/trackerInterface.js";
import { extensionSettings } from "../index.js";

/**
 * Event handler for when the chat changes.
 * @param {object} args - The event arguments.
 */
async function onChatChanged(args) {
	await clearInjects();
	// isEnabled() CAPTURES the generation mutex when it returns true; every path past this
	// point must release it (finally), or other mutex-aware extensions see it held forever.
	if (!await isEnabled()) return;
	try {
		log("Chat changed:", args);
		updateTrackerInterface();
	} finally {
		releaseGeneration();
	}
}

/**
 * Event handler for after generation commands.
 * @param {string} type - The type of generation.
 * @param {object} options - Generation options.
 * @param {boolean} dryRun - Whether it's a dry run.
 */
async function onGenerateAfterCommands(type, options, dryRun) {
	if(!extensionSettings.enabled) await clearInjects();
	const enabled = await isEnabled();
	const allowedTypes = ["normal", "continue", "swipe", "regenerate", "impersonate", "group_chat"];

	if (dryRun) {
		log("GENERATION_AFTER_COMMANDS dry run skip", { type, dryRun, options });
		releaseGeneration();
		return;
	}

	if (!enabled || chat.length == 0 || (selected_group && !is_group_generating) || (typeof type != "undefined" && !allowedTypes.includes(type))) {
		debug("GENERATION_AFTER_COMMANDS Tracker skipped", { extenstionEnabled: extensionSettings.enabled, freeToRun: enabled, selected_group, is_group_generating, type });
		releaseGeneration();
		return;
	}

	if(type == "normal") type = undefined;
	log("GENERATION_AFTER_COMMANDS ", [type, options, dryRun]);
	try {
		await prepareMessageGeneration(type, options, dryRun);
	} finally {
		releaseGeneration();
	}
}

/**
 * Shared handler for rendered messages: generate/attach a tracker if the message lacks one.
 * isEnabled() captures the generation mutex when it returns true, so once past that guard the
 * release MUST run on every path (the old per-handler guards returned early and leaked it).
 * @param {string} eventName - Name used for logging.
 * @param {number} mesId - The message ID.
 */
async function onMessageRendered(eventName, mesId) {
	if (!await isEnabled()) return;
	try {
		if (!chat[mesId] || (chat[mesId].tracker && Object.keys(chat[mesId].tracker).length !== 0)) return;
		log(eventName, mesId);
		await addTrackerToMessage(mesId);
		updateTrackerInterface();
	} finally {
		releaseGeneration();
	}
}

/**
 * Event handler for when a character's message is rendered.
 */
async function onCharacterMessageRendered(mesId) {
	await onMessageRendered("CHARACTER_MESSAGE_RENDERED", mesId);
}

/**
 * Event handler for when a user's message is rendered.
 */
async function onUserMessageRendered(mesId) {
	await onMessageRendered("USER_MESSAGE_RENDERED", mesId);
}

export const eventHandlers = {
	onChatChanged,
	onGenerateAfterCommands,
	onCharacterMessageRendered,
	onUserMessageRendered,
};

function updateTrackerInterface() {
	const lastMesWithTrackerId = getLastMessageWithTracker();
	const tracker = chat[lastMesWithTrackerId]?.tracker ?? {};
	if(Object.keys(tracker).length === 0) return;
	const trackerData = getTracker(tracker, extensionSettings.trackerDef, FIELD_INCLUDE_OPTIONS.ALL, false, OUTPUT_FORMATS.JSON); // Get tracker data for the last message
	const onSave = (updatedTracker) => {
		saveTracker(updatedTracker, extensionSettings.trackerDef, lastMesWithTrackerId);
	};
	const trackerInterface = new TrackerInterface();
	trackerInterface.init(trackerData, lastMesWithTrackerId, onSave);
}
