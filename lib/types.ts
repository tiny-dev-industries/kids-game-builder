export interface GameConfig {
  template: 'runner' | 'topdown'
  heroEmoji: string
  enemyEmoji: string
  backgroundColor: string
  groundColor: string
  title: string
  speed: number
  jumpForce: number
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
