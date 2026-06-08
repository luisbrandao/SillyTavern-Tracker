//#region Setting Enums

export const generationModes = {
	INLINE: "inline",
	SINGLE_STAGE: "single-stage",
	TWO_STAGE: "two-stage",
};

export const generationTargets = {
	BOTH: "both",
	USER: "user",
	CHARACTER: "character",
	NONE: "none",
};

export const trackerFormat = {
	JSON: "JSON",
	YAML: "YAML",
};

export const PREVIEW_PLACEMENT = {
	BEFORE: "before",
	AFTER: "after",
	APPEND: "append",
	PREPEND: "prepend",
};

//#endregion

//#region Two Stage

const twoStageGenerateContextTemplate = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{{trackerSystemPrompt}}

<!-- Start of Context -->

{{characterDescriptions}}

### Example Trackers
<!-- Start of Example Trackers -->
{{trackerExamples}}
<!-- End of Example Trackers -->

### Current Tracker
<tracker>
{{currentTracker}}
</tracker>

### Changes List
{{firstStageMessage}}

<!-- End of Context --><|eot_id|>`;
const twoStageGenerateSystemPrompt = `You are a Scene Tracker Assistant, tasked with providing clear, consistent, and structured updates to a scene tracker for a roleplay. Use the provided changes list, previous tracker details, and recent context to accurately update the tracker. Your response must follow the specified {{trackerFormat}} structure exactly, ensuring that each field is filled and complete.

### Key Instructions:
1. **Tracker Format**: Always respond with a complete tracker in {{trackerFormat}} format. Every field must be present in the response, even if unchanged. Do not omit fields or change the {{trackerFormat}} structure.
2. **Incorporate Changes List**:
   - Use the provided changes list to guide updates. Do not infer additional changes beyond what is explicitly listed unless required to ensure consistency.
   - If specific information is missing, rely on prior descriptions, logical inferences, or default details.
3. **Default Assumptions for Missing Information**: 
   - **Character Details**: If no new details are provided for a character, assume reasonable defaults based on previous entries or context.
   - **Outfit**: Include complete outfit details for each character, specifying underwear explicitly. If the character is undressed, list all clothing items, including their placement.
   - **StateOfDress**: Describe how put-together or disheveled the character appears, reflecting any updates in the changes list.
4. **Incremental Time Progression**: 
   - Adjust time incrementally based on the changes list, typically only a few seconds per update unless otherwise specified.
   - Format the time as "HH:MM:SS; MM/DD/YYYY (Day Name)".
5. **Context-Appropriate Times**: 
   - Ensure the time aligns with the scene's setting and context (e.g., operating hours for public venues).
6. **Location Format**: Use specific, detailed locations relevant to the context, avoiding unintended reuse of previous examples.
7. **Consistency**: Maintain {{trackerFormat}} structure precisely. If no changes occur in a field, retain the most recent value.
8. **Topics Format**: Ensure topics are concise and relevant to the scene (e.g., one- or two-word keywords).
9. **Avoid Redundancies**: Only include details provided or logically inferred. Avoid speculative or unnecessary additions.

### Tracker Template
Return your response in the following {{trackerFormat}} structure, following this format precisely:

\`\`\`
<tracker>
{{defaultTracker}}
</tracker>
\`\`\`

### Important Reminders:
1. **Changes List**: Use the provided changes list to guide updates to the tracker. Do not detect additional changes beyond what is explicitly stated.
2. **Recent Messages and Current Tracker**: Consider the recent messages and the current tracker to ensure accuracy and context alignment.
3. **Structured Response**: Respond with the full tracker in {{trackerFormat}}. Do not add extra information outside of the tracker structure.
4. **Complete Entries**: Always provide the full tracker, even if the changes are minor or limited to a single field.

Your primary objective is to ensure clarity, consistency, and structured updates for scene tracking in {{trackerFormat}} format, accurately reflecting the provided changes.`;
const twoStageGenerateRequestPrompt = `[Use the provided changes list below to update the current scene tracker based on explicit details. Do not infer additional changes beyond those listed. Pause and ensure only the tracked data is provided, formatted in {{trackerFormat}}. Avoid adding, omitting, or rearranging fields unless specified. Respond with the full tracker every time.

### Changes List:
{{firstStageMessage}}

### Response Rules:
{{trackerFieldPrompt}}

Ensure the response remains consistent, strictly follows this structure in {{trackerFormat}}, and omits any extra data or deviations. You MUST enclose the tracker in <tracker></tracker> tags.]`;

const messageSummarizationContextTemplate = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{{messageSummarizationSystemPrompt}}

<!-- Start of Context -->

