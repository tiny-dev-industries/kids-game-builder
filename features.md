# Kids Game Builder — Feature Registry

_Current version: **v0.7.0** | Production: https://kids-game-builder.vercel.app_

## Legend
✅ Implemented &nbsp; 🚧 In Progress &nbsp; ⏳ Planned &nbsp; ❌ Dropped

---

## M1 — Core Prompt → Playable Game (v0.1.0–0.1.1)

| Status | Feature | Key Files |
|--------|---------|-----------|
| ✅ | Text prompt → Phaser 3 endless runner | `app/page.tsx`, `public/game.html`, `lib/ai.ts` |
| ✅ | Voice input (Web Speech API, Chrome only) | `app/page.tsx` |
| ✅ | Chat bubble history (user + AI messages) | `app/page.tsx` |
| ✅ | OpenAI GPT-4o-mini config generation with `json_object` format | `lib/ai.ts` (CREATE_SYSTEM_PROMPT) |
| ✅ | Game Over panel with score + restart | `public/game.html` (RunnerScene.triggerGameOver) |
| ✅ | `LOAD_CONFIG` postMessage hot-swap (parent → iframe) | `public/game.html`, `app/page.tsx` |
| ✅ | Sandboxed game iframe | `app/page.tsx` (`sandbox="allow-scripts allow-same-origin"`) |
| ✅ | First stable Vercel deploy (CVE-2025-66478 patch, Next.js 15.3.9) | — |

---

## M2 — Game Iteration Loop (v0.2.0–0.2.2)

| Status | Feature | Key Files |
|--------|---------|-----------|
| ✅ | Conversational game updates (change hero, speed, etc. without restarting) | `lib/ai.ts` (UPDATE_SYSTEM_PROMPT), `app/page.tsx` |
| ✅ | `currentConfig` passed to API for delta-only updates | `lib/ai.ts` (generateGameConfig), `app/api/generate-game/route.ts` |
| ✅ | Hint chips — "Make it faster", "Make it harder", "Change the hero" | `app/page.tsx` (hintChips) |
| ✅ | Adaptive UI: header subtitle, placeholder, button label change after first game | `app/page.tsx` |
| ✅ | Settings panel — read-only view of current GameConfig | `app/page.tsx` (SettingsPanel) |
| ✅ | Live editable settings: title, hero/enemy emoji, speed slider, color pickers | `app/page.tsx` (SettingsRow, EmojiInput, ColorInput) |
| ✅ | Instant config push from settings — no AI round-trip needed | `app/page.tsx` (handleConfigChange → sendConfigToGame) |
| ✅ | `lib/types.ts` — shared `GameConfig`, `SPEED_MIN`, `SPEED_MAX` (fixes client bundle crash) | `lib/types.ts` |

---

## M3 — Game Clone Generation (v0.3.0)

| Status | Feature | Key Files |
|--------|---------|-----------|
| ✅ | "Build a Clone" mode — AI writes complete custom Phaser 3 game from scratch | `app/page.tsx`, `lib/ai.ts` (generateGameCode) |
| ✅ | GPT-4o (full model) used for code generation; mini for config | `lib/ai.ts` |
| ✅ | Clone keyword detection fallback (flappy, pong, snake, asteroids, etc.) | `lib/ai.ts` |
| ✅ | `LOAD_CODE` postMessage handler — runs generated JS via `new Function(code)()` | `public/game.html` |
| ✅ | Orange accent UI for clone mode (toggle, button, badge, textarea border) | `app/page.tsx` |
| ✅ | Code game iteration — `codeAccumPrompt` accumulates full change history | `app/page.tsx` |
| ✅ | Settings panel shows "custom-coded game — use chat to modify" in clone mode | `app/page.tsx` (SettingsPanel, gameMode==='code') |
| ✅ | `GameResult` discriminated union (`type: 'config'` vs `type: 'code'`) | `lib/types.ts` |

---

## M4 — Second Game Template + Output Target (v0.4.0)

| Status | Feature | Key Files |
|--------|---------|-----------|
| ✅ | Top-Down Avoid template — 4-direction hero, swarming enemies, time-survived score | `public/game.html` (startTopDownGame, TopDownScene) |
| ✅ | `template: 'runner' | 'topdown'` field in GameConfig | `lib/types.ts` |
| ✅ | AI picks template from description; validated post-parse | `lib/ai.ts` |
| ✅ | Live Template toggle in Settings (switches game immediately, no AI call) | `app/page.tsx` (TemplateToggle) |
| ✅ | Adaptive Settings labels ("Enemy Speed" vs "Move Speed", Ground color hidden on topdown) | `app/page.tsx` |
| ✅ | Touch controls: hold/drag pointer → hero moves toward held point (topdown) | `public/game.html` (TopDownScene) |
| ✅ | Mobile (iPad) toggle in Output Target — appends touch-first constraints to AI prompts | `app/page.tsx`, `lib/ai.ts` |
| ✅ | Preferred template remembered between sessions | `app/page.tsx` (preferredTemplate state) |

---

## M5 — Assets Library + Procedural Sounds (v0.5.0)

