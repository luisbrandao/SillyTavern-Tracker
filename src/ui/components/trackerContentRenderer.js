import { extensionSettings } from "../../../index.js";
import { TrackerPromptMaker } from "./trackerPromptMaker.js";

export class TrackerContentRenderer {
	constructor() {
		this.schema = extensionSettings.trackerDef;
	}

	get FIELD_TYPES() {
		const types = { ...TrackerPromptMaker.FIELD_TYPES };
		Object.keys(types).forEach((key) => {
			types[key] = key;
		});
		return types;
	}

	/**
	 * Generates a default hierarchical view of the tracker fields.
	 * @param {object} tracker - The tracker data object.
	 * @returns {HTMLElement} - The root element containing the rendered view.
	 */
	renderDefaultView(tracker) {
		const root = document.createElement("div");
		root.className = "tracker-view-container";

		const createFields = (object, schema, parentElement) => {
			for (const fieldSchema of Object.values(schema)) {
				const value = object[fieldSchema.name];
				const fieldType = fieldSchema.type;

				const wrapper = document.createElement("div");
				wrapper.className = "tracker-view-field";

				const label = document.createElement("span");
				label.className = "tracker-view-label";
				label.textContent = `${fieldSchema.name}: `;
				wrapper.appendChild(label);

				switch (fieldType) {
					case this.FIELD_TYPES.ARRAY:
					case this.FIELD_TYPES.ARRAY_OBJECT: {
						let arrayValue = value;
						if (fieldType === this.FIELD_TYPES.ARRAY_OBJECT) arrayValue = Object.values(value);
						const arrayString = Array.isArray(arrayValue) ? arrayValue.join("; ") : "";
						const valueSpan = document.createElement("span");
						valueSpan.className = "tracker-view-value";
						valueSpan.textContent = arrayString;
						wrapper.appendChild(valueSpan);
						break;
					}
					case this.FIELD_TYPES.OBJECT: {
						const nestedFields = document.createElement("div");
						nestedFields.className = "tracker-view-nested";
						createFields(value, fieldSchema.nestedFields, nestedFields);
						wrapper.appendChild(nestedFields);
						break;
					}
					case this.FIELD_TYPES.FOR_EACH_OBJECT: {
						const nestedFields = document.createElement("div");
						nestedFields.className = "tracker-view-nested";
						Object.entries(value).forEach(([nestedKey, nestedValue]) => {
							const forEachWrapper = document.createElement("div");
							forEachWrapper.className = "tracker-view-field";

							const forEachLabel = document.createElement("span");
							forEachLabel.className = "tracker-view-label";
							forEachLabel.textContent = `${nestedKey}: `;
							forEachWrapper.appendChild(forEachLabel);

							const forEachFields = document.createElement("div");
							forEachFields.className = "tracker-view-nested";
							createFields(nestedValue, fieldSchema.nestedFields, forEachFields);
							forEachWrapper.appendChild(forEachFields);
							nestedFields.appendChild(forEachWrapper);
						});
						wrapper.appendChild(nestedFields);
						break;
					}
					case this.FIELD_TYPES.FOR_EACH_ARRAY: {
						const nestedFields = document.createElement("div");
						nestedFields.className = "tracker-view-nested";

						Object.entries(value).forEach(([nestedKey, nestedValue]) => {
							// nestedValue is expected to be an array
							const forEachWrapper = document.createElement("div");
							forEachWrapper.className = "tracker-view-field";

							const forEachLabel = document.createElement("span");
							forEachLabel.className = "tracker-view-label";
							forEachLabel.textContent = `${nestedKey}: `;
							forEachWrapper.appendChild(forEachLabel);

							const forEachFields = document.createElement("div");
							forEachFields.className = "tracker-view-nested";

							// Determine if single string field or multiple fields
							const nestedFieldValues = Object.values(fieldSchema.nestedFields);
							const singleStringField = nestedFieldValues.length === 1 && nestedFieldValues[0].type === this.FIELD_TYPES.STRING;

							if (singleStringField) {
								// Arrays of strings
								const arrayString = Array.isArray(nestedValue) ? nestedValue.join("; ") : "";
								const valueSpan = document.createElement("span");
								valueSpan.className = "tracker-view-value";
								valueSpan.textContent = arrayString;
								forEachFields.appendChild(valueSpan);
							} else {
								// Arrays of objects
								if (Array.isArray(nestedValue)) {
									nestedValue.forEach((arrItem, arrIndex) => {
										const arrItemWrapper = document.createElement("div");
										arrItemWrapper.className = "tracker-view-field";

										const arrItemLabel = document.createElement("span");
										arrItemLabel.className = "tracker-view-label";
										arrItemLabel.textContent = `[${arrIndex}]: `;
										arrItemWrapper.appendChild(arrItemLabel);

										const arrItemFields = document.createElement("div");
										arrItemFields.className = "tracker-view-nested";
										createFields(arrItem, fieldSchema.nestedFields, arrItemFields);

										arrItemWrapper.appendChild(arrItemFields);
										forEachFields.appendChild(arrItemWrapper);
									});
								}
							}

							forEachWrapper.appendChild(forEachFields);
							nestedFields.appendChild(forEachWrapper);
						});

						wrapper.appendChild(nestedFields);
						break;
					}
					default: {
						const valueSpan = document.createElement("span");
						valueSpan.className = "tracker-view-value";
						valueSpan.textContent = value || "";
						wrapper.appendChild(valueSpan);
						break;
					}
				}

				parentElement.appendChild(wrapper);
			}
		};

		createFields(tracker, this.schema, root);
		return root;
	}

