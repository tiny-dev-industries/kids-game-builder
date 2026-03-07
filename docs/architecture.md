# Kids Game Builder — Architecture Reference

> **Purpose:** Research-first doc. Read this before opening source files.
> Last updated: v1.0.3

---

## System Overview

```
Browser
 ├── app/page.tsx          Next.js 15 client — chat UI, settings, sends config
 │    ├── lib/ai.ts        AI prompt construction + OpenAI API call
 │    ├── lib/types.ts     Shared TypeScript interfaces (GameConfig, ShooterConfig…)
 │    └── lib/assets.ts   Asset catalog (HERO_SPRITES, ENEMY_SPRITES, BG_ASSETS)
 └── public/game.html     Sandboxed iframe — Phaser 3 game engine
      ├── RunnerScene      Endless side-scrolling runner
      ├── TopDownScene     4-direction arena avoider
      └── ShooterScene     Top-down combat arena with walls + shooting
```

---

## PostMessage Protocol (page.tsx ↔ game.html)

| Direction | Type | Payload | Effect |
|-----------|------|---------|--------|
| parent → iframe | `LOAD_CONFIG` | `{ config: GameConfig }` | Destroys current scene, starts new one from config |
| parent → iframe | `LOAD_CODE` | `{ code: string }` | Runs custom JS via `new Function(code)()` |
| iframe → parent | `GAME_READY` | `{}` | Updates badge to green 🎮 |
| iframe → parent | `GAME_ERROR` | `{ error: string }` | Updates badge to red ⚠️ |

**URL injection:** Before `postMessage`, `sendConfigToGame()` in `page.tsx` resolves
`heroSpriteId` / `enemySpriteId` / `bgId` → full URLs using `lib/assets.ts` catalog, adding
`heroSpriteUrl`, `enemySpriteUrl`, `bgUrl` fields so `game.html` can load PNG + SVG assets.

---

## GameConfig Interface (`lib/types.ts`)

```typescript
interface GameConfig {
  template: 'runner' | 'topdown' | 'shooter'
  title: string
  heroEmoji: string
  heroSpriteId?: string      // catalog ID (e.g. 'hero-soldier')
  heroSpriteUrl?: string     // resolved URL, injected by page.tsx
  enemyEmoji: string
  enemySpriteId?: string
  enemySpriteUrl?: string
  bgId?: string              // catalog background ID (e.g. 'bg-kenney-dark')
  bgUrl?: string             // resolved URL, injected by page.tsx
  backgroundColor: string   // hex fallback (e.g. '#2d4a2d')
  groundColor: string        // runner only
  speed: number              // 180–600; enemy speed (runner/topdown) or hero speed (shooter)
  jumpForce: number          // runner only
  actions?: GameAction[]     // 0–3 (runner/topdown only — NOT used in shooter)
  difficulty?: GameDifficulty // runner/topdown spawn tuning; shooter uses baked-in ramp
  shooter?: ShooterConfig    // shooter-specific params (see below)
}
```

### ShooterConfig (`lib/types.ts`)

| Field | Default | Range | Notes |
|-------|---------|-------|-------|
| `wallCount` | 6 | 2–16 | Obstacle clusters generated at start |
| `heroHp` | 3 | 1–5 | Player lives (hearts in HUD) |
| `enemyHp` | 2 | 1–4 | Hits to kill one enemy |
| `fireRate` | 500ms | 80–1200 | Hero bullet cooldown |
| `enemyFireRate` | 2000ms | 800–4000 | Base enemy fire cooldown (ramps down over time) |
| `maxEnemies` | 4 | 2–8 | Starting simultaneous enemy count (ramps up) |
| `projectileSpeed` | 450 | 200–700 | Bullet velocity in px/s |
| `grenadeType` | — | 'frag'\|'smoke'\|'flash'\|'slow' | E key to throw; arcs over walls |
| `grenadeCount` | 3 | 0=unlimited | Grenade ammo supply |
| `grenadeCooldown` | 3000ms | ms | Time between throws |
| `fogOfWar` | — | boolean | Dark map, visibility circle around hero |
| `fogRadius` | 180 | px | Visibility circle radius |
| `healthPickups` | true | boolean | Spawn health packs (❤️) in arena |
| `grenadePickups` | true\* | boolean | Spawn grenade ammo packs (\*when grenadeType set) |
| `weaponPickups` | false | boolean | Weapon floor drops (machinegun/shotgun/sniper) |
| `enemyGrenades` | false | boolean | Enemies throw grenades (requires grenadeType) |
| `enemyTypes` | ['grunt'] | array | Mix of: grunt/heavy/scout/sniper |

