import OpenAI from 'openai'
import { GameConfig, SPEED_MIN, SPEED_MAX, GameCodeResult } from './types'
import { getCatalogSummary, ALL_CHARACTER_IDS, ALL_BG_IDS } from './assets'

export type { GameConfig }
export { SPEED_MIN, SPEED_MAX }

// Build once at module load — injected into both AI system prompts
const ASSET_CATALOG_BLOCK = getCatalogSummary()

const VALID_ACTION_TYPES = new Set([
  'collectible', 'lives', 'shield', 'double-points', 'enemy-explode', 'speed-ramp',
])

const ACTIONS_BLOCK = `
ACTIONS (optional array of 0–3 game-event behaviors stored in "actions" field):
Each action: { "id": string, "type": ActionType, "name": string, "description": string, "emoji": string, "params"?: {...} }
Action types:
  "collectible"   — spawns pickup items players can collect for bonus points. params: { spawnEmoji, points, spawnInterval }
  "lives"         — player gets multiple lives; collision costs 1 life instead of instant game over. params: { count }
  "shield"        — a shield power-up (🛡️) spawns periodically; collecting it absorbs 1 hit. params: { duration, shieldInterval }
  "double-points" — periodic ⚡ 2x score burst intervals appear. params: { multiplier, doubleDuration, doubleInterval }
  "enemy-explode" — enemies visually burst on collision (works best with lives action). No params needed.
  "speed-ramp"    — game auto-accelerates over time. params: { increment, maxSpeed }
Rules: max 3 actions total. Each id must be unique (e.g. "action-lives", "action-stars"). Omit actions for simple games.
Examples:
  "knight vs dragons" → "actions": [{"id":"action-lives","type":"lives","name":"3 Lives","description":"You have 3 lives before game over!","emoji":"❤️","params":{"count":3}},{"id":"action-explode","type":"enemy-explode","name":"Dragon Burst","description":"Dragons explode in flames when you collide!","emoji":"💥"}]
  "star collector"    → "actions": [{"id":"action-stars","type":"collectible","name":"Collect Stars","description":"Stars appear and give bonus points!","emoji":"⭐","params":{"spawnEmoji":"⭐","points":5,"spawnInterval":4000}}]
  "simple dog game"   → "actions": []`

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const CREATE_SYSTEM_PROMPT = `${ASSET_CATALOG_BLOCK}
${ACTIONS_BLOCK}

You are a fun game design helper for kids. A kid will describe a game idea and you will turn it into a game config.

Your job: pick the best emojis, colors, template, AND sprites that match their description.

Rules:
- template: "runner" for side-scrolling games where the hero jumps over enemies; "topdown" for games where the player moves in all 4 directions avoiding enemies from above; "platformer" for games where the hero moves freely left/right, jumps between elevated platforms, and stomps enemies by landing on them
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
- "dog jumping over cats" → template: "runner" (side-scroll + jump OVER enemies)
- "rocket dodging asteroids" → template: "runner"
- "bunny hopping over carrots" → template: "runner"
- "frog jumping on lily pads stomping flies" → template: "platformer" (multi-platform + stomp)
- "mario-style platformer" → template: "platformer"
- "knight jumping between platforms stomping goblins" → template: "platformer"
- "cat jumping on clouds stomping birds" → template: "platformer"
- "tank dodging missiles in an arena" → template: "topdown" (4-direction movement)
- "overhead space game" → template: "topdown"
- "mouse avoiding cats" → template: "topdown"
- "arena dodge game" → template: "topdown"
- "bird's eye view" → template: "topdown"
- "paintball battle" → template: "shooter" (top-down combat, walls, shooting)
- "laser tag arena" → template: "shooter"
- "arena shooter with obstacles" → template: "shooter"
- If the prompt includes "[preferred template: topdown]", lean toward "topdown" unless the description clearly implies jumping/running
- If the prompt includes "[preferred template: runner]", lean toward "runner" unless the description clearly implies overhead/arena movement
- If the prompt includes "[preferred template: platformer]", use "platformer"
- KEY DISTINCTION: "jumping OVER enemies" = runner; "jumping ON TOP OF / STOMPING enemies on platforms" = platformer
- When in doubt, use "runner"

Platformer template rules (only when template === "platformer"):
- Include an optional "platformer" sub-object: { doubleJump?: boolean }
- doubleJump: true → hero can jump a second time in mid-air
- Platformer vocabulary:
  - "platformer", "mario", "super mario", "platform game", "jump on platforms" → template: "platformer"
  - "stomp enemies", "jump on enemies", "squish enemies", "jump on top of" → template: "platformer"
  - "double jump", "can double jump", "mid-air jump" → platformer: { doubleJump: true }
- speed: hero horizontal movement speed (150–280 is comfortable; default 200)
- jumpForce: always 630 for platformer (or 580–680 range)
- actions: omit for platformer (not supported in M11)
- groundColor: "#5a8a5a" always
- Background: use side-scrolling backgrounds (bg-sky, bg-forest, bg-desert, bg-space) — same as runner

Vocabulary: detect these styles from the user's words and apply automatically:
- "obstacle course", "obstacles", "hurdles", "hurdle", "parkour", "obstacle run" →
    template: "runner", speed 260–300, ALWAYS include speed-ramp action, and set difficulty: { spawnDecay: 12, spawnMin: 750, burstChance: 0.3, fastEnemyChance: 0.2, lowObstacleChance: 0.3, lowObstacleEmoji: "🔥" }
- "duck", "ducking", "crouch", "crouching", "dodge", "slide", "sliding under" →
    template: "runner", and set difficulty: { lowObstacleChance: 0.35, lowObstacleEmoji: "🔥" } (floating overhead hazard — NOT an animal emoji)
- "collecting", "collector", "collect", "gathering", "pick up", "gatherer" →
    add collectible action with an emoji matching the theme (stars ⭐, coins 🪙, gems 💎, fish 🐟, etc.)
- "top-down", "overhead", "arena", "dodge in all directions", "4 directions", "top down", "bird's eye", "maze" →
    template: "topdown"
- "paintball", "paintball battle", "shooting game", "arena shooter", "laser tag", "combat arena", "battle arena", "tag game", "shoot enemies", "shoot at" →
    template: "shooter"
- "shooter" + "lots of cover" or "maze-like" → template: "shooter", shooter: { wallCount: 10 }
- "shooter" + "tough enemies" or "hard enemies" → template: "shooter", shooter: { enemyHp: 3, enemyFireRate: 1500 }
- "shooter" + "lots of enemies" → template: "shooter", shooter: { maxEnemies: 6 }

Shooter template rules (only when template === "shooter"):
- Include an optional "shooter" sub-object with these optional params: { wallCount, heroHp, enemyHp, fireRate, enemyFireRate, maxEnemies, projectileSpeed, grenadeType, grenadeCount, grenadeCooldown, fogOfWar, fogRadius, healthPickups, grenadePickups, weaponPickups, enemyGrenades, enemyTypes }
- Default shooter config (omit field for default): wallCount=6, heroHp=3, enemyHp=2, fireRate=500, enemyFireRate=2000, maxEnemies=4, projectileSpeed=450
- Grenade types (E key to throw, arcs over walls, timer-based detonation):
  - grenadeType:"frag" → explosion blast radius, damages enemies (default grenadeCount:3)
  - grenadeType:"smoke" → smoke cloud blocks enemy LOS for 8s (default grenadeCount:3)
  - grenadeType:"flash" → flashbang blinds nearby enemies 3s, white screen flash (default grenadeCount:3)
  - grenadeType:"slow" → slow-motion: enemies+bullets at 0.25× speed for 4s (default grenadeCount:3)
  - grenadeCount:0 → unlimited grenades; grenadeCooldown (ms between throws, default 3000)
- fogOfWar:true → dark map with visibility circle around hero; fogRadius (px, default 180)
- Grenade vocabulary:
  - "grenades" / "throw grenades" / "throwable" → grenadeType:"frag", grenadeCount:3
  - "smoke" / "smoke grenades" / "smoke bombs" → grenadeType:"smoke"
  - "flashbang" / "flash grenades" / "blind enemies" → grenadeType:"flash"
  - "slow motion" / "bullet time" / "time slow" / "time grenade" → grenadeType:"slow"
  - "unlimited grenades" / "infinite grenades" → grenadeCount:0
  - "fog of war" / "limited visibility" / "dark map" / "can't see enemies" → fogOfWar:true
  - "small vision" / "tight visibility" → fogOfWar:true, fogRadius:120
- Great combos: zombie fog of war → fogOfWar:true + grenadeType:"flash"; stealth → fogOfWar:true + grenadeType:"smoke"
- Pickup vocabulary:
  - "health packs" / "medkits" / "health pickups" → healthPickups:true (default true; omit for default)
  - "no health packs" / "no healing" → healthPickups:false
  - "weapon pickups" / "grab weapons" / "weapon drops" / "pick up guns" → weaponPickups:true
  - "grenade pickups" / "ammo resupply" → grenadePickups:true (also requires grenadeType to be set)
- Enemy grenades vocabulary (requires grenadeType to be set):
  - "enemies throw grenades" / "enemy grenades" / "enemies have grenades" → enemyGrenades:true
- Enemy type vocabulary:
  - "mixed enemies" / "different enemy types" / "enemy variety" → enemyTypes:["grunt","heavy","scout"]
  - "heavy enemies" / "tank enemies" / "armored enemies" / "tough enemies with guns" → enemyTypes:["grunt","heavy"]
  - "fast enemies" / "scouts" / "quick enemies" / "speedy enemies" → enemyTypes:["grunt","scout"]
  - "sniper enemies" / "long range enemies" / "enemies that hang back" → enemyTypes:["grunt","sniper"]
  - "all enemy types" / "full variety" / "every enemy type" → enemyTypes:["grunt","heavy","scout","sniper"]
- ALWAYS assign heroSpriteId and enemySpriteId for shooter games — human/realistic sprites look far better than emoji in top-down combat
- Default shooter sprite assignment (use when no specific theme is given): heroSpriteId: "hero-soldier", enemySpriteId: "enemy-hitman", bgId: "bg-kenney-dark"
- "paintball" theme → heroSpriteId: "hero-soldier", enemySpriteId: "enemy-guard", heroEmoji: "🧑", enemyEmoji: "🎭", bgId: "bg-concrete", backgroundColor: "#5a5a5a"
- "outdoor paintball" theme → heroSpriteId: "hero-survivor", enemySpriteId: "enemy-guard", heroEmoji: "🧑", enemyEmoji: "🎭", bgId: "bg-grass-td", backgroundColor: "#3d6d30"
- "laser tag" theme → heroSpriteId: "hero-trooper", enemySpriteId: "enemy-hitman", heroEmoji: "🤖", enemyEmoji: "👾", bgId: "bg-kenney-teal", backgroundColor: "#1a2a3a"
- "zombie shooter" theme → heroSpriteId: "hero-soldier", enemySpriteId: "enemy-zombie", heroEmoji: "🧑", enemyEmoji: "🧟", bgId: "bg-kenney-dark", backgroundColor: "#1a1a1a"
- "space battle" theme → heroSpriteId: "hero-trooper", enemySpriteId: "enemy-alien", heroEmoji: "🚀", enemyEmoji: "👽", bgId: "bg-space", backgroundColor: "#0a0a1e"
- "castle/knight" theme → heroSpriteId: "hero-knight", enemySpriteId: "enemy-dragon", bgId: "bg-dungeon"
- "wood/indoor" theme → bgId: "bg-wood-floor", backgroundColor: "#6a4a1a"
- "desert/sand" theme → heroSpriteId: "hero-survivor", enemySpriteId: "enemy-guard", bgId: "bg-kenney-sand", backgroundColor: "#9a7840"

Background selection by template (IMPORTANT — pick bgId that matches the view):
- Runner games (side-scrolling): use bg-sky, bg-forest, bg-desert, bg-space; NEVER use bg-concrete, bg-grass-td, bg-wood-floor, bg-metal, bg-sand-td, bg-kenney-*
- Top-Down + Shooter games (floor tiles): prefer bg-concrete (urban/indoor), bg-grass-td (outdoor), bg-dungeon (castle/fantasy), bg-metal (sci-fi), bg-sand-td (desert), bg-wood-floor (indoor/warm); also consider bg-kenney-grass (bright outdoor), bg-kenney-light (clean indoor), bg-kenney-dark (gritty/industrial), bg-kenney-teal (sci-fi/clean), bg-kenney-sand (warm/sandy)
- bg-space works for any template

Sprite + background combos:
- "a knight fighting dragons" → heroSpriteId: "hero-knight", enemySpriteId: "enemy-dragon", bgId: "bg-dungeon"
- "space explorer avoiding aliens" (runner) → heroSpriteId: "hero-astronaut", enemySpriteId: "enemy-alien", bgId: "bg-space"
- "space shooter" → heroSpriteId: "hero-trooper", enemySpriteId: "enemy-alien", bgId: "bg-kenney-teal", backgroundColor: "#0a1a2a"
- "a wizard dodging bats" → heroSpriteId: "hero-wizard", enemySpriteId: "enemy-bat", bgId: "bg-dungeon"
- "a cat jumping over slimes" (runner) → heroSpriteId: "hero-cat", enemySpriteId: "enemy-slime", bgId: "bg-forest"
- "robot shooter" → heroSpriteId: "hero-trooper", enemySpriteId: "enemy-hitman", bgId: "bg-kenney-dark"
- "soldier shooter" / "military shooter" → heroSpriteId: "hero-soldier", enemySpriteId: "enemy-guard", bgId: "bg-kenney-dark"
- "zombie survival shooter" → heroSpriteId: "hero-survivor", enemySpriteId: "enemy-zombie", bgId: "bg-kenney-dark"
- "a 🐸 frog" → no sprite match; omit sprite fields, use frog emoji

Difficulty (optional "difficulty" field — omit entirely for normal games):
- "easy", "for young kids", "very easy", "simple" →
    difficulty: { spawnDecay: 4, spawnMin: 1300, burstChance: 0.05, fastEnemyChance: 0 }
- "hard", "challenging", "difficult", "very hard", "intense" →
    difficulty: { spawnDecay: 15, spawnMin: 700, burstChance: 0.35, fastEnemyChance: 0.25 }
- "obstacle course", "hurdles", "parkour" →
    difficulty: { spawnDecay: 12, spawnMin: 750, burstChance: 0.3, fastEnemyChance: 0.2, lowObstacleChance: 0.3, lowObstacleEmoji: "🪨" }
- default (no difficulty modifiers in description) → omit difficulty field entirely

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
  "jumpForce": 580,
  "actions": []
}`