	/**
	 * Generates an editable representation of the tracker fields in an inline format.
	 * @param {object} tracker - The tracker data object.
	 * @param {function} onUpdate - Callback function to pass the updated tracker object.
	 * @returns {HTMLElement} - The root element containing the editor view.
	 */
	renderEditorView(tracker, onUpdate) {
		const root = document.createElement("div");
		root.className = "tracker-editor-container";

		function adjustTextareaHeight(textarea) {
			// Ensure no minimum height is enforced
			textarea.style.minHeight = "0px";
			textarea.style.overflowY = "hidden";
			textarea.style.height = "0px";
			textarea.style.height = textarea.scrollHeight + "px";
		}

		// In your createAutoResizingTextarea function:
		const createAutoResizingTextarea = (value, onChange) => {
			const textarea = document.createElement("textarea");
			textarea.className = "tracker-editor-textarea";
			textarea.value = value || "";

			// Apply any inline styles if needed
			textarea.style.minHeight = "0px";
			textarea.style.overflowY = "hidden";
			textarea.style.resize = "none"; // Prevent manual resizing if desired

			const adjust = () => adjustTextareaHeight(textarea);

			requestAnimationFrame(adjust);

			textarea.addEventListener("input", (event) => {
				let newValue = event.target.value.replace(/"/g, "'");
				if (newValue !== event.target.value) {
					toastr.warning("Double quotes are not allowed and have been replaced with single quotes.");
					event.target.value = newValue;
				}
				onChange(newValue);
				adjust();
			});

			return textarea;
		};

		const createEditorFields = (object, schema, parentElement) => {
			for (const fieldSchema of Object.values(schema)) {
				const value = object[fieldSchema.name];
				const fieldType = fieldSchema.type;

				const wrapper = document.createElement("div");
				wrapper.className = "tracker-editor-field";

				const label = document.createElement("label");
				label.className = "tracker-editor-label";
				label.textContent = `${fieldSchema.name}: `;
				wrapper.appendChild(label);

				switch (fieldType) {
					case this.FIELD_TYPES.ARRAY: {
						const arrayValue = value && Array.isArray(value) ? value : [];
						object[fieldSchema.name] = arrayValue;

						const listContainer = document.createElement("div");
						listContainer.className = "tracker-editor-list";

						arrayValue.forEach((itemValue, index) => {
							const itemWrapper = document.createElement("div");
							itemWrapper.className = "tracker-editor-list-item";

							const textarea = createAutoResizingTextarea(itemValue, (newVal) => {
								arrayValue[index] = newVal;
								onUpdate(tracker);
							});
							itemWrapper.appendChild(textarea);

							const removeButton = document.createElement("button");
							removeButton.className = "menu_button interactable";
							removeButton.textContent = "Remove";
							removeButton.addEventListener("click", () => {
								arrayValue.splice(index, 1);
								onUpdate(tracker);
								root.replaceWith(this.renderEditorView(tracker, onUpdate));
							});
							itemWrapper.appendChild(removeButton);

							listContainer.appendChild(itemWrapper);
						});

						const addButton = document.createElement("button");
						addButton.className = "menu_button interactable";
						addButton.textContent = "Add Item";
						addButton.addEventListener("click", () => {
							arrayValue.push("");
							onUpdate(tracker);
							root.replaceWith(this.renderEditorView(tracker, onUpdate));
						});
						listContainer.appendChild(addButton);

						wrapper.appendChild(listContainer);
						break;
					}
					case this.FIELD_TYPES.ARRAY_OBJECT:
					case this.FIELD_TYPES.OBJECT: {
						const nestedObject = value || {};
						object[fieldSchema.name] = nestedObject;

						const nestedFields = document.createElement("div");
						nestedFields.className = "tracker-editor-nested";
						createEditorFields(nestedObject, fieldSchema.nestedFields, nestedFields);
						wrapper.appendChild(nestedFields);
						break;
					}
					case this.FIELD_TYPES.FOR_EACH_OBJECT: {
						const objectValue = value || {};
						object[fieldSchema.name] = objectValue;

						const nestedFields = document.createElement("div");
						nestedFields.className = "tracker-editor-nested";

						const createDefaultValues = (schema) => {
							const obj = {};
							for (const nestedField of Object.values(schema)) {
								switch (nestedField.type) {
									case this.FIELD_TYPES.STRING:
										obj[nestedField.name] = nestedField.defaultValue || "";
										break;
									case this.FIELD_TYPES.ARRAY:
										obj[nestedField.name] = nestedField.defaultValue || [];
										break;
									case this.FIELD_TYPES.OBJECT:
										obj[nestedField.name] = createDefaultValues(nestedField.nestedFields);
										break;
									default:
										obj[nestedField.name] = nestedField.defaultValue || "";
								}
							}
							return obj;
						};

						// Existing entries
						Object.entries(objectValue).forEach(([nestedKey, nestedValue]) => {
							const itemWrapper = document.createElement("div");
							itemWrapper.className = "tracker-editor-field";

							const keyLabel = document.createElement("label");
							keyLabel.className = "tracker-editor-label";
							keyLabel.textContent = `${nestedKey}: `;
							itemWrapper.appendChild(keyLabel);

							// Remove button for each item
							const removeButton = document.createElement("button");
							removeButton.className = "menu_button interactable";
							removeButton.textContent = "Remove";
							removeButton.addEventListener("click", () => {
								delete objectValue[nestedKey];
								onUpdate(tracker);
								itemWrapper.remove(); // Remove the DOM element
							});

							const forEachFields = document.createElement("div");
							forEachFields.className = "tracker-editor-nested";
							createEditorFields(nestedValue, fieldSchema.nestedFields, forEachFields);
							forEachFields.appendChild(removeButton);
							itemWrapper.appendChild(forEachFields);

							nestedFields.appendChild(itemWrapper);
						});

						// Add Item button
						const addButton = document.createElement("button");
						addButton.className = "menu_button interactable";
						addButton.textContent = "Add Item";
						addButton.addEventListener("click", () => {
							// Prompt the user for the key
							const newKey = prompt("Enter key for new item:");
							if (newKey) {
								if (Object.prototype.hasOwnProperty.call(objectValue, newKey)) {
									alert("An item with that key already exists.");
								} else {
									// Create a new object with default values from the schema
									const newObject = createDefaultValues(fieldSchema.nestedFields);
									objectValue[newKey] = newObject;
									onUpdate(tracker);

									// Create the DOM elements for the new item
									const itemWrapper = document.createElement("div");
									itemWrapper.className = "tracker-editor-field";

									const keyLabel = document.createElement("label");
									keyLabel.className = "tracker-editor-label";
									keyLabel.textContent = `${newKey}: `;
									itemWrapper.appendChild(keyLabel);

									// Remove button for the new item
									const removeButton = document.createElement("button");
									removeButton.className = "menu_button interactable";
									removeButton.textContent = "Remove";
									removeButton.addEventListener("click", () => {
										delete objectValue[newKey];
										onUpdate(tracker);
										itemWrapper.remove(); // Remove the DOM element
									});
									itemWrapper.appendChild(removeButton);

									createEditorFields(newObject, fieldSchema.nestedFields, itemWrapper);

									// Insert the new item before the Add Item button
									nestedFields.insertBefore(itemWrapper, addButton);
								}
							}
						});

						nestedFields.appendChild(addButton);
						wrapper.appendChild(nestedFields);
						break;
					}
					case this.FIELD_TYPES.FOR_EACH_ARRAY: {
						const objectValue = value || {};
						object[fieldSchema.name] = objectValue;

						const nestedFields = document.createElement("div");
						nestedFields.className = "tracker-editor-nested";

						const nestedFieldValues = Object.values(fieldSchema.nestedFields);
						const singleStringField = nestedFieldValues.length === 1 && nestedFieldValues[0].type === this.FIELD_TYPES.STRING;

						const createDefaultValues = (schema) => {
							const obj = {};
							for (const nestedField of Object.values(schema)) {
								switch (nestedField.type) {
									case this.FIELD_TYPES.STRING:
										obj[nestedField.name] = nestedField.defaultValue || "";
										break;
									case this.FIELD_TYPES.ARRAY:
										obj[nestedField.name] = nestedField.defaultValue || [];
										break;
									case this.FIELD_TYPES.OBJECT:
										obj[nestedField.name] = createDefaultValues(nestedField.nestedFields);
										break;
									default:
										obj[nestedField.name] = nestedField.defaultValue || "";
								}
							}
							return obj;
						};

						const createDefaultArrayItem = () => {
							if (singleStringField) {
								return "";
							} else {
								return createDefaultValues(fieldSchema.nestedFields);
							}
						};

						Object.entries(objectValue).forEach(([nestedKey, arrayValue]) => {
							if (!Array.isArray(arrayValue)) {
								arrayValue = [];
								objectValue[nestedKey] = arrayValue;
							}

							const itemWrapper = document.createElement("div");
							itemWrapper.className = "tracker-editor-field";

							const keyLabel = document.createElement("label");
							keyLabel.className = "tracker-editor-label";
							keyLabel.textContent = `${nestedKey}: `;
							itemWrapper.appendChild(keyLabel);

							const removeKeyButton = document.createElement("button");
							removeKeyButton.className = "menu_button interactable";
							removeKeyButton.textContent = "Remove Key";
							removeKeyButton.addEventListener("click", () => {
								delete objectValue[nestedKey];
								onUpdate(tracker);
								itemWrapper.remove();
							});
							itemWrapper.appendChild(removeKeyButton);

							const arrayContainer = document.createElement("div");
							arrayContainer.className = "tracker-editor-nested";

							arrayValue.forEach((arrItem, arrIndex) => {
								const arrItemWrapper = document.createElement("div");
								arrItemWrapper.className = "tracker-editor-field";

								const arrItemLabel = document.createElement("span");
								arrItemLabel.className = "tracker-editor-label";
								arrItemLabel.textContent = `[${arrIndex}]: `;
								arrItemWrapper.appendChild(arrItemLabel);

								if (singleStringField) {
									// Just a textarea for a single string
									const textarea = createAutoResizingTextarea(arrItem, (newVal) => {
										arrayValue[arrIndex] = newVal;
										onUpdate(tracker);
									});
									arrItemWrapper.appendChild(textarea);
								} else {
									// Multiple fields (array of objects)
									if (typeof arrItem !== "object" || arrItem === null) {
										arrItem = createDefaultArrayItem();
										arrayValue[arrIndex] = arrItem;
									}
									const arrItemFields = document.createElement("div");
									arrItemFields.className = "tracker-editor-nested";
									createEditorFields(arrItem, fieldSchema.nestedFields, arrItemFields);
									arrItemWrapper.appendChild(arrItemFields);
								}

								const removeItemButton = document.createElement("button");
								removeItemButton.className = "menu_button interactable";
								removeItemButton.textContent = "Remove Item";
								removeItemButton.addEventListener("click", () => {
									arrayValue.splice(arrIndex, 1);
									onUpdate(tracker);
									root.replaceWith(this.renderEditorView(tracker, onUpdate));
								});
								arrItemWrapper.appendChild(removeItemButton);

								arrayContainer.appendChild(arrItemWrapper);
							});

							const addItemButton = document.createElement("button");
							addItemButton.className = "menu_button interactable";
							addItemButton.textContent = "Add Item";
							addItemButton.addEventListener("click", () => {
								arrayValue.push(createDefaultArrayItem());
								onUpdate(tracker);
								root.replaceWith(this.renderEditorView(tracker, onUpdate));
							});
							arrayContainer.appendChild(addItemButton);

							itemWrapper.appendChild(arrayContainer);
							nestedFields.appendChild(itemWrapper);
						});

						// Add Key button
						const addKeyButton = document.createElement("button");
						addKeyButton.className = "menu_button interactable";
						addKeyButton.textContent = "Add Key";
						addKeyButton.addEventListener("click", () => {
							const newKey = prompt("Enter key for new array:");
							if (newKey) {
								if (Object.prototype.hasOwnProperty.call(objectValue, newKey)) {
									alert("A key with that name already exists.");
								} else {
									objectValue[newKey] = [];
									onUpdate(tracker);
									root.replaceWith(this.renderEditorView(tracker, onUpdate));
								}
							}
						});

						nestedFields.appendChild(addKeyButton);
						wrapper.appendChild(nestedFields);
						break;
					}
					default: {
						// Default fields (e.g., STRING)
						const textarea = createAutoResizingTextarea(value, (newVal) => {
							object[fieldSchema.name] = newVal;
							onUpdate(tracker);
						});
						wrapper.appendChild(textarea);
						break;
					}
				}

				parentElement.appendChild(wrapper);
			}
		};

		createEditorFields(tracker, this.schema, root);

		// Handle _extraFields
		if (tracker._extraFields !== undefined) {
			const extraFieldsWrapper = document.createElement("div");
			extraFieldsWrapper.className = "tracker-editor-field";

			const extraLabel = document.createElement("label");
			extraLabel.className = "tracker-editor-label";
			extraLabel.textContent = "_extraFields: ";
			extraFieldsWrapper.appendChild(extraLabel);

			// Ensure _extraFields is stringified for display
			let displayValue = typeof tracker._extraFields === "object" ? JSON.stringify(tracker._extraFields, null, 2) : tracker._extraFields;

			const extraTextarea = document.createElement("textarea");
			extraTextarea.className = "tracker-editor-textarea";
			extraTextarea.value = displayValue;

			const adjustTextareaHeight = (textarea) => {
				textarea.style.height = "auto";
				textarea.style.height = textarea.scrollHeight + "px";
			};

			requestAnimationFrame(() => adjustTextareaHeight(extraTextarea));

			extraTextarea.addEventListener("input", (event) => {
				const content = event.target.value.trim();
				if (content === "") {
					delete tracker._extraFields;
				} else {
					try {
						tracker._extraFields = JSON.parse(content);
					} catch (e) {
						tracker._extraFields = content; // Save as string if parsing fails
					}
				}
				onUpdate(tracker);
				adjustTextareaHeight(event.target); // Adjust height after input
			});

			extraFieldsWrapper.appendChild(extraTextarea);
			root.appendChild(extraFieldsWrapper);
		}

		return root;
	}

	/**
	 * Renders the tracker data using a custom template.
	 * Supports nested loops and conditionals.
	 * @param {object} tracker - The tracker data object.
	 * @param {string} template - The custom template string.
	 * @returns {HTMLElement} - The root element containing the rendered template.
	 */
	renderFromTemplate(tracker, template) {
		const root = document.createElement("div");
		root.className = "tracker-template-container";

		const renderedHTML = this.renderTemplateString(template, tracker);
		root.innerHTML = renderedHTML;
		return root.outerHTML;
	}

	/**
	 * Processes the template string and replaces placeholders with tracker data.
	 * Supports nested loops and conditionals.
	 * @param {string} template - The template string.
	 * @param {object} data - The tracker data object.
	 * @returns {string} - The processed template string.
	 */
	renderTemplateString(template, data) {
		const tokens = this.tokenizeTemplate(template);
		return this.processTokens(tokens, data);
	}

	/**
	 * Tokenizes the template string into an array of tokens.
	 * @param {string} template - The template string.
	 * @returns {Array} - The array of tokens.
	 */
	tokenizeTemplate(template) {
		const tokens = [];
		const regex = /{{\s*(\/?)\s*(#?)\s*([\w.]+)\s*(.*?)\s*}}/g;
		let cursor = 0;
		let match;

		while ((match = regex.exec(template)) !== null) {
			const index = match.index;

			// Add text tokens between placeholders.
			if (index > cursor) {
				tokens.push({
					type: "text",
					value: template.slice(cursor, index),
				});
			}

			const [fullMatch, closingSlash, hash, tag, params] = match;

			if (closingSlash) {
				// End tag token (e.g., {{/if}})
				tokens.push({
					type: "end",
					tag: tag.trim(),
				});
			} else if (hash) {
				// Start tag token (e.g., {{#if condition}})
				tokens.push({
					type: "start",
					tag: tag.trim(),
					params: params.trim(),
				});
			} else {
				// Variable token (e.g., {{variable}})
				tokens.push({
					type: "variable",
					value: tag.trim(),
				});
			}

			cursor = index + fullMatch.length;
		}

		// Add any remaining text after the last placeholder.
		if (cursor < template.length) {
			tokens.push({
				type: "text",
				value: template.slice(cursor),
			});
		}

		return tokens;
	}

	/**
	 * Processes the tokens recursively to generate the final string.
	 * @param {Array} tokens - The array of tokens.
	 * @param {object} data - The tracker data object.
	 * @param {object} [context={}] - The context object for scope management.
	 * @returns {string} - The processed string.
	 */
	processTokens(tokens, data, context = {}) {
		let result = "";

		while (tokens.length > 0) {
			const token = tokens.shift();

			if (token.type === "text") {
				// Append plain text to the result.
				result += token.value;
			} else if (token.type === "variable") {
				// Replace variable placeholders with actual data.
				let value = this.getValue(token.value, data, context);

				// Handle objects in variable tokens
				if (typeof value === "object" && value !== null) {
					if ("name" in value) {
						value = value.name;
					} else if ("id" in value) {
						value = value.id;
					} else {
						value = context._key; // Fallback to the parent key
					}
					// These bypass getValue's sanitization and come straight from model output.
					value = this.escapeHtml(value);
				}
				result += value !== undefined ? value : "";
			} else if (token.type === "start") {
				if (token.tag === "if") {
					// Handle conditional blocks.
					const condition = token.params;
					const [innerTokens, remainingTokens] = this.extractInnerTokens(tokens, "if");
					const conditionMet = this.evaluateCondition(condition, data, context);

					if (conditionMet) {
						result += this.processTokens(innerTokens, data, context);
					}

					tokens = remainingTokens;
				} else if (token.tag === "foreach") {
					// Handle loop blocks.
					const params = token.params.split(/\s+/);
					const collectionName = params[0];
					const itemName = params[1];

					const collection = this.getValue(collectionName, data, context);

					if (collection && typeof collection === "object") {
						const [innerTokens, remainingTokens] = this.extractInnerTokens(tokens, "foreach");

						// Normalize plain arrays to [key, value] pairs like Object.entries — destructuring
						// a bare array of strings used to split each string into its first two characters.
						const items = Array.isArray(collection) ? collection.map((value, i) => [i, value]) : Object.entries(collection);

						items.forEach(([key, item], index) => {
							const newContext = {
								...context,
								[itemName]: item,
								index,
								_key: key,
							};
							result += this.processTokens([...innerTokens], data, newContext);
						});

						tokens = remainingTokens;
					} else {
						// Skip the foreach block if the collection is empty or not an object.
						const [, remainingTokens] = this.extractInnerTokens(tokens, "foreach");
						tokens = remainingTokens;
					}
				} else if (token.tag === "join") {
					// Handle join operations.
					const params = token.params.match(/^(['"])(.*?)\1\s+(.+)$/);
					if (params) {
						const separator = params[2];
						const arrayName = params[3];
						const array = this.getValue(arrayName, data, context);

						if (Array.isArray(array)) {
							result += array.map((v) => this.escapeHtml(v)).join(separator);
						} else if (array && typeof array === "object" && !Array.isArray(array)) {
							result += Object.values(array).map((v) => this.escapeHtml(v)).join(separator);
						}
					}
					// 'join' does not require an end tag.
				}
			} else if (token.type === "end") {
				// End tokens are handled during the extraction of inner tokens.
				continue;
			}
		}

		return result;
	}

	/**
	 * Extracts inner tokens until the matching end tag is found.
	 * @param {Array} tokens - The array of tokens.
	 * @param {string} tagName - The tag name to match.
	 * @returns {Array} - An array containing inner tokens and remaining tokens.
	 * @throws {Error} - Throws an error if the end tag is not found.
	 */
	extractInnerTokens(tokens, tagName) {
		let nested = 1;
		const innerTokens = [];

		while (tokens.length > 0) {
			const token = tokens.shift();

			if (token.type === "start" && token.tag === tagName) {
				nested++;
			} else if (token.type === "end" && token.tag === tagName) {
				nested--;
				if (nested === 0) {
					return [innerTokens, tokens];
				}
			}
			innerTokens.push(token);
		}

		throw new Error(`Unmatched {{#${tagName}}}`);
	}

	/**
	 * Retrieves the value of a variable from data or context.
	 * Supports string operations.
	 * @param {string} variable - The variable name (can be nested using dot notation).
	 * @param {object} data - The tracker data object.
	 * @param {object} context - The context object.
	 * @returns {*} - The value of the variable or undefined if not found.
	 */
	getValue(variable, data, context) {
		const [path, ...operations] = variable.split("|").map((part) => part.trim());
		const parts = path.split(".");
		let value = Object.hasOwn(context, parts[0]) ? context[parts[0]] : data[parts[0]];

		for (let i = 1; i < parts.length; i++) {
			if (value && typeof value === "object" && parts[i] in value) {
				value = value[parts[i]];
			} else {
				return undefined;
			}
		}

		// Apply string operations if any
		if (typeof value === "string") {
			if (operations.length > 0) {
				value = this.applyStringOperations(value, operations);
			}
			// Sanitize for HTML
			value = this.escapeHtml(value);
		}

		return value;
	}

	/**
	 * Escapes HTML angle brackets in string values (tracker data is model output).
	 * Non-string values pass through unchanged.
	 * @param {*} value - The value to escape.
	 * @returns {*} - The escaped value.
	 */
	escapeHtml(value) {
		if (typeof value !== "string") return value;
		return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}

	/**
	 * Applies string operations to a value.
	 * @param {string} value - The string value.
	 * @param {Array} operations - Array of operations to apply.
	 * @returns {string} - The transformed string.
	 */
	applyStringOperations(value, operations) {
		operations.forEach((operation) => {
			if (operation === "toUpperCase()") {
				value = value.toUpperCase();
			} else if (operation === "toLowerCase()") {
				value = value.toLowerCase();
			} else if (operation === "trim()") {
				value = value.trim();
			} else if (operation.startsWith("substring(")) {
				const args = operation.match(/substring\((\d+),\s*(\d+)\)/);
				if (args) {
					const start = parseInt(args[1], 10);
					const end = parseInt(args[2], 10);
					value = value.substring(start, end);
				}
			}
			// Add more string operations as needed
		});
		return value;
	}

	/**
	 * Evaluates a condition for the {{#if}} tag.
	 * Supports comparison operators.
	 * @param {string} condition - The condition string.
	 * @param {object} data - The tracker data object.
	 * @param {object} context - The context object.
	 * @returns {boolean} - The result of the condition evaluation.
	 */
	evaluateCondition(condition, data, context) {
		// Two-character operators must be checked first: ">" would otherwise match inside ">=",
		// splitting "a >= b" into "a" and "= b" and making >=/<= unusable.
		const operators = ["==", "!=", ">=", "<=", ">", "<"];
		let operatorFound = null;

		for (const op of operators) {
			if (condition.includes(op)) {
				operatorFound = op;
				break;
			}
		}

		if (operatorFound) {
			const [left, right] = condition.split(operatorFound).map((part) => part.trim());
			const leftValue = this.getValue(left, data, context);
			const rightValue = right.replace(/^['"]|['"]$/g, ""); // Remove quotes

			switch (operatorFound) {
				case "==":
					return leftValue == rightValue;
				case "!=":
					return leftValue != rightValue;
				case ">":
					return leftValue > rightValue;
				case "<":
					return leftValue < rightValue;
				case ">=":
					return leftValue >= rightValue;
				case "<=":
					return leftValue <= rightValue;
				default:
					return false;
			}
		} else {
			// If no operator, check truthiness
			const value = this.getValue(condition, data, context);
			return !!value;
		}
	}
}
