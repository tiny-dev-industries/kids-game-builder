// ── Asset Catalog ─────────────────────────────────────────────────────────────
//
// Single source of truth for the curated CC0 sprite library.
// Used by:
//   - lib/ai.ts        → getCatalogSummary() injected into AI system prompts
//   - app/page.tsx     → HERO_SPRITES / ENEMY_SPRITES / BG_ASSETS for Settings picker
//   - public/game.html → URL pattern /assets/characters/{id}.svg (no import needed)
//
// All art is CC0 (public domain) from Kenney.nl — https://kenney.nl/assets

export interface CharacterAsset {
  id: string
  name: string
  role: 'hero' | 'enemy'
  tags: string[]
  url: string   // served from /public/assets/characters/{id}.svg
}

export interface BackgroundAsset {
  id: string
  name: string
  tags: string[]
  url: string           // served from /public/assets/backgrounds/{id}.svg
  fallbackColor: string // hex — used by Settings picker if image not yet loaded
}

// ── Hero character sprites ────────────────────────────────────────────────────

export const HERO_SPRITES: CharacterAsset[] = [
  {
    id: 'hero-knight',
    name: 'Knight',
    role: 'hero',
    tags: ['fantasy', 'warrior', 'brave', 'medieval'],
    url: '/assets/characters/hero-knight.svg',
  },
  {
    id: 'hero-robot',
    name: 'Robot',
    role: 'hero',
    tags: ['sci-fi', 'machine', 'tech', 'future'],
    url: '/assets/characters/hero-robot.svg',
  },
  {
    id: 'hero-cat',
    name: 'Cat',
    role: 'hero',
    tags: ['animal', 'cute', 'friendly', 'pet'],
    url: '/assets/characters/hero-cat.svg',
  },
  {
    id: 'hero-wizard',
    name: 'Wizard',
    role: 'hero',
    tags: ['fantasy', 'magic', 'spell', 'mage'],
    url: '/assets/characters/hero-wizard.svg',
  },
  {
    id: 'hero-astronaut',
    name: 'Astronaut',
    role: 'hero',
    tags: ['space', 'sci-fi', 'explorer', 'galaxy'],
    url: '/assets/characters/hero-astronaut.svg',
  },
]

// ── Enemy character sprites ───────────────────────────────────────────────────

export const ENEMY_SPRITES: CharacterAsset[] = [
  {
    id: 'enemy-dragon',
    name: 'Dragon',
    role: 'enemy',
    tags: ['fantasy', 'fire', 'scary', 'villain'],
    url: '/assets/characters/enemy-dragon.svg',
  },
  {
    id: 'enemy-ghost',
    name: 'Ghost',
    role: 'enemy',
    tags: ['spooky', 'halloween', 'horror', 'undead'],
    url: '/assets/characters/enemy-ghost.svg',
  },
  {
    id: 'enemy-bat',
    name: 'Bat',
    role: 'enemy',
    tags: ['dark', 'cave', 'night', 'flying'],
    url: '/assets/characters/enemy-bat.svg',
  },
  {
    id: 'enemy-alien',
    name: 'Alien',
    role: 'enemy',
    tags: ['space', 'sci-fi', 'ufo', 'strange'],
    url: '/assets/characters/enemy-alien.svg',
  },
  {
    id: 'enemy-slime',
    name: 'Slime',
    role: 'enemy',
    tags: ['gooey', 'blob', 'weird', 'bouncy'],
    url: '/assets/characters/enemy-slime.svg',
  },
]

// ── Background tiles ──────────────────────────────────────────────────────────

export const BG_ASSETS: BackgroundAsset[] = [
  {
    id: 'bg-sky',
    name: 'Blue Sky',
    tags: ['outdoor', 'day', 'friendly', 'runner'],
    url: '/assets/backgrounds/bg-sky.svg',
    fallbackColor: '#87CEEB',
  },
  {
    id: 'bg-space',
    name: 'Starfield',
    tags: ['space', 'night', 'sci-fi', 'dark'],
    url: '/assets/backgrounds/bg-space.svg',
    fallbackColor: '#0a0a2e',
  },
  {
    id: 'bg-dungeon',
    name: 'Dungeon',
    tags: ['dark', 'fantasy', 'underground', 'cave'],
    url: '/assets/backgrounds/bg-dungeon.svg',
    fallbackColor: '#2a1f2a',
  },
  {
    id: 'bg-forest',
    name: 'Forest',
    tags: ['nature', 'green', 'trees', 'outdoor'],
    url: '/assets/backgrounds/bg-forest.svg',
    fallbackColor: '#2d5a1b',
  },
  {
    id: 'bg-desert',
    name: 'Desert',
    tags: ['arid', 'sand', 'hot', 'topdown'],
    url: '/assets/backgrounds/bg-desert.svg',
    fallbackColor: '#c4a25a',
  },
]

// ── Lookup helpers ────────────────────────────────────────────────────────────

export const ALL_CHARACTER_IDS = new Set(
  [...HERO_SPRITES, ...ENEMY_SPRITES].map(c => c.id)
)
export const ALL_BG_IDS = new Set(BG_ASSETS.map(b => b.id))

export function getCharacterById(id: string): CharacterAsset | null {
  return [...HERO_SPRITES, ...ENEMY_SPRITES].find(c => c.id === id) ?? null
}

export function getBackgroundById(id: string): BackgroundAsset | null {
  return BG_ASSETS.find(b => b.id === id) ?? null
}

// ── AI prompt injection ───────────────────────────────────────────────────────

/**
 * Returns a compact multi-line string summarising available sprites.
 * Prepended to CREATE_SYSTEM_PROMPT and UPDATE_SYSTEM_PROMPT in lib/ai.ts.
 */
export function getCatalogSummary(): string {
  const fmt = (arr: CharacterAsset[] | BackgroundAsset[]) =>
    arr.map(a => `${a.id} (${a.tags.slice(0, 3).join('/')})`).join(', ')

  return [
    'AVAILABLE SPRITES (optional — add to config JSON when a good thematic match exists):',
    `Hero sprites   → heroSpriteId:   ${fmt(HERO_SPRITES)}`,
    `Enemy sprites  → enemySpriteId:  ${fmt(ENEMY_SPRITES)}`,
    `Backgrounds    → bgId:           ${fmt(BG_ASSETS)}`,
    'Rules: always keep heroEmoji + enemyEmoji as emoji fallbacks.',
    'Omit sprite fields entirely if no good catalog match — emoji-only is fine.',
  ].join('\n')
}
