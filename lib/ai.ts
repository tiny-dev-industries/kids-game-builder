import OpenAI from 'openai'
import { GameConfig, SPEED_MIN, SPEED_MAX, GameCodeResult } from './types'
import { getCatalogSummary, ALL_CHARACTER_IDS, ALL_BG_IDS } from './assets'

export type { GameConfig }
export { SPEED_MIN, SPEED_MAX }

// Build once at module load — injected into both AI system prompts
const ASSET_CATALOG_BLOCK = getCatalogSummary()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const CREATE_SYSTEM_PROMPT = `${ASSET_CATALOG_BLOCK}

You are a fun game design helper for kids. A kid will describe a game idea and you will turn it into a game config.

Your job: pick the best emojis, colors, template, AND sprites that match their description.

Rules:
- template: "runner" for side-scrolling games where the hero jumps over enemies; "topdown" for games where the player moves in all 4 directions avoiding enemies from above
- heroEmoji: one emoji that represents the player character (always required as fallback)
- enemyEmoji: one emoji that represents the obstacle/enemy to dodge (always required as fallback)
- heroSpriteId: optional — pick from the hero sprites list above if a good match exists; omit otherwise
- enemySpriteId: optional — pick from the enemy sprites list above if a good match exists; omit otherwise
- bgId: optional — pick from the backgrounds list above if a good match exists; omit otherwise
- backgroundColor: a hex color for the sky/background (make it match the theme; used when no bgId)
- groundColor: always "#5a8a5a" (green ground, used only in runner template)
- title: a fun short game title (max 20 chars)
- speed: a number between 200 and 350 (how fast things move — start reasonable, not too fast)
- jumpForce: always 580

Template examples:
- "dog jumping over cats" → template: "runner" (side-scroll + jump)
- "rocket dodging asteroids" → template: "runner"
- "bunny hopping over carrots" → template: "runner"
- "tank dodging missiles in an arena" → template: "topdown" (4-direction movement)
- "overhead space game" → template: "topdown"
- "mouse avoiding cats" → template: "topdown"
- "arena dodge game" → template: "topdown"
- "bird's eye view" → template: "topdown"
- If the prompt includes "[preferred template: topdown]", lean toward "topdown" unless the description clearly implies jumping/running
- If the prompt includes "[preferred template: runner]", lean toward "runner" unless the description clearly implies overhead/arena movement
- When in doubt, use "runner"

Sprite selection examples:
- "a knight fighting dragons" → heroSpriteId: "hero-knight", enemySpriteId: "enemy-dragon", bgId: "bg-dungeon"
- "space explorer avoiding aliens" → heroSpriteId: "hero-astronaut", enemySpriteId: "enemy-alien", bgId: "bg-space"
- "a wizard dodging bats" → heroSpriteId: "hero-wizard", enemySpriteId: "enemy-bat", bgId: "bg-dungeon"
- "a cat jumping over slimes" → heroSpriteId: "hero-cat", enemySpriteId: "enemy-slime", bgId: "bg-forest"
- "a 🐸 frog" → no sprite match; omit sprite fields, use frog emoji

Respond with ONLY valid JSON, no explanation, no markdown:
{
  "template": "runner",
  "heroEmoji": "🐶",
  "heroSpriteId": "hero-knight",
  "enemyEmoji": "🐱",
  "enemySpriteId": "enemy-dragon",
  "bgId": "bg-dungeon",
  "backgroundColor": "#87CEEB",
  "groundColor": "#5a8a5a",
  "title": "Dog Jump!",
  "speed": 250,
  "jumpForce": 580
}`

