import { debug } from "../../../lib/utils.js";

/**
 * Generates HTML templates for tracker data based on field definitions
 */
export class TrackerTemplateGenerator {
    constructor() {
        this.indentSize = 4; // Number of spaces for indentation
    }

    /**
     * Normalizes field type from constants to user-friendly names
     * @param {string} fieldType - The field type (could be constant or user-friendly name)
     * @returns {string} - Normalized field type
     */
    normalizeFieldType(fieldType) {
        const typeMapping = {
            'STRING': 'String',
            'ARRAY': 'Array',
            'OBJECT': 'Object',
            'FOR_EACH_OBJECT': 'For Each Object',
            'FOR_EACH_ARRAY': 'For Each Array',
            'ARRAY_OBJECT': 'Array Object'
        };

        // Return mapped value if it exists, otherwise return the original (in case it's already normalized)
        return typeMapping[fieldType] || fieldType;
    }

    /**
     * Generates a template following the expected structure from the default
     * @param {Object} trackerDef - The tracker definition object
     * @returns {string} - Generated HTML template with expected structure
     */
    generateTableTemplate(trackerDef) {
        debug('TrackerTemplateGenerator: Starting table template generation with trackerDef:', trackerDef);

        if (!trackerDef || Object.keys(trackerDef).length === 0) {
            debug('TrackerTemplateGenerator: No tracker fields defined for table template');
            return '<div class="tracker_default_mes_template">\n    <p>No tracker fields defined</p>\n</div>';
        }

        const indent = '    ';
        const parts = [];

        // Classify fields into categories
        const topLevelFields = []; // Basic string fields that go in the first table
        const trackerSectionFields = []; // Array/Object fields that go in the tracker details section
        let charactersField = null; // Special handling for Characters field
        let charactersName = 'Characters'; // Default name for characters field

        for (const [fieldKey, fieldData] of Object.entries(trackerDef)) {
            if (!fieldData || typeof fieldData !== 'object') {
                continue;
            }

            const fieldName = fieldData.name || fieldKey;
            const fieldType = this.normalizeFieldType(fieldData.type);
            const isNested = fieldData.nestedFields && Object.keys(fieldData.nestedFields).length > 0;

            debug(`TrackerTemplateGenerator: Processing field ${fieldKey}: name="${fieldName}", type="${fieldType}", nested=${isNested}`);

            // Check if this is the Characters field (FOR_EACH_OBJECT type with nested fields)
            if (fieldType === 'For Each Object' && isNested) {
                charactersField = fieldData;
                charactersName = fieldName;
                debug(`TrackerTemplateGenerator: Found Characters field: ${fieldName}`);
            }
            // Basic string fields go to top-level table
            else if (fieldType === 'String' && !isNested) {
                topLevelFields.push([fieldName, fieldKey]);
            }
            // Array fields and array objects go to tracker section
            else if (fieldType === 'Array' || fieldType === 'Array Object') {
                trackerSectionFields.push([fieldName, fieldKey, 'join']);
            }
            // Other complex fields
            else {
                trackerSectionFields.push([fieldName, fieldKey, 'complex']);
            }
        }

        debug('TrackerTemplateGenerator: Top-level fields:', topLevelFields);
        debug('TrackerTemplateGenerator: Tracker section fields:', trackerSectionFields);
        debug('TrackerTemplateGenerator: Characters field found:', !!charactersField);

        // Generate top-level table for basic string fields
        if (topLevelFields.length > 0) {
            parts.push(`${indent}<table>`);
            for (const [fieldName, fieldKey] of topLevelFields) {
                parts.push(`${indent}    <tr>`);
                parts.push(`${indent}        <td>${fieldName}:</td>`);
                parts.push(`${indent}        <td>{{${fieldName}}}</td>`);
                parts.push(`${indent}    </tr>`);
            }
            parts.push(`${indent}</table>`);
        }

        // Generate tracker details section if we have tracker fields or characters
        if (trackerSectionFields.length > 0 || charactersField) {
            parts.push(`${indent}<details>`);
            parts.push(`${indent}    <summary><span>Tracker</span></summary>`);

            // Generate table for tracker section fields
            if (trackerSectionFields.length > 0) {
                parts.push(`${indent}    <table>`);
                for (const [fieldName, fieldKey, type] of trackerSectionFields) {
                    parts.push(`${indent}        <tr>`);
                    // Special handling for CharactersPresent -> "Present:"
                    const displayName = fieldName === 'CharactersPresent' ? 'Present' : fieldName;
                    parts.push(`${indent}            <td>${displayName}:</td>`);
                    parts.push(`${indent}            <td>{{#join "; " ${fieldName}}}</td>`);
                    parts.push(`${indent}        </tr>`);
                }
                parts.push(`${indent}    </table>`);
            }

            // Generate characters section if we have a characters field
            if (charactersField) {
                parts.push(`${indent}    <div class="mes_tracker_characters">`);
                parts.push(`${indent}        {{#foreach ${charactersName} character}}`);
                parts.push(`${indent}        <hr>`);
                parts.push(`${indent}        <strong>{{character}}:</strong><br />`);
                parts.push(`${indent}        <table>`);

                // Generate character nested fields
                for (const [nestedKey, nestedData] of Object.entries(charactersField.nestedFields)) {
                    if (!nestedData || typeof nestedData !== 'object') continue;
                    const nestedName = nestedData.name || nestedKey;

                    // Special display name handling
                    let displayName = nestedName;
                    if (nestedName === 'StateOfDress') {
                        displayName = 'State';
                    } else if (nestedName === 'PostureAndInteraction') {
                        displayName = 'Position';
                    }

                    parts.push(`${indent}            <tr>`);
                    parts.push(`${indent}                <td>${displayName}:</td>`);
                    parts.push(`${indent}                <td>{{character.${nestedName}}}</td>`);
                    parts.push(`${indent}            </tr>`);
                }

                parts.push(`${indent}        </table>`);
                parts.push(`${indent}        {{/foreach}}`);
                parts.push(`${indent}    </div>`);
            }

            parts.push(`${indent}</details>`);
        }

        // Assemble final template
        const content = parts.join('\n');
        const template = `<div class="tracker_default_mes_template">\n${content}\n</div>\n<hr>`;

        debug('TrackerTemplateGenerator: Generated template:', template);

        return template;
    }
}