### GameDifficulty (`lib/types.ts`) — runner/topdown only

| Field | Runner default | TopDown default | Notes |
|-------|---------------|-----------------|-------|
| `spawnDecay` | 8 | 12 | ms/s the spawn interval shrinks |
| `spawnMin` | 900ms | 600ms | Minimum spawn gap |
| `burstChance` | 0.20 | 0.20 | Probability of quick follow-up spawn |
| `fastEnemyChance` | 0.15 | 0.15 | Probability of 1.5× speed enemy |
| `lowObstacleChance` | 0 | n/a | Fraction of spawns requiring duck |
| `lowObstacleEmoji` | '🪵' | n/a | Emoji for low obstacles |

---

## Asset Catalog (`lib/assets.ts`)

**Hero sprites** (10 total): `hero-knight`, `hero-robot`, `hero-cat`, `hero-wizard`,
`hero-astronaut` (SVG) + `hero-blue`, `hero-soldier`, `hero-survivor`, `hero-woman`,
`hero-trooper` (Kenney PNG, top-down overhead)

**Enemy sprites** (9 total): `enemy-dragon`, `enemy-ghost`, `enemy-bat`, `enemy-alien`,
`enemy-slime` (SVG) + `enemy-zombie`, `enemy-hitman`, `enemy-elder`, `enemy-guard`
(Kenney PNG, top-down overhead)

**Backgrounds** (15 total):

| ID | Style | Templates |
|----|-------|-----------|
| `bg-sky`, `bg-forest`, `bg-desert` | Side-scrolling scene | runner |
| `bg-concrete`, `bg-grass-td`, `bg-dungeon`, `bg-wood-floor`, `bg-metal`, `bg-sand-td` | Top-down floor tile SVG | topdown, shooter |
| `bg-kenney-grass`, `bg-kenney-light`, `bg-kenney-dark`, `bg-kenney-teal`, `bg-kenney-sand` | Top-down floor tile PNG (Kenney CC0, 64×64) | topdown, shooter |
| `bg-space` | Starfield | runner, topdown, shooter |

`getCatalogSummary()` — returns formatted string injected into every AI system prompt.

---

## ShooterScene Deep Reference (`public/game.html`, lines ~884–1548)

### Key Constants (set in `create()` from `config.shooter`)
```
HERO_RADIUS = 18      ENEMY_RADIUS = 18 (default, per-enemy via e.radius)
BULLET_RADIUS = 6     HERO_SPEED = 220   PROJ_SPEED = 450   FIRE_RATE = 500ms
HERO_HP = 3           ENEMY_HP = 2       MAX_ENEMIES = 4    WALL_COUNT = 6
ENEMY_FR_BASE = 2000ms                   W = 480            H = 640
ENEMY_TYPES = ['grunt']   ETYPE_STATS = { grunt, heavy, scout, sniper }
```