const UPDATE_SYSTEM_PROMPT = `${ASSET_CATALOG_BLOCK}

You are a fun game design helper for kids. A kid has an existing game and wants to change something about it.

You will receive:
1. The current game config (JSON)
2. What the kid wants to change

Your job: return the UPDATED config. ONLY change the fields the kid mentioned. Keep everything else EXACTLY the same.

Speed rules (range is 180–600):
- "make it faster" or "faster" → add exactly 75 to current speed (cap at 600)
- "make it harder" or "harder" → add exactly 75 to current speed (cap at 600)
- "make it slower" or "easier" → subtract exactly 75 from current speed (floor at 180)
- Never go above 600 or below 180

Sprite rules:
- "use the knight sprite" or "make the hero a knight" → set heroSpriteId: "hero-knight"
- "use a dragon enemy" → set enemySpriteId: "enemy-dragon"
- "add a space background" or "use the starfield" → set bgId: "bg-space"
- "remove the sprite" or "use emoji" or "go back to emoji" → omit/null the relevant sprite field
- When changing heroEmoji, also clear heroSpriteId (set to null) if the new emoji doesn't match the old sprite
- When changing enemyEmoji, also clear enemySpriteId (set to null) if the new emoji doesn't match the old sprite

Other rules:
- "change the hero to a cat" → update heroEmoji only (and heroSpriteId: "hero-cat" if a cat sprite exists)
- "make the background purple" → update backgroundColor only, and clear bgId
- "switch to top-down" or "make it overhead" → update template to "topdown"
- "switch to runner" or "make it side-scroll" → update template to "runner"
- groundColor: always keep as "#5a8a5a"
- jumpForce: always keep as 580

Respond with ONLY valid JSON of the complete updated config, no explanation, no markdown.`

const DEFAULT_CONFIG: GameConfig = {
  template: 'runner',
  heroEmoji: '🐶',
  enemyEmoji: '🐱',
  backgroundColor: '#87CEEB',
  groundColor: '#5a8a5a',
  title: 'Dog Jump!',
  speed: 250,
  jumpForce: 580,
}


function buildMobileConstraint(mobile: boolean): string {
  if (!mobile) return ''
  return `\n\nOUTPUT TARGET: Mobile (iPad/tablet). Use large emoji sizes (64px+), tap/swipe controls only, no keyboard-only mechanics.`
}

export async function generateGameConfig(
  userPrompt: string,
  currentConfig?: GameConfig,
  mobile = false
): Promise<GameConfig> {
  const isUpdate = !!currentConfig

  try {
    const systemPrompt = (isUpdate ? UPDATE_SYSTEM_PROMPT : CREATE_SYSTEM_PROMPT) + buildMobileConstraint(mobile)

    const userMessage = isUpdate
      ? `Current game config:\n${JSON.stringify(currentConfig, null, 2)}\n\nWhat the kid wants to change: "${userPrompt}"`
      : userPrompt

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 220,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return isUpdate ? currentConfig : DEFAULT_CONFIG

    const config = JSON.parse(content) as GameConfig

    // Clamp speed to full range
    config.speed = Math.max(SPEED_MIN, Math.min(SPEED_MAX, config.speed || 250))
    config.jumpForce = 580 // always fixed
    config.groundColor = '#5a8a5a' // always fixed

    // Validate template — only accept known values
    if (config.template !== 'runner' && config.template !== 'topdown') {
      config.template = isUpdate ? (currentConfig.template ?? 'runner') : 'runner'
    }

    // Validate sprite IDs — strip any hallucinated IDs not in the catalog
    if (config.heroSpriteId  && !ALL_CHARACTER_IDS.has(config.heroSpriteId))  delete config.heroSpriteId
    if (config.enemySpriteId && !ALL_CHARACTER_IDS.has(config.enemySpriteId)) delete config.enemySpriteId
    if (config.bgId          && !ALL_BG_IDS.has(config.bgId))                 delete config.bgId

    // In update mode, fill any missing fields from the current config as safety net
    if (isUpdate) {
      config.heroEmoji = config.heroEmoji || currentConfig.heroEmoji
      config.enemyEmoji = config.enemyEmoji || currentConfig.enemyEmoji
      config.backgroundColor = config.backgroundColor || currentConfig.backgroundColor
      config.title = config.title || currentConfig.title
      config.template = config.template || currentConfig.template || 'runner'
      // Preserve sprite IDs from current config if not explicitly changed
      if (config.heroSpriteId  === undefined && currentConfig.heroSpriteId)  config.heroSpriteId  = currentConfig.heroSpriteId
      if (config.enemySpriteId === undefined && currentConfig.enemySpriteId) config.enemySpriteId = currentConfig.enemySpriteId
      if (config.bgId          === undefined && currentConfig.bgId)          config.bgId          = currentConfig.bgId
    }

    return config
  } catch (error) {
    console.error('Error generating game config:', error)
    return isUpdate ? currentConfig : DEFAULT_CONFIG
  }
}