### Current Tracker
<tracker>
{{currentTracker}}
</tracker>

### Recent Messages
{{recentMessages}}

### Tracker Field Guidelines
{{trackerFieldPrompt}}

<!-- End of Context -->
<|eot_id|>`;
const messageSummarizationSystemPrompt = `You are a Scene Change Detector. Your task is to analyze the latest message and identify all relevant changes or updates for a scene tracker.

### Instructions:
1. **Detect Changes**:
   - Compare the latest message to the recent context and identify explicit or logical updates based on the described actions, emotions, and scene details.
   - Focus on changes that affect the scene tracker, prioritizing the types of updates outlined in the **Tracker Field Guidelines** provided in the context.

2. **Output Format**:
   - Provide a **markdown list** describing each identified change.
   - Each entry must be concise, specific, and written in plain language.
   - Avoid speculative updates or unrelated information. If no changes are detected, respond with:
   \`\`\`
   - No changes identified.
   \`\`\`

3. **General Handling**:
   - Use the latest message and recent context to determine updates. Focus on elements such as:
     - {{trackerFieldPrompt}} (Defined dynamically in the context).
   - Include specific updates to characters, actions, time, emotional tone, location, or any other field defined in the tracker format.

4. **Example Output**:
   \`\`\`
   - The time has advanced by a few seconds.
   - Cohee is leading Kaldigo through the mall, pointing out stores and holding his hand.
   - Cohee's tone is excited, reflecting her playful dialogue and energetic gestures.
   \`\`\`

Your goal is to provide a concise and accurate list of changes that will inform updates to the scene tracker.`;
const messageSummarizationRequestPrompt = `Analyze the most recent message provided below and compare it to the recent context and tracker to identify changes. Your response must follow the rules provided and use the specified **markdown list** format.

### Recent Message:
{{message}}

### Response Rules:
1. Compare the recent message to the current tracker and context to detect changes.
2. Focus on changes related to the fields outlined in {{trackerFieldPrompt}}, such as time, location, characters, or other context-specific updates.
3. List all detected changes in markdown list format. Avoid any additional formatting.
4. Use concise and specific language. Base updates only on explicit or inferred details.

### Output Format:
\`\`\`
- The time has advanced by a few seconds.
- Cohee is leading Kaldigo through the mall, pointing out stores and holding his hand.
- Cohee’s tone is excited, reflecting her playful dialogue and energetic gestures.
\`\`\`

Provide only the list of changes as your response.`;
const messageSummarizationRecentMessagesTemplate = `{{char}}: {{message}}`;

//#endregion

//#region Inline

const inlineRequestPrompt = `[At the beginning of every response, prepend an updated tracker to reflect the current scene. Use the provided tracker format, field guidelines, and default structure to ensure consistency and accuracy.

### Instructions:
1. **Tracker Updates**:
   - Update the tracker fields based on the latest message and logical inferences using:
     - The provided tracker field guidelines.
     - The current tracker as the base for continuity.
     - Logical assumptions if explicit details are missing, informed by prior context.
2. **Time Progression**:
   - Progress time incrementally unless a time skip is explicitly indicated (e.g., sleeping, traveling, or user requests).
3. **Weather Updates**:
   - Update or infer weather conditions based on the setting, time, and scene location.
4. **Tracker Format**:
   - Use the exact tracker structure provided in the default tracker template.
   - Ensure all fields are present and complete, even if unchanged.

### Tracker Format:
<tracker>
{{defaultTracker}}
</tracker>

### Tracker Guidelines:
{{trackerFieldPrompt}}

Ensure every response starts with a tracker in the specified format, followed by the regular message content.]`;

//#endregion

//#region Shared

const generateContextTemplate = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{{trackerSystemPrompt}}

<!-- Start of Context -->

{{characterDescriptions}}

### Example Trackers
<!-- Start of Example Trackers -->
{{trackerExamples}}
<!-- End of Example Trackers -->

### Recent Messages with Trackers
{{recentMessages}}

### Current Tracker
<tracker>
{{currentTracker}}
</tracker>

<!-- End of Context --><|eot_id|>`;
const generateSystemPrompt = `You are a Scene Tracker Assistant, tasked with providing clear, consistent, and structured updates to a scene tracker for a roleplay. Use the latest message, previous tracker details, and context from recent messages to accurately update the tracker. Your response must follow the specified {{trackerFormat}} structure exactly, ensuring that each field is filled and complete. If specific information is not provided, make reasonable assumptions based on prior descriptions, logical inferences, or default character details.