### Data Structures
```javascript
walls[]          = [{ x, y, w, h, obj }]
bullets[]        = [{ x, y, vx, vy, fromEnemy, damage, obj }]
enemies[]        = [{ x, y, hp, maxHp, eType, radius, state, patrolZone, patrolDir,
                      patrolAxis, patrolSpeed, alertSpeed, shootsBack, frMult,
                      shootTimer, grenadeTimer, lastFacingX, lastFacingY,
                      blindedUntil, hpBar, obj }]
grenades[]       = [{ x, y, vx, vy, fuse, fuseMax, obj, shadow, fromEnemy }]
smokeZones[]     = [{ x, y, r, until, obj }]       // r=80px, 8s duration
pickups[]        = [{ x, y, type, obj, labelObj, respawnAt }]  // 'health'|'grenade'
weaponPickupObjs[]= [{ x, y, weaponId, obj, labelObj, respawnAt }]
```

### Enemy Type Stats (ETYPE_STATS)
| Type | HP | Radius | AlertSpd | PatrolSpd | Scale | Tint | Shoots | FireRateMult |
|------|----|--------|----------|-----------|-------|------|--------|--------------|
| grunt | ENEMY_HP | 16 | 95 | 55–90 | 1.0 | — | yes | 1.0 |
| heavy | ENEMY_HP×2 | 20 | 65 | 35–50 | 1.3 | 0xcc8844 | yes | 1.5 |
| scout | 1 | 13 | 140 | 80–110 | 0.8 | — | no | — |
| sniper | ENEMY_HP+1 | 16 | 50 | 30–50 | 1.0 | 0x8888ff | yes | 0.5 |

### Wall Generation (`generateWalls`)
**Zoned layout algorithm (v1.0.3):**
- `WALL_COUNT ≥ 4`: Center T-shape anchor always placed (90–120w horizontal + 50–80h stem)
- `WALL_COUNT ≥ 8`: 1 cluster per quadrant (TL/TR/BL/BR) for guaranteed coverage
- Remaining slots: random placement (3 types: horizontal/vertical/L-shape)
- All slots avoid center spawn zone (110px radius)

### Wall Collision (`resolveWallCollision(cx, cy, r)`)
Returns `{ x, y }` with circle pushed out of any overlapping wall AABB using nearest-point
push. Final position clamped to canvas bounds. Called by hero, all enemy states, and
**must be called** after patrol movement (was missing pre-v1.0.1).

### Line of Sight (`hasLOS(x1, y1, x2, y2)`)
Parametric segment–AABB slab test. Returns `true` if path is clear, `false` if any wall
intersects. Used by:
- Enemies: `patrol→alert` transition (`dist < 280 && hasLOS`)
- Enemies: `shoot→alert` fallback (`!hasLOS`)
- `findCoverPoint()`: prefers positions where `!hasLOS(hero, coverPt)`
- Smoke zones: segment-vs-circle test at end of `hasLOS()` — any active smoke zone in path returns false

### Projectile System
```
spawnBullet(x, y, vx, vy, fromEnemy, damage)  → adds to bullets[] (damage default 1)
updateBullets(dt)                              → moves all bullets; checks wall/hero/enemy hit
splatEffect(x, y, color)                      → small colored dot tween on impact
tryHeroShoot(targetX, targetY)                 → dispatches on currentWeapon:
  pistol:     1 bullet straight, FIRE_RATE cooldown
  machinegun: 1 bullet straight, 100ms cooldown
  shotgun:    5 bullets ±20° fan, 700ms cooldown, 1 damage each
  sniper:     1 bullet 1.8× speed, 1000ms cooldown, 3 damage
```
Bullets: hero = blue (0x33aaff), enemy = red (0xff4433). `b.damage` used in `enemyTakeHit(e, b.damage)`.

### Enemy AI State Machine (`updateEnemy(e, dt)`)

```
         dist < 280 && LOS          dist < 150 && LOS
  patrol ──────────────→ alert ──────────────────→ shoot
    ↑        dist > 380 || !LOS ←──── !LOS || dist > 240
    │
    └───← cover (reached target || no cover found)
              ↑
    hp < max && random < 0.008 per frame
```