// ── Game clone code generation ────────────────────────────────────────────────

const CLONE_KEYWORDS = [
  'lander', 'lunar lander', 'flappy', 'flappy bird', 'pong', 'breakout',
  'arkanoid', 'snake', 'asteroids', 'space invader', 'space invaders',
  'tetris', 'platformer', 'mario', 'brick', 'tapper', 'frogger',
  'galaga', 'centipede', 'pacman', 'pac-man', 'clone',
]

export function isCloneRequest(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  return CLONE_KEYWORDS.some(k => lower.includes(k))
}

const CODE_GEN_SYSTEM_PROMPT = `You are an expert Phaser 3 game developer writing games for kids.
Given a game description, write a COMPLETE, WORKING Phaser 3 JavaScript game.

STRICT RULES:
1. Write ONLY JavaScript — no HTML, no <script> tags, no markdown code fences
2. Your code runs via (new Function(code))() in a sandboxed iframe with Phaser 3.70.0 already loaded
3. MUST end with: window.__phaserGame = new Phaser.Game({...})
4. Use EMOJI strings for ALL characters (hero, enemies, obstacles) — no image files
5. Canvas fills the full window: width: window.innerWidth, height: window.innerHeight
6. Scale: mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH
7. Always include: title top-left, score top-right, game-over panel centered
8. Always wire BOTH inputs: keyboard (cursors / SPACE / WASD) AND pointer tap
9. On game over: show score, then restart on SPACE/tap via this.scene.restart()
10. Physics: use update(time, delta) with const dt = delta/1000 — manual integration
11. Target ~200 lines — clean readable code with brief comments
12. audio: { disableWebAudio: true } in Phaser config (iframe sandbox restriction)

EMOJI RENDERING PATTERN (use this exactly):
  this.hero = this.add.text(x, y, '🚀', { fontSize: '48px', fontFamily: 'Arial' }).setOrigin(0.5)

PHYSICS PATTERN (use this for movement):
  // In update:
  this.velY += this.gravity * dt        // gravity accumulation
  this.hero.y += this.velY * dt         // apply velocity
  if (this.hero.y > groundY) { this.hero.y = groundY; this.velY = 0 }

GAME STRUCTURE (follow this class pattern):
  class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }) }
    create() { /* set up all objects, inputs, score text */ }
    update(time, delta) { /* physics, movement, collision, score */ }
    gameOver() { /* show panel, wait for restart */ }
  }
  window.__phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    width: window.innerWidth, height: window.innerHeight,
    scene: [GameScene],
    parent: document.body,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    backgroundColor: '#1a1a2e',
    audio: { disableWebAudio: true },
  })

COLLISION DETECTION (simple AABB):
  function overlaps(a, b, aw, ah, bw, bh) {
    return Math.abs(a.x - b.x) < (aw + bw)/2 && Math.abs(a.y - b.y) < (ah + bh)/2
  }

Respond with ONLY the JavaScript code. No explanation, no code fences.`

export async function generateGameCode(userPrompt: string, mobile = false): Promise<GameCodeResult> {
  const systemPrompt = CODE_GEN_SYSTEM_PROMPT + buildMobileConstraint(mobile)
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 3500,
    })

    const code = completion.choices[0]?.message?.content?.trim() ?? ''

    // Strip accidental markdown fences if model disobeys
    const cleaned = code
      .replace(/^```(?:javascript|js)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim()

    // Extract title from the code (look for a text object with the game title)
    const titleMatch = cleaned.match(/this\.add\.text\([^,]+,\s*[^,]+,\s*['"]([^'"]{1,30})['"]/i)
    const title = titleMatch?.[1] ?? userPrompt.slice(0, 25)

    return { type: 'code', title, code: cleaned }
  } catch (error) {
    console.error('Error generating game code:', error)
    throw error   // let the API route handle this — no silent fallback for code gen
  }
}
