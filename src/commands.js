import { debug, getLastNonSystemMessageIndex, getPreviousNonSystemMessageIndex } from "../lib/utils.js";
import { saveChatConditional, chat, chat_metadata } from "../../../../../script.js";
import { generateTracker } from "./generation.js";
import { removeTrackerFromMessage } from "./tracker.js";
import { FIELD_INCLUDE_OPTIONS, getTracker, OUTPUT_FORMATS } from "./trackerDataHandler.js";
import { TrackerPreviewManager } from "./ui/trackerPreviewManager.js";
import { extensionSettings } from "../index.js";
import { toggleExtension } from "./settings/settings.js";

/**
 * Resolves the `message=` argument to a chat index, defaulting to the last non-system message.
 * Treats 0 as a valid index (a plain falsy check would silently retarget message 0).
 * @param {string|number|undefined} messageArg - The raw `message=` argument.
 * @returns {number} The message index, or -1 if none is valid.
 */
function resolveMessageArg(messageArg) {
    if (messageArg === undefined || messageArg === null || messageArg === "") {
        return getLastNonSystemMessageIndex();
    }
    const mesId = Number(messageArg);
    if (!Number.isInteger(mesId) || mesId < 0 || !chat[mesId]) {
        return -1;
    }
    return mesId;
}

export async function generateTrackerCommand(args, value){
    const mesId = resolveMessageArg(args?.message);

    if (mesId === -1) {
        throw new Error(`No valid message found to generate a tracker.`);
    }

    let include = args?.include ? args.include.toUpperCase() : null;
    if(!include || !Object.keys(FIELD_INCLUDE_OPTIONS).includes(include)) include = 'DYNAMIC';

    const previousMesId = getPreviousNonSystemMessageIndex(mesId);
    if (previousMesId !== -1) {
        debug("Generating tracker for message " + mesId + " from command");
        const tracker = await generateTracker(previousMesId, FIELD_INCLUDE_OPTIONS[include]);
        
        if (tracker) {
            return JSON.stringify(tracker);
        } else {
            throw new Error(`Invalid response from tracker generation.`);
        }
    } else {
        throw new Error(`No valid message found before message ${mesId} to generate a tracker.`);
    }
}

export async function trackerOverrideCommand(args, value){
    const trackerString = args?.tracker;

    if (!trackerString) return;

    const tracker = JSON.parse(trackerString);

    if (!tracker) {
        throw new Error(`Invalid tracker object provided.`);
    }

    if(!chat_metadata.tracker) chat_metadata.tracker = {};
    chat_metadata.tracker.cmdTrackerOverride = tracker;
    await saveChatConditional();

    return JSON.stringify(tracker);
}

export async function saveTrackerToMessageCommand(args, value){
    const mesId = resolveMessageArg(args?.message);
    const trackerString = args?.tracker;

    if (mesId === -1 || !trackerString) {
        throw new Error(`Invalid message or tracker provided.`);
    }

    const tracker = JSON.parse(trackerString);

    if (!tracker) {
        throw new Error(`Invalid tracker object provided.`);
    }

    chat[mesId].tracker = tracker;
    await saveChatConditional();
    TrackerPreviewManager.updatePreview(mesId);

    return JSON.stringify(tracker);
}

export async function removeTrackerFromMessageCommand(args, value){
    const mesId = resolveMessageArg(args?.message);

    if (mesId === -1) {
        throw new Error(`No valid message found to remove a tracker from.`);
    }

    const removed = await removeTrackerFromMessage(mesId);
    return removed ? "true" : "false";
}

export async function getTrackerCommand(args, value){
    const mesId = resolveMessageArg(args?.message);

    if (mesId === -1) {
        throw new Error(`No valid message found to generate a tracker.`);
    }

    const trackerRaw = chat[mesId]?.tracker;

    if (!trackerRaw) {
        throw new Error(`No tracker found for message ${mesId}.`);
    }

    const tracker = getTracker(trackerRaw, extensionSettings.trackerDef, FIELD_INCLUDE_OPTIONS.ALL, true, OUTPUT_FORMATS.JSON);

    return JSON.stringify(tracker);
}

export async function stateTrackerCommand(args, value){
    const enabledString = args?.enabled;

    if (enabledString) {
        const enabled = enabledString.toLowerCase() === 'true';
        await toggleExtension(enabled);
        return enabled ? "true" : "false";
    }

    // Read the setting directly: isEnabled() is async (a bare call is always truthy) and also
    // captures the generation mutex as a side effect — neither is wanted for a state query.
    return extensionSettings.enabled ? "true" : "false";
}