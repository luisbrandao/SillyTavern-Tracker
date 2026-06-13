import { TrackerContentRenderer } from "./components/trackerContentRenderer.js";

export class TrackerEditorModal {
	constructor(mesId = null) {
		if (TrackerEditorModal.instance) {
			return TrackerEditorModal.instance;
		}
		TrackerEditorModal.instance = this;
		this.mesId = mesId;
		this.modal = null;
		this.tracker = null;
		this.originalTracker = null;
		this.resolvePromise = null;
		this.renderer = new TrackerContentRenderer();
	}

	/**
	 * Displays the modal with the provided tracker object.
	 * Returns a promise that resolves with the updated or original tracker.
	 * @param {object} tracker - The tracker data object to edit.
	 * @returns {Promise<object>} - A promise resolving with the tracker object.
	 */
	show(tracker) {
		return new Promise((resolve) => {
			this.tracker = JSON.parse(JSON.stringify(tracker)); // Clone the tracker
			this.originalTracker = tracker;
			this.resolvePromise = resolve;

			if (!this.modal) {
				this.createModal();
			}

			this.updateContent();
			document.body.appendChild(this.modal);
			this.modal.showModal();
		});
	}

	/**
	 * Creates the modal dialog elements.
	 */
	createModal() {
		this.modal = document.createElement("dialog");
		this.modal.className = "tracker-editor-modal popup popup--animation-fast";

		// Control Bar
		const modalControlBar = document.createElement("div");
		modalControlBar.className = "tracker-modal-control-bar";

		// Close Button
		const modalCloseButton = document.createElement("div");
		modalCloseButton.id = "TrackerEditorModalClose";
		modalCloseButton.className = "fa-solid fa-circle-xmark hoverglow";
		modalCloseButton.onclick = () => {
			this.close(false);
		};
		modalControlBar.appendChild(modalCloseButton);

		// Content Area
		this.modalContent = document.createElement("div");
		this.modalContent.className = "tracker-modal-content";

		// Footer
		const modalFooter = document.createElement("div");
		modalFooter.className = "tracker-modal-footer";

		// Save Button
		const saveButton = document.createElement("button");
		saveButton.className = "tracker-modal-save-button menu_button interactable";
		saveButton.textContent = "Save";
		saveButton.onclick = () => {
			this.close(true);
		};
		modalFooter.appendChild(saveButton);

		// Cancel Button
		const cancelButton = document.createElement("button");
		cancelButton.className = "tracker-modal-cancel-button menu_button interactable";
		cancelButton.textContent = "Cancel";
		cancelButton.onclick = () => {
			this.close(false);
		};
		modalFooter.appendChild(cancelButton);

		// Append elements to modal
		this.modal.appendChild(modalControlBar);
		this.modal.appendChild(this.modalContent);
		this.modal.appendChild(modalFooter);
	}

	/**
	 * Updates the modal content with the tracker editor view.
	 */
	updateContent() {
		if (this.mesId) {
			this.modalContent.innerHTML = '<h3 class="tracker-modal-title">Edit Tracker for Message ' + this.mesId + '</h3>';
		} else {
			this.modalContent.innerHTML = '<h3 class="tracker-modal-title">Edit Tracker</h3>';
		}

		// Generate the editor view
		const editorElement = this.renderer.renderEditorView(this.tracker, (updatedTracker) => {
			this.tracker = updatedTracker;
		});

		// Append the editor to the modal content
		this.modalContent.appendChild(editorElement);
	}

	/**
	 * Closes the modal, resolves the promise, and cleans up.
	 * @param {boolean} isSave - Whether to save the changes.
	 */
	close(isSave) {
		if (this.modal) {
			this.modal.close();
			document.body.removeChild(this.modal);
			this.modal = null;
			TrackerEditorModal.instance = null;

			if (isSave) {
				// Resolve with the updated tracker
				this.resolvePromise(this.tracker);
			} else {
				this.resolvePromise(null);
			}
		}
	}
}
