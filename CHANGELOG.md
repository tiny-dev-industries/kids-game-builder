# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-03-03

### Added — Milestone 5: Assets Library + Procedural Sounds

- **SVG sprite library** — 10 custom-illustrated character sprites + 5 tileable background scenes
  - Hero sprites: Knight, Robot, Cat, Wizard, Astronaut
  - Enemy sprites: Dragon, Ghost, Bat, Alien, Slime
  - Background tiles: Blue Sky, Starfield, Dungeon, Forest, Desert (all 256×256 SVG, tileable)
  - Stored in `/public/assets/characters/` and `/public/assets/backgrounds/`
- **AI sprite selection** — catalog summary injected into both `CREATE_SYSTEM_PROMPT` and `UPDATE_SYSTEM_PROMPT`
  - AI picks `heroSpriteId`, `enemySpriteId`, `bgId` from the catalog when a good thematic match exists
  - Sprite IDs validated after generation; unknown IDs stripped to prevent hallucination
  - Emoji still required as fallback — sprite fields are always optional
- **`lib/assets.ts`** — single source of truth for the asset catalog
  - Exports `HERO_SPRITES`, `ENEMY_SPRITES`, `BG_ASSETS` arrays with id/name/tags/url/fallbackColor
  - `getCatalogSummary()` generates the AI prompt block
  - `ALL_CHARACTER_IDS` / `ALL_BG_IDS` sets for O(1) validation
- **Phaser `preload()` in both templates** — sprites load before `create()` runs
  - `this.load.image()` called for hero/enemy/bg when catalog IDs are set
  - `this.textures.exists()` check in `create()` — falls back to emoji text if load failed
  - Background: `tileSprite` for scrolling parallax (runner) or tiled arena floor (topdown)
  - Hero/enemy: `this.add.image().setDisplaySize(52, 52)` with correct origin
  - Game over: sprite tinted red (`setTint(0xff4444)`) instead of replaced with 💥
- **Visual asset picker in Settings panel**
  - `SpritePicker` component — horizontal grid of 48×48 thumbnails + "Auto" chip (reverts to emoji)
  - `BgPicker` component — background tiles at 56×40 with fallback color fill
  - Knight/Dragon/Dungeon (etc.) correctly pre-selected after AI generation
  - Clicking any option instantly reloads the game via `sendConfigToGame`
- **Procedural Web Audio sounds** via independent `AudioContext` (separate from Phaser's audio)
  - `createSounds()` helper returns `{ jump, land, gameOver, score }` no-ops gracefully if unavailable
  - jump: rising double chirp (300→520 Hz); land: soft triangle thud; gameOver: sad 3-note descent; score: coin ding
  - Runner: jump on SPACE/tap, land when touching ground, score every 10 enemies dodged, game over
  - Top-down: score ding every 5 seconds survived, game over
- **`GameConfig` extended** with optional `heroSpriteId?`, `enemySpriteId?`, `bgId?: string`
  - Update mode preserves sprite IDs unless explicitly changed by the AI

## [0.4.0] - 2026-03-02

### Added — Milestone 4: Second Game Template + Output Target Settings
- **Top-Down Avoid template** — second playable game type alongside the endless runner
  - Hero spawns in the canvas center; moves freely in 4 directions (WASD / arrow keys / tap-to-move)
  - Enemies spawn from random screen edges and swarm toward the player
  - Spawn rate accelerates over time (`max(600ms, 2200 - elapsed×80ms)`)
  - Circle collision detection (radius 34px); score = time survived in seconds
  - Touch controls: hold/drag pointer → hero moves toward the held point
  - Diagonal movement normalized (`×0.707`) so diagonal isn't faster than cardinal
- **Template field in `GameConfig`** — `template: 'runner' | 'topdown'` (default: `'runner'`)
  - AI system prompts updated to pick the right template from the description
  - Examples: "tank dodging missiles in an arena" → `topdown`; "dog jumping over cats" → `runner`
  - Template validated in `generateGameConfig()` — invalid values fall back to `'runner'`
- **Settings → Template toggle** — live toggle between `🏃 Runner` and `⬆️ Top-Down` in the Settings tab; switches the game immediately without re-prompting the AI
- **Settings → adaptive labels** — Speed slider label changes: "Enemy Speed" (runner) vs "Move Speed" (topdown); Ground color picker hidden when template is `topdown`
- **Output Target settings section** (bottom of Settings tab, subtly styled)
  - 📱 **Mobile (iPad)** toggle — when ON, appends a mobile constraint block to AI system prompts: larger emoji sizes, tap/swipe controls, no keyboard-centric mechanics
  - 🎲 **Dimensions: 2D only** — read-only indicator (expectation-setting; will become a selector when isometric/3D support is added)
  - Available in all settings states: before first game, during config game, during code game
- **`mobile` flag in API** — `POST /api/generate-game` accepts `{ mobile: boolean }`; forwarded to both `generateGameConfig()` and `generateGameCode()`
- **Adaptive chat messages** — topdown games say "WASD or tap to move!" instead of "jump!"; hint chips update to "Switch to runner" for topdown config games
- **`game.html` refactor** — runner logic extracted into `startRunnerGame()` + `RunnerScene`; new `startTopDownGame()` + `TopDownScene`; `startGame()` dispatches on `config.template`
- **Tags**: `v0.3.0-m3-stable` retroactively tagged on the M3 commit

## [0.3.0] - 2026-03-02

### Added — Milestone 3: Game Clone Generation
- **"Build a Clone" mode** — AI generates a complete custom Phaser 3 game from scratch (not just a reskin of the runner)
  - Mode toggle in the input area: `✨ Simple Game` / `🕹️ Build a Clone`
  - Clone mode uses **GPT-4o** (not mini) for reliable game code generation
  - Simple mode continues using GPT-4o-mini for fast runner config generation
- **Clone keyword detection** — fallback safety net: prompts containing "lander", "flappy", "pong", "breakout", "snake", "asteroids", "tetris", "platformer", etc. auto-route to code generation even without the toggle
- **`LOAD_CODE` iframe handler** — `game.html` now accepts `postMessage({ type: 'LOAD_CODE', code })` alongside existing `LOAD_CONFIG`; runs generated JS via `(new Function(code))()` with full error recovery
- **Adaptive UI for clone mode**
  - Orange accent color throughout (toggle, submit button, Playing badge, Settings dot)
  - Textarea border turns orange in clone mode; placeholder switches to "Name a classic game..."
  - Hint chips switch to clone-specific: "Make it harder", "Add a twist", "Change the controls"
  - Submit button: "Build Clone!" / "Rebuild Clone!" with `Code2` icon
  - Settings tab shows 🕹️ title + "Custom-coded game — use chat to modify" (no editable fields for code games)
  - Loading message switches to "Coding your clone..." / "Recoding your game..."
- **Iteration on code games** — saying "make it harder" re-generates with accumulated description; `codeAccumPrompt` tracks the full history
- **New types**: `GameCodeResult`, `GameConfigResult`, `GameResult` discriminated union in `lib/types.ts`
- **New API shape**: route now returns `{ type: 'config', config }` or `{ type: 'code', title, code }` — frontend branches on `data.type`

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
