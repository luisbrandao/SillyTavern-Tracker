import { chat } from "../../../../../script.js";
import { extensionName, extensionSettings } from "../index.js";
import { generationTargets } from "../src/settings/settings.js";
import { trackerExists } from "../src/trackerDataHandler.js";

// Logging functions
export function log(...msg) {
	console.log(`[${extensionName}]`, ...msg);
}

export function warn(...msg) {
	console.warn(`[${extensionName}] Warning`, ...msg);
}

export function error(...msg) {
	console.error(`[${extensionName}] Error`, ...msg);
}

export function debug(...msg) {
	if (extensionSettings.debugMode) {
		console.log(`[${extensionName} debug]`, ...msg);
	}
}

export function getLastMessageWithTracker(mesId = chat.length - 1) {
	for (let i = mesId; i >= 0; i--) {
		if (chat[i] && trackerExists(chat[i].tracker, extensionSettings.trackerDef)) return i;
	}
	return null;
}

/**
 * Returns the index of the last non-system message in the chat.
 * @returns {number} Index of the last non-system message.
 */
export function getLastNonSystemMessageIndex() {
	const lastMessageIndex = chat
		.slice()
		.reverse()
		.findIndex((c) => !c.is_system && !c.owner_extension);
	if (lastMessageIndex === -1) return -1;
	return chat.length - 1 - lastMessageIndex;
}

export function isSystemMessage(mesId) {
	var isSystem = chat[mesId]?.is_system;
	if(chat[mesId]?.is_system === '') isSystem = true;
	return isSystem || chat[mesId]?.owner_extension;
}

export function getNextNonSystemMessageIndex(mesId) {
	let nextMesId = -1;
	for (let i = mesId + 1; i < chat.length; i++) {
		if (!isSystemMessage(i)) {
			nextMesId = i;
			break;
		}
	}
	return nextMesId;
}

export function getPreviousNonSystemMessageIndex(mesId) {
	let prevMesId = -1;
	for (let i = mesId - 1; i >= 0; i--) {
		if (!isSystemMessage(i)) {
			prevMesId = i;
			break;
		}
	}
	return prevMesId;
}

export function shouldGenerateTracker(mesId, type) {
	debug("Checking if tracker should be generated for message", { mesId, type });
	if(isSystemMessage(mesId)) return false;

	const message = chat[mesId];
	const target = extensionSettings.generationTarget;

	const isUser = message?.is_user ?? false;

	if (target === generationTargets.NONE || mesId < extensionSettings.generateFromMessage) return false;

	let requiredTarget;

	if (type === "impersonate") {
		requiredTarget = [generationTargets.USER, generationTargets.BOTH];
	} else if (type === "continue" || type === "regenerate") {
		if (isUser) {
			requiredTarget = [generationTargets.USER, generationTargets.BOTH];
		} else {
			requiredTarget = [generationTargets.CHARACTER, generationTargets.BOTH];
		}
	} else if (type === "swipe") {
		if (isUser) return false;
		requiredTarget = [generationTargets.CHARACTER, generationTargets.BOTH];
	} else {
		if (isUser) requiredTarget = [generationTargets.USER, generationTargets.BOTH];
		else requiredTarget = [generationTargets.CHARACTER, generationTargets.BOTH];
	}

	debug("Required target", { mesId, type, requiredTarget, target });

	return requiredTarget.includes(target);
}

export function shouldShowPopup(mesId, type) {
	debug("Checking if manual tracker popup should be shown for message", { mesId, type });
	if(isSystemMessage(mesId)) return false;
	
	const message = chat[mesId];
	const target = extensionSettings.showPopupFor;

	const isUser = message?.is_user ?? false;

	if (target === generationTargets.NONE) return false;

	let requiredTarget;

	if (type === "impersonate") {
		requiredTarget = [generationTargets.USER, generationTargets.BOTH];
	} else if (type === "continue" || type === "regenerate") {
		if (isUser) {
			requiredTarget = [generationTargets.USER, generationTargets.BOTH];
		} else {
			requiredTarget = [generationTargets.CHARACTER, generationTargets.BOTH];
		}
	} else if (type === "swipe") {
		if (isUser) return false;
		requiredTarget = [generationTargets.CHARACTER, generationTargets.BOTH];
	} else {
		if (isUser) requiredTarget = [generationTargets.USER, generationTargets.BOTH];
		else requiredTarget = [generationTargets.CHARACTER, generationTargets.BOTH];
	}

	debug("Required target", { mesId, type, requiredTarget, target });

	return requiredTarget.includes(target);
}

export function toTitleCase(str) {
	return str
		.toLowerCase()
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export function unescapeJsonString(input) {
    const QUOTED_STRING_REGEX = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;

    let result = input.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\\/g, (match, quotedString) => {
        if (quotedString) {
            return quotedString;
        }
        return '';
    });

    const SPECIAL_CHARS_REGEX = /[\\~!@#$%^&*()_+{}|:"<>?\-=\[\];',.\/]/;

    result = result.replace(QUOTED_STRING_REGEX, (quoted) => {
        let inner = quoted;

        inner = inner.replace(/\\u(?![0-9A-Fa-f]{4})/g, '\\\\u');

        inner = inner.replace(/\\([^"\\/bfnrtu])?/g, (match, nextChar) => {
            if (!nextChar) {
                return '\\\\';
            }

            if (SPECIAL_CHARS_REGEX.test(nextChar)) {
                return nextChar;
            } else {
                return '\\\\' + nextChar;
            }
        });

        return inner;
    });

    return result;
}