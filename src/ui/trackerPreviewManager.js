import { emitTrackerPreviewAdded, emitTrackerPreviewUpdated } from "../../lib/interconnection.js";
import { debug, error } from "../../lib/utils.js";
import { TrackerContentRenderer } from "./components/trackerContentRenderer.js";
import { TrackerPreview } from "./components/trackerPreview.js";

export class TrackerPreviewManager {
    /**
     * Initializes the TrackerPreviewManager and sets up the MutationObserver.
     */
    static init() {
        debug("Initializing TrackerPreviewManager");
        this.previews = this.previews || new Map();
        this.observer = this.observer || null;
        this.mutationDebounceTimer = this.mutationDebounceTimer || null;
        this.contentRenderer = this.contentRenderer || new TrackerContentRenderer();

        this.observeChat();
        this.scanAndRender();
    }

    /**
     * Sets up a MutationObserver on the #chat element.
     */
    static observeChat() {
        const chatElement = document.getElementById("chat");
        if (!chatElement) {
            error("Chat element (#chat) not found.");
            return;
        }

        this.observer = new MutationObserver((mutationsList) => {
            // Debounce mutation handling
            if (this.mutationDebounceTimer) clearTimeout(this.mutationDebounceTimer);
            this.mutationDebounceTimer = setTimeout(() => {
                debug("Handling mutations:", mutationsList);
                this.handleMutations(mutationsList);
            }, 50); // Debounce delay in milliseconds
        });

        this.observer.observe(chatElement, {
            childList: true, // Observe addition/removal of child nodes
            subtree: false, // Observe direct children only
            attributes: false, // Do not observe attribute changes
        });
    }

    /**
     * Handles mutations detected by the MutationObserver.
     * @param {MutationRecord[]} mutationsList - List of mutations.
     */
    static handleMutations(mutationsList) {
        debug("Detected DOM mutations, reindexing previews.");
        this.reindexPreviews();
    }

    /**
     * Scans the chat and renders previews for messages.
     */
    static scanAndRender() {
        const chatElement = document.getElementById("chat");
        if (!chatElement) {
            error("Chat element (#chat) not found.");
            return;
        }

        // Determine if the user is at the bottom before changes
        const isAtBottom = (chatElement.scrollHeight - chatElement.scrollTop - chatElement.clientHeight) <= 1;

        // Identify the first visible message in the viewport if the user is not at the bottom
        let offset = 0;
        let firstVisibleMessage = null;
        if (!isAtBottom) {
            const messages = Array.from(chatElement.querySelectorAll(".mes"));
            firstVisibleMessage = messages.find((message) => {
                const rect = message.getBoundingClientRect();
                return rect.bottom > 0;
            });

            if (firstVisibleMessage) {
                const rect = firstVisibleMessage.getBoundingClientRect();
                offset = rect.top;
            }
        }

        // Perform the DOM updates
        const messageElements = document.querySelectorAll("#chat .mes");
        debug(`Scanning and rendering previews for ${messageElements.length} messages.`);
        messageElements.forEach((messageElement) => {
            const messageId = messageElement.getAttribute("mesid");
            if (messageId) {
                debug(`Processing message with mesid "${messageId}".`);
                this.addPreview(messageId);
            } else {
                debug(`Skipping message without a valid mesid.`);
            }
        });

        // After updates, adjust scroll position
        if (isAtBottom) {
            // If the user was at the bottom, scroll to bottom
            chatElement.scrollTop = chatElement.scrollHeight;
        } else if (firstVisibleMessage) {
            // If the user was not at the bottom, adjust scroll to keep the first visible message in view
            const newRect = firstVisibleMessage.getBoundingClientRect();
            const newOffset = newRect.top;
            const offsetDifference = newOffset - offset;
            chatElement.scrollTop += offsetDifference;
        }
    }