| State | Speed | Behavior |
|-------|-------|----------|
| `patrol` | e.patrolSpeed (55–90) | Bounces within `patrolZone` on random axis |
| `alert` | e.alertSpeed (50–140) | Moves toward hero (speed varies by enemy type) |
| `shoot` | 0 | Stationary; fires at `currentEnemyFireRate × e.frMult`; scouts skip this state |
| `cover` | 110 | Moves to `coverTarget` (wall edge not visible to hero) |

`findCoverPoint()` samples wall edges → returns point where `!hasLOS(hero, pt)`.

**Blinded state** (flashbang): `if (now < e.blindedUntil)` at top of `updateEnemy()` →
wander randomly at 55px/s, skip all LOS checks, occasionally pick new random direction (2% chance/frame).

### Difficulty Ramp (`updateDifficultyRamp(delta)`)
- Every 30s: enemy fire rate -= 200ms (floor 800ms)
- Every 60s: maxEnemies += 1 (cap 8); spawns one new enemy

### Update Loop Order
1. Early-exit if `isGameOver`
2. `dt = delta / 1000`; `gameDt = dt × 0.25` if `slowUntil` active
3. `updateDifficultyRamp(delta)`
4. Aim tracking → hero rotation → gun indicator dot
5. Hero movement (inverted if `heroDisorientedUntil` active from flashbang) → `resolveWallCollision()`
6. Hero shoot input (SPACE / mouse held) — dispatches via `currentWeapon`
7. `updateEnemy(e, gameDt)` for each enemy → also draws hpBar each frame
8. `updateBullets(gameDt)` — uses `e.radius` for collision, `b.damage` for HP reduction
9. `updateGrenades(dt)` — if GRENADE_TYPE; enemy grenades thrown from `updateEnemy()` shoot state
10. `updateFog()` — if FOG_OF_WAR
11. `updatePickups()` — health/grenade pickup collection + respawn
12. `updateWeaponPickups()` — if WEAPON_PICKUPS; weapon floor drop collection + respawn + banner

### Depth Layers (Phaser `setDepth`)
| Depth | Object |
|-------|--------|
| -2 | Background tile sprite |
| -1 | Checkerboard floor graphics |
| 0 | Arena border |
| 3 | Walls |
| 4 | Enemy sprites |
| 5 | Hero sprite |
| 6 | Hero gun indicator + grenade shadows |
| 7 | Pickup circles |
| 8 | Pickup labels + weapon pickup circles |
| 8 | Bullets |
| 9 | Grenade objects + splat effects |
| 11 | Smoke zones |
| 12 | Enemy HP bars |
| 20 | Frag explosion rings |
| 51 | Slow-mo blue overlay |
| 52 | Fog of war overlay |
| 53 | Flash disorientation yellow tint |
| 56 | **All HUD elements** (score, hearts, grenade counter, title, hint) |
| 57 | Weapon pickup banners |
| 100 | Flashbang white overlay |

### Background Rendering
- With `bgUrl` / `bgId`: `add.tileSprite(W/2, H/2, W, H, 'bg-tile')` — scrolls or tiles
- Without: checkerboard of 56×56 alternating tiles (+22 brightness on every other tile)

### Audio (`createSounds()` — Web Audio API)
`sounds.shoot()`, `sounds.hit()`, `sounds.gameOver()`, `sounds.jump()`, `sounds.land()`, `sounds.score()`

---

## RunnerScene Deep Reference (`public/game.html`, lines ~380–650)

Key behavior: hero jumps over/ducks under enemies scrolling right→left.
- Hero: fixed x=120, `GROUND_Y - 10`; jump with SPACE/tap; duck with DOWN/tap-bottom
- Enemies: spawn right edge, move left at `config.speed`; low obstacles at `GROUND_Y - 50`
- Collision: AABB hero box vs enemy box; duck box = 22×22 (vs normal 44×44)
- Background: `tileSprite` scrolling at 0.4× enemy speed (parallax)
- Score: increments every 150ms while alive

