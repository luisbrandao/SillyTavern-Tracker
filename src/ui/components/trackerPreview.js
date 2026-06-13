import { chat } from "../../../../../../../script.js";
import { extensionSettings } from "../../../index.js";
import { debug, log, warn } from "../../../lib/utils.js";
import { PREVIEW_PLACEMENT } from "../../settings/defaultSettings.js";

export class TrackerPreview {
    constructor(messageId, trackerContentRenderer) {
        this.messageId = messageId;
        this.contentRenderer = trackerContentRenderer;
        this.init();
    }

    /**
     * Initializes the TrackerPreview instance.
     */
    init() {
        this.messageElement = document.querySelector(`#chat .mes[mesid="${this.messageId}"]`);

        if (!this.messageElement) {
            warn(`Message with mesid="${this.messageId}" not found. Aborting TrackerPreview initialization.`);
            return;
        }

        this.tracker = this.getTracker();
        if(this.tracker && Object.keys(this.tracker).length > 0) this.render();
    }

    /**
     * Retrieves the tracker object for the current message.
     * @returns {object} The tracker object.
     */
    getTracker() {
        // Ensure the tracker exists
        if (!chat[this.messageId].tracker) {
            chat[this.messageId].tracker = {};
        }
        return chat[this.messageId].tracker;
    }

    /**
     * Renders the tracker preview.
     */
    render() {
        const template = extensionSettings.mesTrackerTemplate;
        const previewHtml = this.contentRenderer.renderFromTemplate(this.tracker, template);

        // Remove existing preview if present
        const existingPreview = this.messageElement.querySelector('.mes_tracker');
        if (existingPreview) existingPreview.remove();

        // If tracker is empty, do not render a preview
        if (!this.tracker || Object.keys(this.tracker).length === 0) {
            debug(`Tracker for message ${this.messageId} is empty. Skipping preview.`);
            return;
        }

        // Create and insert the new preview
        this.previewElement = document.createElement('div');
        this.previewElement.className = 'mes_tracker';
        this.previewElement.innerHTML = previewHtml;

        const targetSelector = extensionSettings.trackerPreviewSelector;
        const placement = extensionSettings.trackerPreviewPlacement;

        const targetElement = this.messageElement.querySelector(targetSelector);
        if (targetElement) {
            switch (placement) {
                case PREVIEW_PLACEMENT.BEFORE:
                    targetElement.before(this.previewElement);
                    break;
                case PREVIEW_PLACEMENT.AFTER:
                    targetElement.after(this.previewElement);
                    break;
                case PREVIEW_PLACEMENT.APPEND:
                    targetElement.appendChild(this.previewElement);
                    break;
                case PREVIEW_PLACEMENT.PREPEND:
                    targetElement.prepend(this.previewElement);
                    break;
            }
        } else {
            warn(`Target element "${targetSelector}" not found within message ${this.messageId}.`);
        }
    }

    /**
     * Updates the preview manually when the tracker changes.
     */
    update(tracker = null) {
        log(`Updating preview for message ${this.messageId}`);
        if (tracker) {
            this.tracker = tracker;
        } else {
            this.tracker = this.getTracker();
        }
        this.render();
    }

    /**
     * Updates the messageId and re-initializes the preview.
     * @param {string} newMessageId - The new messageId after reordering.
     */
    updateMessageId(newMessageId) {
        debug(`Updating messageId for preview from ${this.messageId} to ${newMessageId}`);
        this.messageId = newMessageId;
        this.init();
    }

    /**
     * Deletes the preview and cleans up.
     */
    delete() {
        if (this.previewElement && this.previewElement.parentNode) {
            this.previewElement.parentNode.removeChild(this.previewElement);
        }
    }
}