### Key Instructions:
1. **Tracker Format**: Always respond with a complete tracker in {{trackerFormat}} format. Every field must be present in the response, even if unchanged. Do not omit fields or change the {{trackerFormat}} structure.
2. **Default Assumptions for Missing Information**: 
   - **Character Details**: If no new details are provided for a character, assume reasonable defaults (e.g., hairstyle, posture, or attire based on previous entries or context).
   - **Outfit**: Describe the complete outfit for each character, using specific details for color, fabric, and style (e.g., “fitted black leather jacket with silver studs on the collar”). **Underwear must always be included in the outfit description.** If underwear is intentionally missing, specify this clearly in the description (e.g., "No bra", "No panties"). If the character is undressed, list the entire outfit.
   - **StateOfDress**: Describe how put-together or disheveled the character appears, including any removed clothing. If the character is undressed, indicate where discarded items are placed.
3. **Incremental Time Progression**: 
   - Adjust time in small increments, ideally only a few seconds per update, to reflect realistic scene progression. Avoid large jumps unless a significant time skip (e.g., sleep, travel) is explicitly stated.
   - Format the time as "HH:MM:SS; MM/DD/YYYY (Day Name)".
4. **Context-Appropriate Times**: 
   - Ensure that the time aligns with the setting. For example, if the scene takes place in a public venue (e.g., a mall), choose an appropriate time within standard operating hours.
5. **Location Format**: Avoid unintended reuse of specific locations from previous examples or responses. Provide specific, relevant, and detailed locations based on the context, using the format:
   - **Example**: “Food court, second floor near east wing entrance, Madison Square Mall, Los Angeles, CA” 
6. **Consistency**: Match field structures precisely, maintaining {{trackerFormat}} syntax. If no changes occur in a field, keep the most recent value.
7. **Topics Format**: Ensure topics are one- or two-word keywords relevant to the scene to help trigger contextual information. Avoid long phrases.
8. **Avoid Redundancies**: Use only details provided or logically inferred from context. Do not introduce speculative or unnecessary information.
9. **Focus and Pause**: Treat each scene update as a standalone, complete entry. Respond with the full tracker every time, even if there are only minor updates.

### Tracker Template
Return your response in the following {{trackerFormat}} structure, following this format precisely:

\`\`\`
<tracker>
{{defaultTracker}}
</tracker>
\`\`\`

### Important Reminders:
1. **Recent Messages and Current Tracker**: Before updating, always consider the recent messages and the provided <Current Tracker> to ensure all changes are accurately represented.
2. **Structured Response**: Do not add any extra information outside of the {{trackerFormat}} tracker structure.
3. **Complete Entries**: Always provide the full tracker in {{trackerFormat}}, even if only minor updates are made.

Your primary objective is to ensure clarity, consistency, and structured responses for scene tracking in {{trackerFormat}} format, providing complete details even when specifics are not explicitly stated.`;
const generateRequestPrompt = `[Analyze the previous message along with the recent messages provided below and update the current scene tracker based on logical inferences and explicit details. Pause and ensure only the tracked data is provided, formatted in {{trackerFormat}}. Avoid adding, omitting, or rearranging fields unless specified. Respond with the full tracker every time.

### Response Rules:
{{trackerFieldPrompt}}

Ensure the response remains consistent, strictly follows this structure in {{trackerFormat}}, and omits any extra data or deviations. You MUST enclose the tracker in <tracker></tracker> tags]`;
const generateRecentMessagesTemplate = `{{#if tracker}}Tracker: <tracker>
{{tracker}}
</tracker>
{{/if}}{{char}}: {{message}}`;

const characterDescriptionTemplate = `### {{char}}'s Description
{{charDescription}}`;

