import { eventSource, event_types } from "../../../../script.js";
import { extension_settings } from "../../../../scripts/extensions.js";
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";
import { ARGUMENT_TYPE, SlashCommandNamedArgument } from "../../../slash-commands/SlashCommandArgument.js";
import { commonEnumProviders } from "../../../slash-commands/SlashCommandCommonEnumsProvider.js";
import { SlashCommandEnumValue  } from "../../../slash-commands/SlashCommandEnumValue.js";

import { textgenerationwebui_settings as textgen_settings, textgen_types } from "../../../../scripts/textgen-settings.js";
import { oai_settings } from "../../../../scripts/openai.js";
import { nai_settings } from "../../../../scripts/nai-settings.js";
import { horde_settings } from "../../../../scripts/horde.js";
import { kai_settings } from "../../../../scripts/kai-settings.js";

import { initSettings } from "./src/settings/settings.js";
import { eventHandlers } from "./src/events.js";

import { registerGenerationMutexListeners } from './lib/interconnection.js';
import { TrackerInterface } from "./src/ui/trackerInterface.js";
import { TrackerPreviewManager } from "./src/ui/trackerPreviewManager.js";
import { generateTrackerCommand, getTrackerCommand, removeTrackerFromMessageCommand, saveTrackerToMessageCommand, stateTrackerCommand, trackerOverrideCommand } from "./src/commands.js";
import { FIELD_INCLUDE_OPTIONS } from "./src/trackerDataHandler.js";

export const extensionName = "tracker-enhanced";
// Derive the folder path from this module's own location so the extension works no matter what
// folder name it's installed into (e.g. "SillyTavern-Tracker" vs "SillyTavern-Tracker-Enhanced").
// Hardcoding the name caused html/settings.html to 404 when installed under a different name.
export const extensionFolderPath = new URL(".", import.meta.url).pathname.replace(/^\//, "").replace(/\/+$/, "");

if (!extension_settings[extensionName]) extension_settings[extensionName] = {};
export const extensionSettings = extension_settings[extensionName];

jQuery(async () => {
	await initSettings();
	await TrackerInterface.initializeTrackerButtons();
	TrackerPreviewManager.init();
});

registerGenerationMutexListeners();

eventSource.on(event_types.CHAT_CHANGED, eventHandlers.onChatChanged);
eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, eventHandlers.onCharacterMessageRendered);
eventSource.on(event_types.USER_MESSAGE_RENDERED, eventHandlers.onUserMessageRendered);
eventSource.on(event_types.GENERATION_AFTER_COMMANDS, eventHandlers.onGenerateAfterCommands);
eventSource.on(event_types.GENERATE_AFTER_COMBINE_PROMPTS, eventHandlers.generateAfterCombinePrompts);


SlashCommandParser.addCommandObject(SlashCommand.fromProps({
	name: 'generate-tracker-enhanced',
	callback: generateTrackerCommand,
	returns: 'The tracker JSON object.',
	namedArgumentList: [
		SlashCommandNamedArgument.fromProps({
			name: 'message',
			description: 'generate tracker for specific message',
			typeList: [ARGUMENT_TYPE.NUMBER],
			isRequired: false,
			enumProvider: commonEnumProviders.messages(),
		}),
		SlashCommandNamedArgument.fromProps({
			name: 'include',
			description: 'which fields to include in the tracker generation',
			typeList: [ARGUMENT_TYPE.string],
			isRequired: false,
			defaultValue: 'DYNAMIC',
			enumProvider: ()=> Object.keys(FIELD_INCLUDE_OPTIONS).map(key=>new SlashCommandEnumValue(key.toLowerCase())),
		}),
	],
	helpString: 'Generates a tracker for the given message. If no message is provided, the tracker will be generated for the last non-system message.',
	aliases: ['gen-tracker-enhanced'],
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
	name: 'tracker-enhanced-override',
	callback: trackerOverrideCommand,
	returns: 'The tracker JSON object.',
	namedArgumentList: [
		SlashCommandNamedArgument.fromProps({
			name: 'tracker',
			description: 'the tracker used to override',
			typeList: [ARGUMENT_TYPE.STRING],
			isRequired: true,
		}),
	],
	helpString: 'Overrides the tracker used for the next generation with the provided tracker.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
	name: 'save-tracker-enhanced',
	callback: saveTrackerToMessageCommand,
	returns: 'The tracker JSON object.',
	namedArgumentList: [
		SlashCommandNamedArgument.fromProps({
			name: 'message',
			description: 'message to add tracker to',
			typeList: [ARGUMENT_TYPE.NUMBER],
			isRequired: false,
			enumProvider: commonEnumProviders.messages(),
		}),
		SlashCommandNamedArgument.fromProps({
			name: 'tracker',
			description: 'the tracker to save',
			typeList: [ARGUMENT_TYPE.STRING],
			isRequired: true,
		}),
	],
	helpString: 'Saves tracker to message. If no message is provided, the tracker will be saved to the last non-system message.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
	name: 'remove-tracker-enhanced',
	callback: removeTrackerFromMessageCommand,
	returns: 'true if a tracker was removed, false otherwise.',
	namedArgumentList: [
		SlashCommandNamedArgument.fromProps({
			name: 'message',
			description: 'message to remove the tracker from',
			typeList: [ARGUMENT_TYPE.NUMBER],
			isRequired: false,
			enumProvider: commonEnumProviders.messages(),
		}),
	],
	helpString: 'Removes the tracker from the specified message. If no message is provided, the tracker will be removed from the last non-system message.',
	aliases: ['delete-tracker-enhanced'],
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
	name: 'get-tracker-enhanced',
	callback: getTrackerCommand,
	returns: 'The tracker JSON object.',
	namedArgumentList: [
		SlashCommandNamedArgument.fromProps({
			name: 'message',
			description: 'message to retrieve tracker from',
			typeList: [ARGUMENT_TYPE.NUMBER],
			isRequired: false,
			enumProvider: commonEnumProviders.messages(),
		}),
	],
	helpString: 'Retrieves the tracker from the specified message. If no message is provided, the tracker will be retrieved from the last non-system message.',
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
	name: 'tracker-enhanced-state',
	callback: stateTrackerCommand,
	returns: 'The current tracker extension state.',
	namedArgumentList: [
		SlashCommandNamedArgument.fromProps({
			name: 'enabled',
			description: 'whether to enable or disable the tracker extension',
			typeList: [ARGUMENT_TYPE.BOOLEAN],
			isRequired: false,
		}),
	],
	helpString: 'Get or set the tracker extension enabled/dissabled state.',
	aliases: ['toggle-tracker-enhanced'],
}));