# Repository Guidelines

## Project Structure & Module Organization
- `index.js` wires SillyTavern events, generation mutex listeners, and slash commands into the extension entry point.
- Core logic under `src/`: `tracker.js` orchestrates generation/injection, `generation.js` handles independent connection requests, `trackerDataHandler.js` manages schema reconciliation, and `ui/` + `settings/` hold modals, previews, and defaults.
- Shared helpers live in `lib/` (`utils.js`, `interconnection.js`, `ymlParser.js`); reuse them before adding new utilities.
- UI assets remain in `html/settings.html`, `sass/style.scss`, and compiled `style.css`. Treat `docs/Tracker Documentation.pdf` as legacy; rely on `README.md` for current behaviour.

## Build, Test & Development Commands
- `npx sass sass/style.scss style.css --no-source-map` rebuilds stylesheets (`--watch` for live edits). `sass/style.scss` is the source of truth — edit the SCSS, never hand-edit the compiled `style.css`. (The SCSS was resynced to the compiled output in 2026-06; it now includes the tracker-interface layout under the correct DOM id `#trackerEnhancedInterface`, prompt-maker drag/drop, template-controls, reset, and compatibility rules.)
- dart-sass emits two harmless normalizations vs. older builds: a leading `@charset "UTF-8";` (the compatibility indicators use emoji) and unquoted emoji attribute selectors (`[value*=✅]`); both are valid and render identically.
- After JS/HTML/CSS changes reload via SillyTavern `Settings → Extensions → Reload`.
- In the browser console inspect `window.trackerEnhanced` to view runtime state or toggle debug logging.

## Coding Style & Conventions
- ES modules, double quotes, trailing semicolons. Core logic uses tabs; selective UI helpers use four spaces—match the file.
- Naming: PascalCase classes, camelCase functions/vars, SCREAMING_SNAKE_CASE constants, DOM IDs prefixed with `tracker_enhanced_`.
- Use provided `debug/log/warn/error` helpers for console output so debug mode can silence them globally.

## Tracker Behaviour Notes (2025-09)
- Tracker auto-generation hooks fire from `onGenerateAfterCommands` and the message-rendered callbacks (`onUserMessageRendered`/`onCharacterMessageRendered`). The old `onMessageSent/Received` handlers were retired when generation moved to post-response (commit 5b4629c) and have been deleted. SillyTavern emits a `generation_after_commands` dry-run immediately after `chat_id_changed`; we now bail early and log `GENERATION_AFTER_COMMANDS dry run skip { type: "normal", dryRun: true, ... }` to confirm no request is sent.
- The first real turn after a reload still fires a second `generation_after_commands` with `dryRun: false`. Look for the log payload `(3) [undefined, options, false]` before tracker generation starts. If that never appears, reload the extension to clear stale `chat_metadata`.
- `addTrackerToMessage` writes tracker data before the DOM exists; previews/interface updates must run in `onUserMessageRendered`/`onCharacterMessageRendered`. Skipping those handlers after a tracker exists hides UI updates.
- When investigating tracker gaps, capture the full console sequence (chat open → user turn → character reply). Two sequential generation calls are expected in single-stage mode: one for the previous message, one for the newly rendered message. Only unexpected dry-run omissions should be treated as regressions.

## Injection & Prompt Pipeline Notes (2026-06)
- `injectTracker()` uses `setExtensionPrompt(..., IN_CHAT, depth, true, role)` with the role from the `trackerInjectionRole` setting. For chat completion APIs the injection becomes its own `{role, content}` message via core's `populationInjectionPrompts()` (`public/scripts/openai.js`), NOT `doChatInject()` (text completion only).
- A "separate tracker message" cannot be guaranteed on alternation-enforcing backends: ST's server (`src/prompt-converters.js`, e.g. `convertClaudeMessages`/`mergeMessages`) converts mid-chat `system` messages to `user` and then unconditionally merges consecutive same-role messages. So System/User-role injections get glued into the player's user turn there — that is core server behavior, not an extension bug; don't try to refactor it away client-side.
- Assistant role is the only option that keeps the tracker out of the player's turn on those backends (it merges into the end of the character's previous message; on OpenAI-compatible APIs it stays separate). `injectTracker()` clamps assistant-role injections to depth ≥ 1 because a trailing assistant message acts as a Claude prefill and the model continues writing from the tracker.

## Testing Workflow
- Manual validation only: stage chats, send user/character turns, run `/tracker save`, inspect preview pane, and watch console for `[tracker-enhanced]` logs or unexpected mutex captures.
- For regression checks, confirm both standalone tracker interface updates and inline preview rendering for freshly generated messages.

## Commit & PR Expectations
- Follow history style: short imperative titles (e.g., `add createAndJoin`).
- PRs should note motivation, UX impact, preset migration steps, and link relevant SillyTavern changes. Include screenshots or YAML snippets if UI output changes.
- **Bump `version` in `manifest.json`** whenever you ship user-facing changes (features/fixes). Use semver: patch for fixes, minor for new features, major for breaking changes (removed fields/defaults). SillyTavern surfaces this version, so don't forget it before release.

## Migration Context
- Development moved from Claude to Codex agents. Keep AGENTS.md updated with key learnings (like the tracker generation findings above) so future compactions retain context.