---

## TopDownScene Deep Reference (`public/game.html`, lines ~650–870)

Key behavior: hero moves in all 4 directions, enemies swarm from edges.
- Hero: WASD/arrows; touch = hold pointer and hero moves toward it
- Enemies: spawn at canvas edges, move toward hero at `config.speed`
- Collision: circle–circle distance check
- Background: `tileSprite` static floor

---

## AI Prompt Structure (`lib/ai.ts`)

Two prompts: `CREATE_SYSTEM_PROMPT` (new game) and `UPDATE_SYSTEM_PROMPT` (change existing).

Both prompts include (in order):
1. `getCatalogSummary()` — available sprites + backgrounds
2. Template classification rules
3. Style/theme vocabulary mappings
4. Shooter-specific rules (template === 'shooter')
5. Background selection by template (runner=side-scroll, topdown/shooter=floor tiles)
6. Sprite + background combos
7. Difficulty + actions rules
8. Full GameConfig JSON schema + example
9. Update-specific delta rules (UPDATE prompt only)

**Key AI vocabulary in shooter context:**
```
"paintball"              → hero-soldier + enemy-guard + bg-concrete
"outdoor paintball"      → hero-survivor + enemy-guard + bg-grass-td
"laser tag"              → hero-trooper + enemy-hitman + bg-kenney-teal
"zombie shooter"         → hero-soldier + enemy-zombie + bg-kenney-dark
"rapid fire"             → fireRate: 100
"faster shooting"        → fireRate: 200
"more walls"             → wallCount += 2
"more enemies"           → maxEnemies += 1
"tougher enemies"        → enemyHp += 1
⏳ "grenades"            → grenadeType: 'frag'
⏳ "smoke grenades"      → grenadeType: 'smoke'
⏳ "flashbang"           → grenadeType: 'flash'
⏳ "slow motion"         → grenadeType: 'slow'
⏳ "fog of war"          → fogOfWar: true
```

---

## Actions System (`public/game.html` — ActionSystem object)

Used in **runner + topdown only** (not shooter). The `ActionSystem` module provides:

| Type | Trigger phrase | Behavior |
|------|---------------|----------|
| `collectible` | "stars", "coins", "collect" | Spawns bonus-point pickups |
| `lives` | "lives", "hearts", "3 lives" | Multi-life HUD with invincibility flash |
| `shield` | "shield", "protection" | Periodic 🛡️ pickup absorbs one hit |
| `double-points` | "2×", "double points" | Timed score multiplier burst |
| `enemy-explode` | "explode", "burst" | Enemies flash+tween on collision |
| `speed-ramp` | "speed up over time" | Auto-accelerates every 10s |

---

## File Map

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main React client — chat, settings, postMessage, all UI components |
| `app/api/generate-game/route.ts` | API route — calls OpenAI, returns GameResult |
| `lib/ai.ts` | System prompts, vocab rules, `generateGameConfig()`, `generateGameCode()` |
| `lib/types.ts` | TypeScript interfaces: GameConfig, ShooterConfig, GameDifficulty, GameAction |
| `lib/assets.ts` | Asset catalog, `getCatalogSummary()`, `getCharacterById()`, `getBackgroundById()` |
| `public/game.html` | Phaser 3 game engine — RunnerScene, TopDownScene, ShooterScene, ActionSystem |
| `public/assets/characters/` | Sprite images (SVG + PNG) |
| `public/assets/backgrounds/` | Background tiles (SVG + PNG) |
| `features.md` | Feature registry by milestone — **read this first** |
| `scenarios.md` | "Can We Build It?" tracker — what game prompts work |
| `bugs.md` | Known issues |
| `docs/architecture.md` | This file — technical internals reference |
| `CHANGELOG.md` | Version history |
