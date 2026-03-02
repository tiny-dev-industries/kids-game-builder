# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2026-03-02

### Added
- **Editable settings panel** — every field in the Settings tab is now a live control; changes push to the game instantly via `postMessage`
  - Title: text input (20-char max)
  - Hero / Enemy: emoji inputs side-by-side (paste or OS emoji picker)
  - Speed: range slider (180–600, step 5) with a color-coded fill bar (green → yellow → red)
  - Background / Ground: clickable color swatches open the native OS color picker; hex value displayed alongside
- New `SettingsRow`, `EmojiInput`, `ColorInput` sub-components keep the panel clean
- `handleConfigChange` callback in `Home` wires direct edits to `setCurrentConfig` + `sendConfigToGame` in one hop — no AI round-trip needed

## [0.2.1] - 2026-03-02

### Fixed
- **Speed ceiling bug** — "Make it faster" was immediately hitting the old max of 380 and stalling. `SPEED_MAX` raised to 600; `UPDATE_SYSTEM_PROMPT` now instructs the model to add exactly 75 each time (cap 600, floor 180)
- **Client-side OpenAI crash** — shared types (`GameConfig`, `SPEED_MIN`, `SPEED_MAX`) extracted into new `lib/types.ts` so `page.tsx` can import them without pulling the server-only OpenAI client into the browser bundle

### Added
- **Settings tab** — second tab in the left rail shows current `GameConfig` at a glance
  - Title, hero emoji, enemy emoji displayed
  - Speed shown as a color-coded progress bar (green → yellow → red)
  - Background and ground colors shown as swatches with hex values
  - Blue dot indicator on the Settings tab when a game is loaded
  - "Make a game first" empty state when no config exists yet

## [0.2.0] - 2026-03-02

### Added — Milestone 2: Game Iteration Loop
- **"Change my game" conversational iteration** — kid can modify a running game without starting over
  - Separate `UPDATE_SYSTEM_PROMPT` in `lib/ai.ts`: only changes fields the kid mentioned, keeps everything else
  - `generateGameConfig()` now accepts optional `currentConfig` — switches between create and update mode
  - On API error in update mode, falls back to current config (game stays alive, not reset to default)
- **Quick-change hint chips** — "Make it faster", "Make it harder", "Change the hero" — one tap to iterate
- **Adaptive UI states**
  - Header subtitle updates to "Playing: [title]" once a game is live
  - Input placeholder switches to "What would you like to change?" after first game
  - Submit button switches to blue "Update Game!" (with `RefreshCw` icon) during iteration
  - Loading text switches to "Updating your game..." vs "Building your game..."
  - Error fallback keeps `state = 'playing'` instead of dropping back to idle
- **API route** now accepts optional `currentConfig` in request body and passes it through

## [0.1.1] - 2026-03-02 🎉 First stable deploy

### Security
- Upgraded Next.js from 15.0.3 → 15.3.9 to patch CVE-2025-66478 (middleware bypass vulnerability)

### Deployed
- Live on Vercel — end-to-end generation confirmed working in production
- Kid describes a game → OpenAI generates config → Phaser endless runner loads in browser
- Tagged `v0.1.1-m1-stable` — first stable milestone: limited single-template generation works e2e

## [0.1.0] - 2026-03-02

### Added
- **Milestone 1: Core prompt → playable game loop**
  - Two-column layout: left chat rail + right game preview panel
  - Text input with "Make My Game!" submit button (Enter key supported)
  - Voice input via Web Speech API (mic button, Chrome only)
  - Chat bubble history showing user prompts and AI responses
  - Thinking/loading state with animated emoji indicator
- **OpenAI-powered game config generation** (`lib/ai.ts`)
  - `gpt-4o-mini` with `json_object` response format
  - System prompt maps natural language description → `GameConfig` JSON
  - Picks hero emoji, enemy emoji, background color, title, and speed from prompt
  - Speed clamped to safe range (180–380 px/sec), jump force fixed at 580
  - Silent fallback to default dog/cat config on API error
- **Next.js API route** (`app/api/generate-game/route.ts`)
  - POST `/api/generate-game` accepts `{ prompt }`, returns `{ config: GameConfig }`
  - Returns 401/500 errors with human-readable messages
- **Phaser 3 endless runner** (`public/game.html`)
  - Standalone HTML, Phaser 3.70.0 loaded from CDN (no bundler)
  - Hero auto-runs; SPACE or tap/click to jump over enemies
  - Emoji characters rendered as canvas text (zero asset management)
  - Clouds, ground, score counter, title display
  - Game Over panel with score; any key or tap restarts
  - Receives `postMessage({ type: 'LOAD_CONFIG', config })` to hot-swap theme
  - Sandboxed in `<iframe sandbox="allow-scripts allow-same-origin">`
- **Project scaffolding**
  - Next.js 15, React 18, TypeScript, Tailwind CSS, OpenAI SDK
  - `dev.sh` wrapper script resolves mise-managed Node/pnpm paths for preview runner
  - `.claude/launch.json` configured for `preview_start` tool

### Architecture
- Prompt → `POST /api/generate-game` → OpenAI → `GameConfig` JSON → `postMessage` → Phaser iframe
- Inspired by `09-google-stitch-clone` two-column layout and API route patterns