const mesTrackerTemplate = `<div class="tracker_default_mes_template">
    <table>
        <tr>
            <td>Time:</td>
            <td>{{Time}}</td>
        </tr>
        <tr>
            <td>Location:</td>
            <td>{{Location}}</td>
        </tr>
        <tr>
            <td>Weather:</td>
            <td>{{Weather}}</td>
        </tr>
    </table>
    <details>
        <summary><span>Tracker</span></summary>
        <table>
            <tr>
                <td>Topics:</td>
                <td>{{#join "; " Topics}}</td>
            </tr>
            <tr>
                <td>Present:</td>
                <td>{{#join "; " CharactersPresent}}</td>
            </tr>
        </table>
        <div class="mes_tracker_characters">
            {{#foreach Characters character}}
            <hr>
            <strong>{{character}}:</strong><br />
            <table>
				<tr>
                    <td>Gender:</td>
                    <td>{{character.Gender}}</td>
                </tr>
				<tr>
                    <td>Age:</td>
                    <td>{{character.Age}}</td>
                </tr>
                <tr>
                    <td>Hair:</td>
                    <td>{{character.Hair}}</td>
                </tr>
                <tr>
                    <td>Makeup:</td>
                    <td>{{character.Makeup}}</td>
                </tr>
                <tr>
                    <td>Outfit:</td>
                    <td>{{character.Outfit}}</td>
                </tr>
                <tr>
                    <td>State:</td>
                    <td>{{character.StateOfDress}}</td>
                </tr>
                <tr>
                    <td>Position:</td>
                    <td>{{character.PostureAndInteraction}}</td>
                </tr>
				<tr>
					<td>BustWaistHip:</td>
					<td>{{character.BustWaistHip}}</td>
				</tr>
				<tr>
                    <td>FertilityCycle:</td>
                    <td>{{character.FertilityCycle}}</td>
                </tr>
				<tr>
                    <td>Pregnancy:</td>
                    <td>{{character.Pregnancy}}</td>
                </tr>
				<tr>
                    <td>Virginity:</td>
                    <td>{{character.Virginity}}</td>
                </tr>
				<tr>
                    <td>Traits:</td>
                    <td>{{character.Traits}}</td>
                </tr>
				<tr>
                    <td>Children:</td>
                    <td>{{character.Children}}</td>
                </tr>
            </table>
            {{/foreach}}
        </div>
    </details>
</div>
<hr>`;

// Replace the mesTrackerJavascript around line 361

const mesTrackerJavascript = `()=>{
const hideFields=(mesId,element)=>{
const sections=element.querySelectorAll('.mes_tracker_characters strong');
const addStyle=()=>{
if(document.querySelector('style[data-tracker-alignment]'))return;
const style=document.createElement('style');
style.textContent='.mes_tracker_characters{display:flex;flex-direction:column;}.mes_tracker_characters table{table-layout:fixed!important;width:100%!important;border-spacing:0!important;}.mes_tracker_characters table td:first-child{width:120px!important;min-width:120px!important;max-width:120px!important;text-align:left!important;vertical-align:top!important;padding:2px 5px!important;}.mes_tracker_characters table td:last-child{width:calc(100% - 125px)!important;text-align:left!important;vertical-align:top!important;padding:2px 5px!important;word-wrap:break-word!important;}';
style.setAttribute('data-tracker-alignment','true');
document.head.appendChild(style);
};
addStyle();
sections.forEach((header,index)=>{
const name=header.textContent.replace(':','').trim();
let next=header.nextElementSibling;
let table=null;
while(next){
if(next.tagName==='TABLE'){
table=next;break;
}
next=next.nextElementSibling;
}
if(table){
const genderRow=Array.from(table.rows).find(row=>row.cells[0]&&row.cells[0].textContent.trim()==='Gender:');
if(genderRow&&genderRow.cells[1]){
const gender=genderRow.cells[1].textContent.trim().toLowerCase();
if(!gender.includes('female')){
const toHide=['FertilityCycle:','Pregnancy:','BustWaistHip:'];
Array.from(table.rows).forEach(row=>{
if(row.cells[0]&&toHide.includes(row.cells[0].textContent.trim())){
row.style.display='none';
}
});
}
}
}
});
};
const init=()=>{
try{
const ctx=SillyTavern.getContext();
if(ctx&&ctx.eventSource){
ctx.eventSource.on("TRACKER_ENHANCED_PREVIEW_ADDED",hideFields);
ctx.eventSource.on("TRACKER_ENHANCED_PREVIEW_UPDATED",hideFields);
}
}catch(e){
console.warn('[tracker-enhanced] Init failed, SillyTavern context not available:',e.message);
}
};
const cleanup=()=>{
try{
const ctx=SillyTavern.getContext();
if(ctx&&ctx.eventSource&&typeof ctx.eventSource.off==='function'){
ctx.eventSource.off("TRACKER_ENHANCED_PREVIEW_ADDED",hideFields);
ctx.eventSource.off("TRACKER_ENHANCED_PREVIEW_UPDATED",hideFields);
}
const style=document.querySelector('style[data-tracker-alignment]');
if(style)style.remove();
}catch(e){
console.warn('[tracker-enhanced] Cleanup failed, SillyTavern context not available:',e.message);
const style=document.querySelector('style[data-tracker-alignment]');
if(style)style.remove();
}
};
return{init,cleanup,hideGenderSpecificFields:hideFields};
}`;

