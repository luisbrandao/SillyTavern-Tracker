# SillyTavern Tracker Enhanced Extension

A tracker extension for SillyTavern that monitors character and scene state across a chat. It generates a structured "tracker" alongside each message using a separate, dedicated connection, with a drag‑and‑drop field editor and one‑click HTML template generation.

## Changelog

### 13-06-2026
- Added a global **enable/disable toggle** directly in the Tracker Interface window header, so you can turn the extension on/off without opening the settings panel (mirrors the settings checkbox).
- Maintenance under new ownership (see Credits): replaced the hand‑rolled YAML parser with SillyTavern's bundled library, fixed generation mutex leaks, hardened tracker templates against XSS, corrected settings migration, and removed deprecated event handlers and the old object‑editor UI.

### 28-09-2025
- No longer automatically sends a tracker generation request when you merely open an old chat.
   - SillyTavern uses a dry‑run while reconstructing the chat page when you open an old chat. The extension used to treat that as a real new message; a guard now skips it.
   - This saves one tracker generation every time you open an old chat.
- Removed the unrelated Development Test section (character/group creation, editing, and management). The extension now focuses solely on tracker generation.

## 🚀 Features

### 🎯 Prompt Maker (field editor)
- **Visual field editor**: Define the fields your tracker should track (name, type, presence, nested fields).
- **Drag & drop reordering**: Reorder fields by dragging the hamburger handle (☰), with automatic scrolling so the dragged field stays in view in long forms.
- **One‑click template generation**: Generate an HTML template from your field definitions with the **Generate Template** button — no hand‑writing HTML.

### 🔄 Independent connection
- **Separate connection from your main chat**: Tracker generation runs through its own connection profile and completion preset, so it never switches or interrupts the connection you use for the actual roleplay.
- **Use a cheaper model for tracking**: Because it's independent, you can point the tracker at an inexpensive model while keeping your premium model for the main chat.

### 🪟 Tracker Interface window
Open it from the magic‑wand (Extensions) menu → **Tracker**, or from the **Show Message Tracker** button on any message (the `</>` icon in the message's button row).

The window lets you:
- **Enable/Disable** the whole extension globally via the toggle in the header.
- **View** the tracker for the selected message.
- **Edit** the tracker fields inline.
- **Regenerate** the tracker (with a dropdown to choose *No Static Fields*, *All Fields*, or *Static Only*).
- **Delete** the tracker from the message.

## 🎮 How to Use

### 1. Set up fields
1. Open SillyTavern Settings → **Extensions** → **Tracker Enhanced** drawer.
2. Click **Prompt Maker** to open the field editor.
3. **Add fields** with "Add Field" and configure each one's name, type, and presence.
4. **Reorder** fields by dragging the hamburger handle (☰).

### 2. Generate a template
1. After defining your fields, click **Generate Template** (in the Preset Settings section).
2. An HTML template is generated and applied automatically.
3. Adjust the generated **Message Tracker HTML** if you want a custom look.

### 3. Pick a connection & preset
The tracker uses an **🔒 Independent Connection Profile** and an optional **🎯 Dedicated Completion Preset**, both set in the extension drawer. The original tracker forced a matching connection profile and completion preset; here they are unlinked for flexibility, with compatibility hints on the preset dropdown:
- **✅** — Compatible: the preset matches your connection profile's API. Recommended.
- **⚠️ (May have compatibility issues)** — the preset may work but could have parameter conflicts. Use with caution.
- **❌ (Likely incompatible - different API)** — the preset is for a different API and may cause errors. Not recommended.

*You can still select any preset, but ✅ ones give the most reliable results.*

## ⌨️ Slash Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `/generate-tracker-enhanced` | `/gen-tracker-enhanced` | Generate a tracker for a message (`message=`, `include=`). Defaults to the last non‑system message. |
| `/get-tracker-enhanced` | — | Retrieve the tracker JSON for a message (`message=`). |
| `/save-tracker-enhanced` | — | Save a tracker to a message (`message=`, `tracker=`). |
| `/remove-tracker-enhanced` | `/delete-tracker-enhanced` | Remove the tracker from a message (`message=`). |
| `/tracker-enhanced-override` | — | Override the tracker used for the next generation (`tracker=`). |
| `/tracker-enhanced-state` | `/toggle-tracker-enhanced` | Get or set the extension's enabled state (`enabled=true|false`). |

## 📚 Migration from the Original

Use either the original tracker or this enhanced version — not both at once. Their settings and message data are separate, so running both will produce duplicate trackers and confusion.

## 🛠️ Troubleshooting

- **Token cost too high**:
   - You don't need an expensive model (Gemini, Claude, etc.) for the tracker. Keep those for the main connection and use a cheap model (e.g. DeepSeek) for tracking.
   - The default **Number of Recent Messages to Include** is **5**, which costs roughly 9k tokens per generation in typical use — it scales with how long your messages are. Lower it if that's too much.
   - At the default, ~100 messages costs about 1M tokens; on DeepSeek that's roughly $0.30.
- **Preset compatibility warnings**: Prefer presets marked ✅, or create a new preset tuned to your connection profile.
- **Template errors**: Use **Generate Template** to produce properly formatted HTML.
- **Connection issues**: The tracker uses an independent connection, so it shouldn't interfere with your main chat. If generation fails, check the dedicated connection profile and preset first.
- **Something else breaks**: Most often it's the connection profile. Try a clean profile with no extra prompts before reporting a bug.

## 📜 Credits

This extension has passed through several hands:

- **Original Tracker** by **kaldigo** — https://github.com/kaldigo/SillyTavern-Tracker
- **Tracker Enhanced** fork by **harrywenjie** — https://github.com/harrywenjie/SillyTavern-Tracker-Enhanced
- **Current maintainer**: this repository — https://github.com/luisbrandao/SillyTavern-Tracker

Built for **SillyTavern** — https://github.com/SillyTavern/SillyTavern
