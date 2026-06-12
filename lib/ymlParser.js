import { yaml } from "../../../../../lib.js";

// Thin wrappers around SillyTavern's bundled `yaml` package (the real YAML implementation).
//
// The previous hand-rolled parser silently corrupted realistic LLM output: inline-array items
// containing ", " split into separate items on every round-trip, unquoted values containing '#'
// were truncated as comments, numeric-looking strings ("18") and empty strings lost their type
// (Number("") === 0), quotes were never escaped on serialize, and only 2-space indentation parsed.

/**
 * Parses a tracker block into a plain object. Accepts YAML, or JSON when the Tracker Format
 * setting is JSON (the historical JSON-passthrough behavior).
 *
 * NOTE: despite the legacy name, this returns the parsed OBJECT. Callers that need JSON text
 * should JSON.stringify the result themselves.
 *
 * @param {string} input - The YAML (or JSON) string to parse.
 * @returns {object} - The parsed tracker object.
 * @throws {TypeError|Error} If the input is not a string or does not parse to an object/array.
 */
export function yamlToJSON(input) {
	if (typeof input !== "string") {
		throw new TypeError("yamlToJSON expects a string input");
	}

	const trimmed = input.trim();

	// JSON passthrough: tracker format may be JSON. Try native JSON first for exactness; on
	// failure fall through to the YAML parser (YAML is a superset of JSON anyway).
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		try {
			return JSON.parse(trimmed);
		} catch (e) {
			// Not valid JSON after all; let the YAML parser have a go.
		}
	}

	const parsed = yaml.parse(trimmed);

	if (parsed === null || typeof parsed !== "object") {
		// A tracker is always a mapping; a scalar result means the input wasn't a tracker block.
		throw new Error("YAML input did not parse to an object");
	}

	return parsed;
}

/**
 * Serializes a tracker object to YAML.
 * @param {object} json - The object to serialize.
 * @returns {string} - The resulting YAML string.
 */
export function jsonToYAML(json) {
	if (json === null || json === undefined) return "";
	return yaml.stringify(json);
}