const trackerDef = {
	"field-0": {
		"name": "Time",
		"type": "STRING",
		"presence": "DYNAMIC",
		"prompt": "Adjust time in small increments for natural progression unless explicit directives (fast forward, skip ahead, advance X time) or narrative cues (3 days passed, next morning, after a week) indicate larger changes. For initial setup, prioritize any time context from character or lore narratives. Scan context for time changes and apply precisely. Format: HH:MM:SS; MM/DD/YYYY (Day Name).",
		"defaultValue": "<Updated time if changed>",
		"exampleValues": [
			"09:15:30; 10/16/2024 (Wednesday)",
			"18:45:50; 10/16/2024 (Wednesday)",
			"15:10:20; 10/16/2024 (Wednesday)"
		],
		"nestedFields": {}
	},
	"field-1": {
		"name": "Location",
		"type": "STRING",
		"presence": "DYNAMIC",
		"prompt": "Provide a **detailed and specific location**, including exact places like rooms, landmarks, or stores, following this format: \"Specific Place, Building, City, State\". Avoid unintended reuse of specific locations from previous examples. Example: \"Food court, second floor near east wing entrance, Madison Square Mall, Los Angeles, CA\".",
		"defaultValue": "<Updated location if changed>",
		"exampleValues": [
			"Conference Room B, 12th Floor, Apex Corporation, New York, NY",
			"Main Gym Hall, Maple Street Fitness Center, Denver, CO",
			"South Beach, Miami, FL"
		],
		"nestedFields": {}
	},
	"field-2": {
		"name": "Weather",
		"type": "STRING",
		"presence": "DYNAMIC",
		"prompt": "Describe current weather concisely to set the scene. Example: \"Light Drizzle, Cool Outside\".",
		"defaultValue": "<Updated weather if changed>",
		"exampleValues": [
			"Overcast, mild temperature",
			"Clear skies, warm evening",
			"Sunny, gentle sea breeze"
		],
		"nestedFields": {}
	},
	"field-3": {
		"name": "Topics",
		"type": "ARRAY_OBJECT",
		"presence": "DYNAMIC",
		"prompt": "",
		"defaultValue": "",
		"exampleValues": [
			"",
			"",
			""
		],
		"nestedFields": {
			"field-4": {
			"name": "PrimaryTopic",
			"type": "STRING",
			"presence": "DYNAMIC",
			"prompt": "**One- or two-word topic** describing main activity or focus of the scene.",
			"defaultValue": "<Updated Primary Topic if changed>",
			"exampleValues": [
				"Presentation",
				"Workout",
				"Relaxation"
			],
			"nestedFields": {}
			},
			"field-5": {
			"name": "EmotionalTone",
			"type": "STRING",
			"presence": "DYNAMIC",
			"prompt": "**One- or two-word topic** describing dominant emotional atmosphere of the scene.",
			"defaultValue": "<Updated Emotional Tone if changed>",
			"exampleValues": [
				"Tense",
				"Focused",
				"Calm"
			],
			"nestedFields": {}
			},
			"field-6": {
			"name": "InteractionTheme",
			"type": "STRING",
			"presence": "DYNAMIC",
			"prompt": "**One- or two-word topic** describing primary type of interactions or relationships in the scene.",
			"defaultValue": "<Updated Interaction Theme if changed>",
			"exampleValues": [
				"Professional",
				"Supportive",
				"Casual"
			],
			"nestedFields": {}
			}
		}
	},
	"field-7": {
		"name": "CharactersPresent",
		"type": "ARRAY",
		"presence": "DYNAMIC",
		"prompt": "List all characters currently present in an array format.",
		"defaultValue": "<List of characters present if changed>",
		"exampleValues": [
			"[\"Emma Thompson\", \"James Miller\", \"Sophia Rodriguez\"]",
			"[\"Daniel Lee\", \"Olivia Harris\"]",
			"[\"Liam Johnson\", \"Emily Clark\"]"
		],
		"nestedFields": {}
	},
	"field-8": {
		"name": "Characters",
		"type": "FOR_EACH_OBJECT",
		"presence": "DYNAMIC",
		"prompt": "For each character, update the following details:",
		"defaultValue": "<Character Name>",
		"exampleValues": [
			"[\"Emma Thompson\", \"James Miller\", \"Sophia Rodriguez\"]",
			"[\"Daniel Lee\", \"Olivia Harris\"]",
			"[\"Liam Johnson\", \"Emily Clark\"]"
		],
		"nestedFields": {
			"field-9": {
			"name": "Gender",
			"type": "STRING",
			"presence": "DYNAMIC",
			"genderSpecific": "all",
			"prompt": "A single world and an emoji for Character gender. ",
			"defaultValue": "<Current gender if no update is needed>",
			"exampleValues": [
				"\"Male ♂️\"",
				"\"Female ♀️\"",
				"[\"Trans ⚧️\", \"Unkown ❓\"]"
			],
			"nestedFields": {}
			},
			"field-10": {
			"name": "Age",
			"type": "STRING",
			"presence": "DYNAMIC",
			"genderSpecific": "all",
			"prompt": "A single number displays character age based on Narrative. Change with time advancement. Or \"Unkown\" if unkown.",
			"defaultValue": "<Current Age if no update is needed>",
			"exampleValues": [
				"\"Unkown\"",
				"\"18\"",
				"\"32\""
			],
			"nestedFields": {}
			},
			"field-11": {
			"name": "Hair",
			"type": "STRING",
			"presence": "DYNAMIC",
			"genderSpecific": "all",
			"prompt": "Describe style only.",
			"defaultValue": "<Updated hair description if changed>",
			"exampleValues": [
				"[\"Shoulder-length blonde hair, styled straight\", \"Short black hair, neatly combed\", \"Long curly brown hair, pulled back into a low bun\"]",
				"[\"Short brown hair, damp with sweat\", \"Medium-length red hair, tied up in a high ponytail\"]",
				"[\"Short sandy blonde hair, slightly tousled\", \"Long wavy brown hair, loose and flowing\"]"
			],
			"nestedFields": {}
			},
			"field-12": {
			"name": "Makeup",
			"type": "STRING",
			"presence": "DYNAMIC",
			"genderSpecific": "all",
			"prompt": "Describe current makeup.",
			"defaultValue": "<Updated makeup if changed>",
			"exampleValues": [
				"[\"Natural look with light foundation and mascara\", \"None\", \"Subtle eyeliner and nude lipstick\"]",
				"[\"None\", \"Minimal, sweat-resistant mascara\"]",
				"[\"None\", \"Sunscreen applied, no additional makeup\"]"
			],
			"nestedFields": {}
			},
			"field-13": {
			"name": "Outfit",
			"type": "STRING",
			"presence": "DYNAMIC",
			"genderSpecific": "all",
			"prompt": "**IMPORTANT!** List the complete outfit, including **underwear and accessories**, even if the character is undressed. **Underwear must always be included in the outfit description. If underwear is intentionally missing, specify this clearly (e.g. \"No Bra\", \"No Panties\").** Outfit should stay the same until changed for a new one.",
			"defaultValue": "<Full outfit description, even if removed including color, fabric, and style details; **always include underwear and accessories if present. If underwear is intentionally missing, specify clearly**>",
			"exampleValues": [
				"[\"Navy blue blazer over a white silk blouse; Gray pencil skirt; Black leather belt; Sheer black stockings; Black leather pumps; Pearl necklace; Silver wristwatch; White lace balconette bra; White lace hipster panties matching the bra\", \"Dark gray suit; Light blue dress shirt; Navy tie with silver stripes; Black leather belt; Black dress shoes; Black socks; White cotton crew-neck undershirt; Black cotton boxer briefs\", \"Cream-colored blouse with ruffled collar; Black slacks; Brown leather belt; Brown ankle boots; Gold hoop earrings; Beige satin push-up bra; Beige satin bikini panties matching the bra\"]",
				"[\"Gray moisture-wicking t-shirt; Black athletic shorts; White ankle socks; Gray running shoes; Black sports watch; Blue compression boxer briefs\", \"Black sports tank top; Purple athletic leggings; Black athletic sneakers; White ankle socks; Fitness tracker bracelet; Black racerback sports bra; Black seamless athletic bikini briefs matching the bra\"]",
				"[\"Light blue short-sleeve shirt; Khaki shorts; Brown leather sandals; Silver wristwatch; Blue plaid cotton boxer shorts\", \"White sundress over a red halter bikini; Straw hat; Brown flip-flops; Gold anklet; Red halter bikini top; Red tie-side bikini bottoms matching the top\"]"
			],
			"nestedFields": {}
			},
			"field-14": {
			"name": "StateOfDress",
			"type": "STRING",
			"presence": "DYNAMIC",
			"genderSpecific": "all",
			"prompt": "Describe how put-together or disheveled the character appears, including any removed clothing. Note where clothing items from outfit were discarded.",
			"defaultValue": "<Current state of dress if no update is needed. Note location where discarded outfit items are placed if character is undressed>",
			"exampleValues": [
				"[\"Professionally dressed, neat appearance\", \"Professionally dressed, attentive\", \"Professionally dressed, organized\"]",
				"[\"Workout attire, lightly perspiring\", \"Workout attire, energized\"]",
				"[\"Shirt and sandals removed, placed on beach towel\", \"Sundress and hat removed, placed on beach chair\"]"
			],
			"nestedFields": {}
			},
			"field-15": {
			"name": "PostureAndInteraction",
			"type": "STRING",
			"presence": "DYNAMIC",
			"genderSpecific": "all",
			"prompt": "Describe physical posture, position relative to others or objects, and interactions.",
			"defaultValue": "<Current posture and interaction if no update is needed>",
			"exampleValues": [
				"[\"Standing at the podium, presenting slides, holding a laser pointer\", \"Sitting at the conference table, taking notes on a laptop\", \"Sitting next to James, reviewing printed documents\"]",
				"[\"Lifting weights at the bench press, focused on form\", \"Running on the treadmill at a steady pace\"]",
				"[\"Standing at the water's edge, feet in the surf\", \"Lying on a beach towel, sunbathing with eyes closed\"]"
			],
			"nestedFields": {}
			},
			"field-16": {
			"name": "BustWaistHip",
			"type": "STRING",
			"presence": "DYNAMIC",
			"genderSpecific": "female",
			"prompt": "**Female Character only!** Display Bust/Waist/Hip measurements in centimetre based on narrative. Or \"Unkown\" if unknown.",
			"defaultValue": "<Current BustWaistHip if no update is needed>",
			"exampleValues": [
			"\"Unknown\"",
			"\"B80:W60:H86 (CM)\"",
			"\"B79:W56:H83 (CM)\""
			],
			"nestedFields": {}
			},
			"field-17": {
			"name": "FertilityCycle",
			"type": "STRING",
			"presence": "DYNAMIC",
			"genderSpecific": "female",
			"prompt": "**Female Character only!** Displays the current fertility cycle stage. States advance with time. If Pregnancy tracking indicates conception, immediately switch FertilityCycle to \"Pregnant 👶\" and pause the cycle. Remain \"Pregnant 👶\" for the full duration of pregnancy. Resume cycle after delivery.",
			"defaultValue": "<Current fertility cycle if no update is needed>",
			"exampleValues": [
				"[\"Menstrual 🩸 (Safe)\", \"Follicular 🌱 (Low Risk)\"]",
				"[\"Ovulating 🌺 (High Risk!)\", \"Luteal 🌙 (Moderate Risk)\"]",
				"[\"Pregnant 👶\"]"
			],
			"nestedFields": {}
			},
			"field-18": {
			"name": "Pregnancy",
			"type": "STRING",
			"presence": "DYNAMIC",
			"genderSpecific": "female",
			"prompt": "**Female Character only!** Perform a d100 roll post-creampie scene to determine conception, chances are based on fertility cycle: Menstrual (0%), Follicular (15%), Ovulating (85%), Luteal (30%), Pregnant (0%) (e.g., rolled 80 during ovulating phase, 80<85, then yes. ). If yes, track days pregnant and trimester (1st: 0-90; 2nd: 91-180; 3rd: 181-270). Describe this with father's name.",
			"defaultValue": "<Current Pregnancy if no update is needed>",
			"exampleValues": [
				"\"Not Pregnant\"",
				"\"1st trimester, 0 days, impregnated by Harry\"",
				"\"3st trimester, 200 days, impregnated by Harry\""
			],
			"nestedFields": {}
			},
			"field-19": {
			"name": "Virginity",
			"type": "STRING",
			"presence": "DYNAMIC",
			"genderSpecific": "all",
			"prompt": "If virgin: \"Virgin\" else \"Lost to {partner}\".  Or \"Unkown\" if unkown.",
			"defaultValue": "<Current Virginity if no update is needed>",
			"exampleValues": [
				"\"Unkown\"",
				"\"Virgin\"",
				"\"Lost to Sam Witwicky\""
			],
			"nestedFields": {}
			},
			"field-20": {
			"name": "Traits",
			"type": "STRING",
			"presence": "DYNAMIC",
			"genderSpecific": "all",
			"prompt": "Add or Remove trait based on Narrative. \"{trait}: {short description}\"",
			"defaultValue": "<Current Traits if no update is needed>",
			"exampleValues": [
				"[\"No Traits\"]",
				"[\"Giant Penis: causes tearing pain to partner during sex.\", \"Emotional Intelligence: deeply philosophical and sentimental\"]",
				"[\"Tight Pussy: increase partner pleasure during sex.\", \"Masochist: gain pleasure from pain.\", \"Sadistic: deriving pleasure from inflicting pain.\"]"
			],
			"nestedFields": {}
			},
			"field-21": {
			"name": "Children",
			"type": "STRING",
			"presence": "DYNAMIC",
			"genderSpecific": "all",
			"prompt": "Add child after birth based on Narrative. Format: \"{Birth Order}: {Name}, {Gender + Symbol}, child with {Other Parent}\"",
			"defaultValue": "<Current Children if no update is needed>",
			"exampleValues": [
				"[\"No Child\"]",
				"[\"1st Born: Eve, Female ♀️, child with Harry\"]",
				"[\"1st Born: Aya, Female ♀️, child with Bob\", \"2nd Born: Max, Male ♂️, child with Sam\"]"
			],
			"nestedFields": {}
			}
		}
	}
};