const UPDATE_SYSTEM_PROMPT = `${ASSET_CATALOG_BLOCK}
${ACTIONS_BLOCK}

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
- "make the hero a soldier" → set heroSpriteId: "hero-soldier"
- "make enemies zombies" → set enemySpriteId: "enemy-zombie"
- "make the hero a robot" or "trooper" → set heroSpriteId: "hero-trooper"
- "make enemies hitmen" or "assassins" → set enemySpriteId: "enemy-hitman"
- "add a space background" or "use the starfield" → set bgId: "bg-space"
- "dark floor" or "industrial floor" → set bgId: "bg-kenney-dark"
- "teal floor" or "sci-fi floor" → set bgId: "bg-kenney-teal"
- "remove the sprite" or "use emoji" or "go back to emoji" → omit/null the relevant sprite field
- When changing heroEmoji, also clear heroSpriteId (set to null) if the new emoji doesn't match the old sprite
- When changing enemyEmoji, also clear enemySpriteId (set to null) if the new emoji doesn't match the old sprite

Other rules:
- "change the hero to a cat" → update heroEmoji only (and heroSpriteId: "hero-cat" if a cat sprite exists)
- "make the background purple" → update backgroundColor only, and clear bgId
- "switch to top-down" or "make it overhead" → update template to "topdown"
- "switch to runner" or "make it side-scroll" → update template to "runner"
- "switch to shooter" or "make it a shooting game" or "add shooting" → update template to "shooter"
- "switch to platformer" or "make it a platformer" or "add platforms" → update template to "platformer"
- "add double jump" → set platformer: { doubleJump: true }
- "remove double jump" → set platformer: { doubleJump: false }

Shooter template update rules (only when template === "shooter"):
- "more walls", "more cover", "more obstacles" → increase shooter.wallCount by 2 (max 16)
- "fewer walls", "open arena" → decrease shooter.wallCount by 2 (min 2)
- "faster shooting" → set shooter.fireRate: 200
- "rapid fire", "very fast fire" → set shooter.fireRate: 100
- "slower shooting" → set shooter.fireRate: 800
- "tougher enemies", "harder enemies" → increase shooter.enemyHp by 1 (max 4)
- "easier enemies", "easier" → set shooter.enemyFireRate: 3000
- "more enemies" → increase shooter.maxEnemies by 1 (max 8)
- "fewer enemies" → decrease shooter.maxEnemies by 1 (min 2)
- "add grenades" / "grenades" → set shooter.grenadeType: "frag", shooter.grenadeCount: 3
- "add smoke grenades" / "smoke" → set shooter.grenadeType: "smoke"
- "add flashbangs" / "flashbang" → set shooter.grenadeType: "flash"
- "add slow motion" / "bullet time" → set shooter.grenadeType: "slow"
- "unlimited grenades" → set shooter.grenadeCount: 0
- "remove grenades" → set shooter.grenadeType: null
- "add fog of war" / "fog of war" / "dark map" → set shooter.fogOfWar: true
- "remove fog" / "no fog" → set shooter.fogOfWar: false
- "smaller vision" / "tighter fog" → set shooter.fogRadius: 120
- "bigger vision" / "wider sight" → set shooter.fogRadius: 240
- "add health pickups" / "add medkits" / "add health packs" → set shooter.healthPickups: true
- "remove health pickups" / "no health packs" / "no healing" → set shooter.healthPickups: false
- "add weapon pickups" / "weapon drops" / "pick up weapons" / "grab guns" → set shooter.weaponPickups: true
- "remove weapon pickups" / "no weapon drops" → set shooter.weaponPickups: false
- "give enemies grenades" / "enemies throw grenades" / "enemy grenades" → set shooter.enemyGrenades: true
- "remove enemy grenades" / "no enemy grenades" → set shooter.enemyGrenades: false
- "add heavy enemies" / "tank enemies" / "armored enemies" → set shooter.enemyTypes: ["grunt","heavy"]
- "add fast enemies" / "add scouts" / "speedy enemies" → set shooter.enemyTypes: ["grunt","scout"]
- "add snipers" / "sniper enemies" / "long range enemies" → set shooter.enemyTypes: ["grunt","sniper"]
- "all enemy types" / "mixed enemies" / "full enemy variety" → set shooter.enemyTypes: ["grunt","heavy","scout","sniper"]
- "reset enemy types" / "normal enemies" / "only grunts" → set shooter.enemyTypes: ["grunt"]
- Always preserve shooter fields not mentioned by the kid
- groundColor: always keep as "#5a8a5a"
- jumpForce: always keep as 580

Actions rules for updates:
- "add extra lives" or "give me 3 lives" → add/replace lives action
- "add collectible stars" or "add coins" → add/replace collectible action with matching emoji
- "add a shield power-up" → add/replace shield action
- "make it auto speed up" → add/replace speed-ramp action
- "remove [action name]" or "remove all actions" → remove matching action(s) from array
- "add double points" → add/replace double-points action
- Always preserve actions not mentioned by the kid

Difficulty update rules (update or add "difficulty" field):
- "make it harder", "too easy", "more enemies" → increase spawnDecay by ~5, decrease spawnMin by ~150, increase burstChance by 0.1
- "make it easier", "too hard", "fewer enemies" → decrease spawnDecay by ~4, increase spawnMin by ~200, decrease burstChance by 0.1
- "make it more varied", "too repetitive", "more variety" → increase burstChance by 0.1, increase fastEnemyChance by 0.1
- "reset difficulty", "normal difficulty" → remove difficulty field entirely (set to null/undefined)
- "add duck obstacles", "add low obstacles", "add things to duck under", "add crouch mechanic", "add sliding obstacles" → set difficulty.lowObstacleChance: 0.3 (and lowObstacleEmoji matching theme — pick something that looks like an OVERHEAD hazard, NOT an animal: e.g. "🔥" fire wall, "⚡" lightning, "🏹" arrow, "🌿" low branch, "🪨" falling rock, "🔱" beam)
- "remove duck obstacles", "remove low obstacles", "no duck" → set difficulty.lowObstacleChance: 0
- Keep values in bounds: spawnDecay 2–20, spawnMin 500–1600, burstChance 0–0.4, fastEnemyChance 0–0.3, lowObstacleChance 0–0.6
- Preserve existing difficulty values not mentioned

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
      max_tokens: 900,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return isUpdate ? currentConfig : DEFAULT_CONFIG

    const config = JSON.parse(content) as GameConfig

    // Clamp speed to full range
    config.speed = Math.max(SPEED_MIN, Math.min(SPEED_MAX, config.speed || 250))
    // jumpForce: 630 for platformer (higher arc needed), 580 for all other templates
    config.jumpForce = config.template === 'platformer' ? 630 : 580
    config.groundColor = '#5a8a5a' // always fixed

    // Validate template — only accept known values
    const VALID_TEMPLATES = new Set(['runner', 'topdown', 'shooter', 'platformer'])
    if (!VALID_TEMPLATES.has(config.template)) {
      config.template = isUpdate ? (currentConfig.template ?? 'runner') : 'runner'
    }

    // Validate and clamp shooter sub-config fields
    if (config.shooter && typeof config.shooter === 'object') {
      const s = config.shooter
      if (s.wallCount       != null) s.wallCount       = Math.max(2,   Math.min(16,   s.wallCount))
      if (s.heroHp          != null) s.heroHp           = Math.max(1,   Math.min(5,    s.heroHp))
      if (s.enemyHp         != null) s.enemyHp          = Math.max(1,   Math.min(4,    s.enemyHp))
      if (s.fireRate        != null) s.fireRate         = Math.max(80,  Math.min(1200, s.fireRate))
      if (s.enemyFireRate   != null) s.enemyFireRate    = Math.max(800, Math.min(4000, s.enemyFireRate))
      if (s.maxEnemies      != null) s.maxEnemies       = Math.max(2,   Math.min(8,    s.maxEnemies))
      if (s.projectileSpeed != null) s.projectileSpeed  = Math.max(200, Math.min(700,  s.projectileSpeed))
    }

    // Validate sprite IDs — strip any hallucinated IDs not in the catalog
    if (config.heroSpriteId  && !ALL_CHARACTER_IDS.has(config.heroSpriteId))  delete config.heroSpriteId
    if (config.enemySpriteId && !ALL_CHARACTER_IDS.has(config.enemySpriteId)) delete config.enemySpriteId
    if (config.bgId          && !ALL_BG_IDS.has(config.bgId))                 delete config.bgId

    // Validate actions — strip unknown types, enforce max 3, ensure required fields
    if (Array.isArray(config.actions)) {
      config.actions = config.actions
        .filter(a => a && a.id && typeof a.id === 'string' && VALID_ACTION_TYPES.has(a.type))
        .slice(0, 3)
      if (config.actions.length === 0) delete config.actions
    } else {
      delete config.actions
    }

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
      // Preserve actions from current config if AI returned none/undefined
      if (!config.actions && currentConfig.actions?.length) {
        config.actions = currentConfig.actions
      }
      // Preserve difficulty from current config if AI didn't change it
      // (null means AI explicitly removed it; undefined means AI didn't mention it)
      if (config.difficulty === undefined && currentConfig.difficulty) {
        config.difficulty = currentConfig.difficulty
      }
      if (config.difficulty === null) delete config.difficulty
      // Preserve shooter config from current config if AI didn't change it
      if (config.shooter === undefined && currentConfig.shooter) {
        config.shooter = currentConfig.shooter
      }
      if ((config.shooter as unknown) === null) delete config.shooter
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
  'tetris', 'mario', 'brick', 'tapper', 'frogger',
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