    /**
     * Rebuilds the previews map to reflect the current state of the DOM.
     */
    static reindexPreviews() {
        const chatElement = document.getElementById("chat");
        if (!chatElement) {
            error("Chat element (#chat) not found.");
            return;
        }

        // Determine if the user is at the bottom before changes
        const isAtBottom = (chatElement.scrollHeight - chatElement.scrollTop - chatElement.clientHeight) <= 1;

        // Identify the first visible message in the viewport if the user is not at the bottom
        let offset = 0;
        let firstVisibleMessage = null;
        if (!isAtBottom) {
            const messages = Array.from(chatElement.querySelectorAll(".mes"));
            firstVisibleMessage = messages.find((message) => {
                const rect = message.getBoundingClientRect();
                return rect.bottom > 0;
            });

            if (firstVisibleMessage) {
                const rect = firstVisibleMessage.getBoundingClientRect();
                offset = rect.top;
            }
        }

        const messageElements = document.querySelectorAll("#chat .mes");
        debug(`Reindexing previews for ${messageElements.length} messages.`);
        const currentPreviewIds = new Set();

        // Process each message element in the DOM
        messageElements.forEach((messageElement) => {
            const uniqueId = messageElement.getAttribute("data-preview-id");
            const currentMesId = messageElement.getAttribute("mesid");

            if (!currentMesId) {
                debug("Skipping element without mesid.");
                return;
            }

            if (uniqueId) {
                currentPreviewIds.add(uniqueId);

                // Check if this preview exists
                const preview = this.previews.get(uniqueId);

                if (preview) {
                    // Update the mesId if it has changed
                    if (preview.messageId !== currentMesId) {
                        preview.updateMessageId(currentMesId);
                        debug(`Updated mesid for preview with unique ID "${uniqueId}".`);
                    }
                } else {
                    // If no preview exists, create one
                    this.addPreview(currentMesId);
                    debug(`Created new preview for mesid "${currentMesId}".`);
                }
            } else {
                // Generate and assign a unique ID, then add the preview
                const newUniqueId = this.generateUniqueId();
                messageElement.setAttribute("data-preview-id", newUniqueId);
                currentPreviewIds.add(newUniqueId);
                this.addPreview(currentMesId);
                debug(`Assigned new unique ID "${newUniqueId}" to message with mesid "${currentMesId}".`);
            }
        });

        // Remove previews for messages no longer in the DOM
        const previewsToDelete = Array.from(this.previews.keys()).filter(
            (uniqueId) => !currentPreviewIds.has(uniqueId)
        );

        previewsToDelete.forEach((uniqueId) => {
            this.handleMessageDeletion(uniqueId);
            debug(`Deleted preview with unique ID "${uniqueId}" no longer in DOM.`);
        });

        debug("Reindexing complete. Current previews:", Array.from(this.previews.keys()));

        // After updates, adjust scroll position
        if (isAtBottom) {
            // If the user was at the bottom, scroll to bottom
            chatElement.scrollTop = chatElement.scrollHeight;
        } else if (firstVisibleMessage) {
            // If the user was not at the bottom, adjust scroll to keep the first visible message in view
            const newRect = firstVisibleMessage.getBoundingClientRect();
            const newOffset = newRect.top;
            const offsetDifference = newOffset - offset;
            chatElement.scrollTop += offsetDifference;
        }
    }

    /**
     * Triggers an update for a specific message's preview.
     * @param {string} messageId - The ID of the message to update.
     * @param {object} [tracker=null] - Optional tracker data.
     */
    static updatePreview(messageId, tracker = null) {
        // Find the message element by its mesid
        const messageElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
        if (!messageElement) {
            debug(`Message element with mesid "${messageId}" not found. Cannot update preview.`);
            return;
        }

        // Get the unique ID associated with the message
        const uniqueId = messageElement.getAttribute("data-preview-id");
        if (!uniqueId) {
            debug(`No unique ID found for message with mesid "${messageId}". Creating new preview.`);
            this.addPreview(messageId);
            return;
        }

        // Find the existing preview by its unique ID
        const preview = this.previews.get(uniqueId);
        if (preview) {
            debug(`Updating preview for unique ID "${uniqueId}" (mesid: "${messageId}").`);
            preview.update(tracker);
            emitTrackerPreviewUpdated(messageId, preview.messageElement);
        } else {
            debug(`No preview found for unique ID "${uniqueId}". Creating new preview.`);
            this.addPreview(messageId);
        }
    }

    /**
     * Adds a TrackerPreview for the given messageId.
     * @param {string} messageId - The message ID.
     */
    static addPreview(messageId) {
        // Locate the message element in the DOM
        const messageElement = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
        if (!messageElement) {
            debug(`Message element with mesid "${messageId}" not found.`);
            return;
        }

        // Ensure the element has a unique ID
        let uniqueId = messageElement.getAttribute("data-preview-id");
        if (!uniqueId) {
            // Generate and assign a unique ID
            uniqueId = this.generateUniqueId();
            messageElement.setAttribute("data-preview-id", uniqueId);
            debug(`Assigned unique ID "${uniqueId}" to message with mesid "${messageId}".`);
        }

        // Check if a preview already exists for this unique ID
        if (!this.previews.has(uniqueId)) {
            // Create a new preview
            const preview = new TrackerPreview(messageId, this.contentRenderer);
            if (preview.messageElement) {
                this.previews.set(uniqueId, preview);
                debug(`Created and stored preview for unique ID "${uniqueId}".`);
                emitTrackerPreviewAdded(messageId, preview.messageElement);
            } else {
                debug(`Failed to create preview for messageId "${messageId}".`);
            }
        } else {
            debug(`Preview already exists for unique ID "${uniqueId}".`);
        }
    }

    /**
     * Removes the TrackerPreview for the given uniqueId.
     * @param {string} uniqueId - The unique ID of the preview.
     */
    static handleMessageDeletion(uniqueId) {
        const preview = this.previews.get(uniqueId);
        if (preview) {
            preview.delete();
            this.previews.delete(uniqueId);
        }
    }

    /**
     * Generates a unique ID for a tracker preview.
     * The ID is composed of the current timestamp and a random string.
     * @returns {string} A unique ID string.
     */
    static generateUniqueId() {
        return `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

}