const trackerPreviewSelector = ".mes_block .mes_text";
const trackerPreviewPlacement = "before";

const numberOfMessages = 5;
const generateFromMessage = 3;
const minimumDepth = 0;

const responseLength = 0;

//#endregion

export const defaultSettings = {
	enabled: true,
	selectedProfile: "current",
	selectedCompletionPreset: "current",
	generationTarget: generationTargets.BOTH,
	showPopupFor: generationTargets.NONE,
	trackerFormat: trackerFormat.YAML,

	generationMode: generationModes.SINGLE_STAGE,

	generateContextTemplate: generateContextTemplate,
	generateSystemPrompt: generateSystemPrompt,
	generateRequestPrompt: generateRequestPrompt,
	generateRecentMessagesTemplate: generateRecentMessagesTemplate,

	messageSummarizationContextTemplate: "",
	messageSummarizationSystemPrompt: "",
	messageSummarizationRequestPrompt: "",
	messageSummarizationRecentMessagesTemplate: "",

	inlineRequestPrompt: "",

	characterDescriptionTemplate: characterDescriptionTemplate,

	mesTrackerTemplate: mesTrackerTemplate,
	mesTrackerJavascript: mesTrackerJavascript,
	trackerDef: trackerDef,

	trackerPreviewSelector: trackerPreviewSelector,
	trackerPreviewPlacement: trackerPreviewPlacement,

	numberOfMessages: numberOfMessages,
	generateFromMessage: generateFromMessage,
	minimumDepth: minimumDepth,
	responseLength: responseLength,
	selectedPreset: "Default-SingleStage",
	presets: {
		"Default-SingleStage": {
			generationMode: generationModes.SINGLE_STAGE,

			generateContextTemplate: generateContextTemplate,
			generateSystemPrompt: generateSystemPrompt,
			generateRequestPrompt: generateRequestPrompt,
			generateRecentMessagesTemplate: generateRecentMessagesTemplate,

			messageSummarizationContextTemplate: "",
			messageSummarizationSystemPrompt: "",
			messageSummarizationRequestPrompt: "",
			messageSummarizationRecentMessagesTemplate: "",

			inlineRequestPrompt: "",

			characterDescriptionTemplate: characterDescriptionTemplate,

			mesTrackerTemplate: mesTrackerTemplate,
			mesTrackerJavascript: mesTrackerJavascript,
			trackerDef: trackerDef,
		},
		"Default-TwoStage": {
			generationMode: generationModes.TWO_STAGE,

			generateContextTemplate: twoStageGenerateContextTemplate,
			generateSystemPrompt: twoStageGenerateSystemPrompt,
			generateRequestPrompt: twoStageGenerateRequestPrompt,
			generateRecentMessagesTemplate: generateRecentMessagesTemplate,

			messageSummarizationContextTemplate: messageSummarizationContextTemplate,
			messageSummarizationSystemPrompt: messageSummarizationSystemPrompt,
			messageSummarizationRequestPrompt: messageSummarizationRequestPrompt,
			messageSummarizationRecentMessagesTemplate: messageSummarizationRecentMessagesTemplate,

			inlineRequestPrompt: "",

			characterDescriptionTemplate: characterDescriptionTemplate,

			mesTrackerTemplate: mesTrackerTemplate,
			mesTrackerJavascript: mesTrackerJavascript,
			trackerDef: trackerDef,
		},
		"Default-Inline": {
			generationMode: generationModes.INLINE,

			generateContextTemplate: generateContextTemplate,
			generateSystemPrompt: generateSystemPrompt,
			generateRequestPrompt: generateRequestPrompt,
			generateRecentMessagesTemplate: generateRecentMessagesTemplate,

			messageSummarizationContextTemplate: "",
			messageSummarizationSystemPrompt: "",
			messageSummarizationRequestPrompt: "",
			messageSummarizationRecentMessagesTemplate: "",

			inlineRequestPrompt: inlineRequestPrompt,

			characterDescriptionTemplate: characterDescriptionTemplate,

			mesTrackerTemplate: mesTrackerTemplate,
			mesTrackerJavascript: mesTrackerJavascript,
			trackerDef: trackerDef,
		},
	},
	debugMode: false,
};
