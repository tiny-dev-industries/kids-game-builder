export type ActionType =
  | 'collectible'    // spawn collectible items for bonus points
  | 'lives'          // multiple lives instead of instant game over
  | 'shield'         // periodic shield power-up spawns
  | 'double-points'  // timed score-doubling bonus intervals
  | 'enemy-explode'  // enemies flash+burst on collision (visual, costs a life)
  | 'speed-ramp'     // game accelerates automatically over time

export interface GameAction {
  id: string           // unique — e.g. 'action-lives'
  type: ActionType
  name: string         // display name — e.g. "3 Lives"
  description: string  // short description for UI card
  emoji: string        // display emoji — e.g. "❤️"
  params?: {
    // collectible
    spawnEmoji?: string       // default '⭐'
    points?: number           // default 5
    spawnInterval?: number    // ms, default 4000
    // lives
    count?: number            // default 3
    // shield
    duration?: number         // ms shield lasts, default 5000
    shieldInterval?: number   // ms between spawns, default 15000
    // double-points
    multiplier?: number       // default 2
    doubleDuration?: number   // ms, default 5000
    doubleInterval?: number   // ms between activations, default 20000
    // speed-ramp
    increment?: number        // speed added per 10s, default 30
    maxSpeed?: number         // cap, default SPEED_MAX
  }
}

export interface GameDifficulty {
  spawnDecay?: number       // ms/sec the spawn interval shrinks (runner default: 8, topdown: 12)
  spawnMin?: number         // minimum spawn interval in ms (runner: 900, topdown: 600)
  burstChance?: number      // 0–1, chance of a burst follow-up spawn after each enemy (runner: 0.2)
  fastEnemyChance?: number  // 0–1, chance of an enemy moving 1.5× faster (runner: 0.15)
}

export interface GameConfig {
  template: 'runner' | 'topdown'
  heroEmoji: string
  heroSpriteId?: string    // catalog asset ID — overrides emoji rendering when set
  enemyEmoji: string
  enemySpriteId?: string   // catalog asset ID — overrides emoji rendering when set
  bgId?: string            // catalog background tile ID
  backgroundColor: string
  groundColor: string
  title: string
  speed: number
  jumpForce: number
  actions?: GameAction[]       // 0–3 AI-defined game-event behaviors
  difficulty?: GameDifficulty  // progression tuning; omit for engine defaults
}

export const SPEED_MIN = 180
export const SPEED_MAX = 600

// ── API response discriminated union ─────────────────────────────────────────

export interface GameConfigResult {
  type: 'config'
  config: GameConfig
}

export interface GameCodeResult {
  type: 'code'
  title: string
  code: string   // complete self-contained JS — no HTML, no <script> tags
}

export type GameResult = GameConfigResult | GameCodeResult