| Status | Feature | Key Files |
|--------|---------|-----------|
| ✅ | SVG sprite library — 5 hero + 5 enemy characters (Knight, Robot, Cat, Wizard, Astronaut / Dragon, Ghost, Bat, Alien, Slime) | `public/assets/characters/*.svg` |
| ✅ | 5 tileable SVG background scenes (Blue Sky, Starfield, Dungeon, Forest, Desert) | `public/assets/backgrounds/*.svg` |
| ✅ | `lib/assets.ts` — single source of truth for asset catalog (id/name/tags/url) | `lib/assets.ts` |
| ✅ | AI sprite selection — catalog summary in both system prompts; IDs validated post-parse | `lib/ai.ts` |
| ✅ | Phaser `preload()` in both templates; `textures.exists()` fallback to emoji | `public/game.html` (preload in RunnerScene + TopDownScene) |
| ✅ | Background tile: scrolling parallax (runner) or tiled arena floor (topdown) | `public/game.html` |
| ✅ | `SpritePicker` component — 48×48 thumbnail grid + "Auto" chip | `app/page.tsx` (SpritePicker) |
| ✅ | `BgPicker` component — 56×40 background tiles with fallback color fill | `app/page.tsx` (BgPicker) |
| ✅ | Procedural Web Audio sounds — jump, land, gameOver, score ding | `public/game.html` (createSounds) |

---

## M6 — Actions System + Chat Targeting (v0.6.0)

| Status | Feature | Key Files |
|--------|---------|-----------|
| ✅ | `collectible` action — bonus-point pickups that scroll in runner, sit stationary in topdown | `public/game.html` (ActionSystem.spawnCollectible, tick) |
| ✅ | `lives` action — multi-life HUD with ❤️ hearts; invincibility flash between hits | `public/game.html` (ActionSystem.buildLivesHUD, handleCollision) |
| ✅ | `shield` action — periodic 🛡️ power-up spawns; absorbs one hit with blue bubble visual | `public/game.html` (ActionSystem.spawnShield) |
| ✅ | `double-points` action — timed ⚡ 2× score burst with on-screen banner | `public/game.html` (ActionSystem.tick) |
| ✅ | `enemy-explode` action — enemies tween-scale and fade on collision | `public/game.html` (ActionSystem.handleCollision) |
| ✅ | `speed-ramp` action — auto-accelerates game every 10 seconds | `public/game.html` (ActionSystem.tick) |
| ✅ | `ActionSystem` module — shared init/tick/handleCollision/destroy for both templates | `public/game.html` (ActionSystem object) |
| ✅ | AI action schema + examples in both CREATE and UPDATE prompts | `lib/ai.ts` |
| ✅ | Chat Targeting (🎯) — click any settings row or action card to pre-fill chat | `app/page.tsx` (handleTarget, textareaRef) |
| ✅ | `ActionCard` component — emoji, name, description, 🎯 button | `app/page.tsx` (ActionCard) |
| ✅ | ⚡ Actions section in Settings — action cards or "No actions yet" empty-state | `app/page.tsx` (SettingsPanel) |
| ✅ | `GameAction` interface + `ActionType` union | `lib/types.ts` |

---

## M6.1 — Mobile Web Support (v0.6.1)

| Status | Feature | Key Files |
|--------|---------|-----------|
| ✅ | Viewport meta: `device-width, maximumScale=1, viewportFit=cover` | `app/layout.tsx` (Viewport export) |
| ✅ | `Chat \| Game \| Settings` bottom nav bar (mobile < lg, fixed, z-50) | `app/page.tsx` (mobile nav) |
| ✅ | Absolute-position overlay layout: game (z-0) always rendered, left panel (z-10) overlays | `app/page.tsx` |
| ✅ | `h-[100dvh]` root height for correct mobile browser height | `app/page.tsx` |
| ✅ | Safe-area CSS utilities: `.pb-safe`, `.h-nav`, `.mb-nav` for iPhone notch | `app/globals.css` |
| ✅ | Touch optimizations: `touch-action: manipulation`, no tap flash, no overscroll bounce | `app/globals.css` |
| ✅ | Version badge in header for cross-device verification | `app/page.tsx` |

---

## M6.2 — Bidirectional postMessage / Game Ready Signal (v0.6.2)

| Status | Feature | Key Files |
|--------|---------|-----------|
| ✅ | `GAME_READY` emitted by RunnerScene + TopDownScene at end of `create()` | `public/game.html` |
| ✅ | `GAME_ERROR` emitted on `startGame()` exception (LOAD_CONFIG) and caught code errors (LOAD_CODE) | `public/game.html` |
| ✅ | `GAME_READY` emitted after 500ms on successful LOAD_CODE execution | `public/game.html` |
| ✅ | `window.addEventListener('message')` in parent — updates `gameReady` / `gameError` state | `app/page.tsx` |
| ✅ | 3-state badge: ⏳ Loading (gray) → 🎮/🕹️ Playing! (green/orange) → ⚠️ Error (red) | `app/page.tsx` |

---

## M7a — Smart Style Vocab + Post-Game Chips (v0.7.0)

| Status | Feature | Key Files |
|--------|---------|-----------|
| ✅ | AI style vocabulary — "obstacle course" → runner + speed-ramp; "collector" → collectible; "top-down" → topdown | `lib/ai.ts` (CREATE_SYSTEM_PROMPT) |
| ✅ | Post-game style chips (auto-submit) — `🎯 Go Top-Down`, `⭐ Add Collectibles`, `🧗 Harder/Faster` (runner); `🏃 Go Runner`, `💀 More Enemies` (topdown) | `app/page.tsx` (styleChips) |
| ✅ | Style chips shown only after `gameReady` (not on first load), with blue visual treatment distinct from gray hint chips | `app/page.tsx` |

---

## Planned / Future

| Status | Feature | Notes |
|--------|---------|-------|
| ⏳ | Save / share game URL | Serialize GameConfig to URL params or short link |
| ⏳ | More game templates (platformer, top-down shooter) | M7 candidate |
| ⏳ | More action types (boss wave, time limit, checkpoint) | M7 candidate |
| ⏳ | User-uploadable sprite images | Needs storage (Vercel Blob or similar) |
| ⏳ | Game title screen / intro animation | Polish pass |
| ⏳ | Leaderboard / high score persistence | Needs backend / KV store |
