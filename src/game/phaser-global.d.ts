// Phaser is loaded at runtime via CDN; this file gives TypeScript its type definitions.
// phaser@3.70.0 is a devDependency — not bundled into any output, only used for types.
//
// This file is an ambient declaration file (no top-level import/export), so every
// declaration here becomes a global visible to all src/game/**/*.ts files.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Phaser: typeof import('phaser');

// ── Cross-file runtime globals ────────────────────────────────────────────────
// These are declared as module-level vars/functions in shared.ts and
// action-system.ts, then called from the other scene files.  At runtime all
// five <script> tags share the same global scope so they are always present.

// shared.ts exports
declare let game: any;
declare let currentConfig: {
  template?: string;
  title?: string;
  backgroundColor?: string;
  heroEmoji?: string;
  enemyEmoji?: string;
  heroSpriteId?: string;
  heroSpriteUrl?: string;
  enemySpriteId?: string;
  enemySpriteUrl?: string;
  bgId?: string;
  bgUrl?: string;
  speed?: number;
  jumpForce?: number;
  actions?: Array<{ type: string; params?: Record<string, any> }>;
  difficulty?: Record<string, any>;
  [key: string]: any;
} | null;

declare function createSounds(): {
  jump(): void;
  land(): void;
  gameOver(): void;
  score(): void;
  shoot(): void;
  hit(): void;
};
declare function makePhaserConfig(bgColor: string, sceneClass: any): any;
declare function startGame(config: any): void;

// scene entry points (defined in scene files, called from shared.ts)
declare function startRunnerGame(config: any): void;
declare function startTopDownGame(config: any): void;
declare function startShooterGame(config: any): void;
declare function startPlatformerGame(config: any): void;

// ActionSystem is declared in action-system.ts (a script file — no imports/exports).
// TypeScript infers its type from that file; no ambient re-declaration needed here.
