import type { GameConfig } from '../../../lib/types';

// ══════════════════════════════════════════════════════════════════════════════
//  PLATFORMER TEMPLATE  (stomp enemies — jump on platforms)
// ══════════════════════════════════════════════════════════════════════════════
function startPlatformerGame(config: GameConfig) {
  var W          = window.innerWidth;
  var H          = window.innerHeight;
  var GROUND_Y   = Math.floor(H * 0.84);
  var GRAVITY    = 1500;
  var HERO_SPEED = Math.max(150, Math.min(320, config.speed     || 200));
  var JUMP_FORCE = Math.max(520, Math.min(750, config.jumpForce || 630));
  var DOUBLE_JUMP = !!(config.platformer && config.platformer.doubleJump);

  // Distribute 3 platform rows evenly in the space above the ground
  var NUM_ROWS    = 3;
  var ROW_SPACING = Math.floor((GROUND_Y - H * 0.1) / (NUM_ROWS + 1));

  // ── Internal types ──────────────────────────────────────────────────────────
  interface Platform { x: number; y: number; w: number; obj: any; isGround: boolean; }
  interface Enemy    { x: number; y: number; platform: Platform; dir: number; speed: number; obj: any; alive: boolean; }

  class PlatformerScene extends Phaser.Scene {
    // Allow dynamic property assignment in create() — standard Phaser JS→TS pattern
    [key: string]: any;
    constructor() { super({ key: 'PlatformerScene' }); }

    // ── Preload sprites ───────────────────────────────────────────────────────
    preload() {
      if (config.heroSpriteUrl)       this.load.image('hero-spr',  config.heroSpriteUrl);
      else if (config.heroSpriteId)   this.load.image('hero-spr',  '/assets/characters/' + config.heroSpriteId  + '.svg');
      if (config.enemySpriteUrl)      this.load.image('enemy-spr', config.enemySpriteUrl);
      else if (config.enemySpriteId)  this.load.image('enemy-spr', '/assets/characters/' + config.enemySpriteId + '.svg');
      if (config.bgUrl)               this.load.image('bg-tile',   config.bgUrl);
      else if (config.bgId)           this.load.image('bg-tile',   '/assets/backgrounds/' + config.bgId         + '.svg');
    }

    create() {
      this.gameOver    = false;
      this.score       = 0;
      this.heroVY      = 0;      // vertical velocity (px/s)
      this.prevHeroY   = 0;      // hero.y last frame (for swept collision)
      this.jumpCount   = 0;      // 0 = on ground, 1 = first jump, 2 = double-jumped
      this.platforms   = [] as Platform[];
      this.enemies     = [] as Enemy[];
      this.pointerDown = false;
      this.pointerX    = W / 2;
      this.sounds      = createSounds();
      ActionSystem.init(this);

      // ── Background ─────────────────────────────────────────────────────────
      if (config.bgId && this.textures.exists('bg-tile')) {
        this.add.tileSprite(0, 0, W, H, 'bg-tile').setOrigin(0).setDepth(-2);
      } else {
        this.cameras.main.setBackgroundColor(config.backgroundColor || '#4a7aaa');
      }

      // Decorative clouds
      for (var ci = 0; ci < 5; ci++) {
        this.add.text(
          Phaser.Math.Between(0, W),
          Phaser.Math.Between(20, Math.floor(H * 0.32)),
          '☁️',
          { fontSize: Phaser.Math.Between(24, 44) + 'px' }
        ).setDepth(-1);
      }

      // ── Ground ─────────────────────────────────────────────────────────────
      var groundCol = parseInt((config.groundColor || '#5a8a5a').replace('#', '0x'), 16);
      this.add.rectangle(W / 2, GROUND_Y + (H - GROUND_Y) / 2, W, H - GROUND_Y, groundCol).setDepth(1);
      this.add.rectangle(W / 2, GROUND_Y + 2, W, 5, 0x3d6b3d).setDepth(1);
      this.platforms.push({ x: 0, y: GROUND_Y, w: W, isGround: true, obj: null });

      // ── Floating platforms ──────────────────────────────────────────────────
      this.generatePlatforms();

      // ── Hero (sprite or emoji) ─────────────────────────────────────────────
      this.useHeroSpr  = !!(config.heroSpriteId  && this.textures.exists('hero-spr'));
      this.useEnemySpr = !!(config.enemySpriteId && this.textures.exists('enemy-spr'));

      if (this.useHeroSpr) {
        this.hero = this.add.image(W * 0.15, GROUND_Y, 'hero-spr')
          .setDisplaySize(48, 48).setOrigin(0.5, 1).setDepth(5);
      } else {
        this.hero = this.add.text(W * 0.15, GROUND_Y, config.heroEmoji || '🐸', {
          fontSize: '44px', fontFamily: 'Arial'
        }).setOrigin(0.5, 1).setDepth(5);
      }

      // ── Spawn enemies on every floating platform ───────────────────────────
      (this.platforms as Platform[]).forEach(p => {
        if (!p.isGround && p.w >= 80) this.spawnEnemy(p);
      });

      // ── HUD ────────────────────────────────────────────────────────────────
      this.add.text(16, 16, config.title || 'Platformer!', {
        fontSize: '22px', fontFamily: 'monospace',
        color: '#ffffff', stroke: '#000000', strokeThickness: 4,
      }).setDepth(56);
      this.scoreTxt = this.add.text(W - 16, 16, 'Score: 0', {
        fontSize: '20px', fontFamily: 'monospace',
        color: '#ffff00', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(1, 0).setDepth(56);

      // Start hint (disappears after 3 s)
      this.hintTxt = this.add.text(W / 2, H * 0.48,
        DOUBLE_JUMP
          ? '← → move  SPACE jump  (double jump enabled!)'
          : '← → to move  ·  SPACE / tap to jump',
        { fontSize: '16px', fontFamily: 'monospace', color: '#ffffff', stroke: '#000', strokeThickness: 3 }
      ).setOrigin(0.5).setDepth(57);
      this.time.delayedCall(3200, () => { if (this.hintTxt) { this.hintTxt.destroy(); this.hintTxt = null; } });

      // ── Keyboard input ─────────────────────────────────────────────────────
      this.cursors = this.input.keyboard!.createCursorKeys();
      this.wasd    = this.input.keyboard!.addKeys('W,A,S,D') as any;
      this.input.keyboard!.on('keydown-SPACE', () => this.doJump());
      this.input.keyboard!.on('keydown-UP',    () => this.doJump());
      this.input.keyboard!.on('keydown-W',     () => this.doJump());

      // ── Touch / pointer input ──────────────────────────────────────────────
      // Hold left-half → move left; hold right-half → move right; any tap → jump
      this.input.on('pointerdown', (ptr: any) => {
        if (this.gameOver) { this.scene.restart(); return; }
        this.pointerDown = true;
        this.pointerX    = ptr.x;
        this.doJump();
      });
      this.input.on('pointermove', (ptr: any) => { this.pointerX = ptr.x; });
      this.input.on('pointerup',   ()          => { this.pointerDown = false; });

      window.parent.postMessage({ type: 'GAME_READY' }, '*');
    }

    // ── Platform generation ─────────────────────────────────────────────────────
    generatePlatforms() {
      var PW_MIN = 80, PW_MAX = 190;
      for (var row = 1; row <= NUM_ROWS; row++) {
        var rowY = GROUND_Y - row * ROW_SPACING;
        // Divide width into 3 zones; place 1 platform per zone (skip some randomly)
        var zones = [
          { lo: 10,             hi: W * 0.33 },
          { lo: W * 0.33 + 10,  hi: W * 0.66 },
          { lo: W * 0.66 + 10,  hi: W - 10   },
        ];
        var placed = 0;
        zones.forEach(z => {
          var span = z.hi - z.lo;
          if (span < PW_MIN + 10) return;
          // Always place at least one per row (placed === 0 forces first zone)
          if (placed > 0 && Math.random() > 0.78) return;
          var pw  = Phaser.Math.Between(PW_MIN, Math.min(PW_MAX, Math.floor(span - 10)));
          var px  = Phaser.Math.Between(Math.floor(z.lo), Math.floor(z.hi - pw));
          // Platform body
          var obj = this.add.rectangle(px + pw / 2, rowY + 7, pw, 14, 0x8b6a3a).setDepth(2);
          // Darker top edge for readability
          this.add.rectangle(px + pw / 2, rowY + 1, pw, 3, 0x5a3a1a).setDepth(3);
          this.platforms.push({ x: px, y: rowY, w: pw, isGround: false, obj });
          placed++;
        });
      }
    }

    // ── Spawn a patrolling enemy on a platform ──────────────────────────────────
    spawnEnemy(platform: Platform) {
      var ex = platform.x + platform.w / 2;
      var obj: any;
      if (this.useEnemySpr) {
        obj = this.add.image(ex, platform.y, 'enemy-spr')
          .setDisplaySize(40, 40).setOrigin(0.5, 1).setDepth(4);
      } else {
        obj = this.add.text(ex, platform.y, config.enemyEmoji || '👾', {
          fontSize: '36px', fontFamily: 'Arial'
        }).setOrigin(0.5, 1).setDepth(4);
      }
      var dir = Math.random() < 0.5 ? 1 : -1;
      this.enemies.push({
        x: ex, y: platform.y, platform, dir,
        speed: Phaser.Math.Between(45, 88),
        obj, alive: true,
      });
    }

    // ── Jump handler ─────────────────────────────────────────────────────────────
    doJump() {
      if (this.gameOver) { this.scene.restart(); return; }
      if (this.jumpCount === 0) {
        // First jump (from ground or platform)
        this.heroVY    = -JUMP_FORCE;
        this.jumpCount = 1;
        this.sounds.jump();
      } else if (DOUBLE_JUMP && this.jumpCount === 1) {
        // Double-jump in mid-air
        this.heroVY    = -JUMP_FORCE * 0.80;
        this.jumpCount = 2;
        this.sounds.jump();
      }
    }

    // ── Main update ──────────────────────────────────────────────────────────────
    update(time: number, delta: number) {
      if (this.gameOver) return;
      var dt = delta / 1000;

      // ── Horizontal movement ─────────────────────────────────────────────────
      var goLeft  = this.cursors.left?.isDown  || this.wasd.A?.isDown
                    || (this.pointerDown && this.pointerX < W * 0.42);
      var goRight = this.cursors.right?.isDown || this.wasd.D?.isDown
                    || (this.pointerDown && this.pointerX > W * 0.58);

      var hx = this.hero.x;
      if (goLeft)  hx -= HERO_SPEED * dt;
      if (goRight) hx += HERO_SPEED * dt;

      // Wrap at screen edges (walk through walls, arcade feel)
      if (hx < -24)    hx = W + 24;
      if (hx > W + 24) hx = -24;
      this.hero.x = hx;

      // Flip hero to face direction
      if (this.useHeroSpr) {
        if (goLeft)  this.hero.setFlipX(true);
        if (goRight) this.hero.setFlipX(false);
      } else {
        if (goLeft)  this.hero.setScale(-1, 1);
        if (goRight) this.hero.setScale( 1, 1);
      }

      // ── Vertical physics ────────────────────────────────────────────────────
      this.prevHeroY = this.hero.y;
      this.heroVY   += GRAVITY * dt;
      this.hero.y   += this.heroVY * dt;

      // ── Platform collisions (one-way — land from above) ─────────────────────
      this.checkPlatformCollisions();

      // ── Enemy patrol ────────────────────────────────────────────────────────
      this.updateEnemies(dt);

      // ── Hero ↔ enemy collisions ──────────────────────────────────────────────
      this.checkHeroEnemyCollisions();

      // ── Repopulate when all enemies stomped ─────────────────────────────────
      if ((this.enemies as Enemy[]).filter(e => e.alive).length === 0) {
        this.score += 3;
        this.scoreTxt.setText('Score: ' + this.score);
        this.sounds.score();
        (this.platforms as Platform[]).forEach(p => {
          if (!p.isGround) this.spawnEnemy(p);
        });
      }

      // ── ActionSystem tick ────────────────────────────────────────────────────
      ActionSystem.tick(this, time, delta, dt, this.hero.x, this.hero.y);
    }

    // ── Platform collision (swept, one-way) ──────────────────────────────────────
    checkPlatformCollisions() {
      if (this.heroVY < 0) return;   // skip while rising

      var hx = this.hero.x, hy = this.hero.y;
      for (var p of this.platforms as Platform[]) {
        // Horizontal bounds check (8 px tolerance so it feels fair at edges)
        if (hx < p.x - 8 || hx > p.x + p.w + 8) continue;
        // Swept check: crossed the platform top surface this frame
        if (this.prevHeroY <= p.y && hy >= p.y) {
          this.hero.y = p.y;
          this.heroVY = 0;
          if (this.jumpCount > 0) this.sounds.land();
          this.jumpCount = 0;
          return; // land on at most one platform per frame
        }
      }

      // Fell off the bottom of the screen → game over
      if (hy > H + 80) this.triggerGameOver();
    }

    // ── Enemy patrol movement ─────────────────────────────────────────────────────
    updateEnemies(dt: number) {
      (this.enemies as Enemy[]).forEach(e => {
        if (!e.alive) return;
        e.x += e.dir * e.speed * dt;
        // Reverse at platform edges (with 18 px margin)
        if (e.x <= e.platform.x + 18)               { e.dir =  1; e.x = e.platform.x + 18; }
        if (e.x >= e.platform.x + e.platform.w - 18) { e.dir = -1; e.x = e.platform.x + e.platform.w - 18; }
        e.obj.setPosition(e.x, e.platform.y);
        // Flip enemy to face direction
        if (this.useEnemySpr) {
          e.obj.setFlipX(e.dir < 0);
        } else {
          e.obj.setScale(e.dir < 0 ? -1 : 1, 1);
        }
      });
    }

    // ── Hero ↔ enemy collision ─────────────────────────────────────────────────────
    checkHeroEnemyCollisions() {
      var hx   = this.hero.x;
      var hy   = this.hero.y;          // hero bottom (origin 0.5, 1)
      var hTop = hy - 44;              // approximate hero top

      for (var i = (this.enemies as Enemy[]).length - 1; i >= 0; i--) {
        var e = (this.enemies as Enemy[])[i];
        if (!e.alive) continue;

        // Enemy bounding box: origin 0.5, 1 → e.obj.y == platform.y (enemy bottom)
        var eTop    = e.platform.y - 38;   // enemy top (approx 38 px tall)
        var eLeft   = e.x - 22;
        var eRight  = e.x + 22;

        var overlapX = hx > eLeft  && hx < eRight;
        var overlapY = hy > eTop   && hTop < e.platform.y;
        if (!overlapX || !overlapY) continue;

        // ── STOMP: hero falling + hero bottom just entered enemy's top zone ──
        if (this.heroVY > 80 && hy < eTop + 22) {
          e.alive = false;
          e.obj.setAlpha(0);
          this.score++;
          this.scoreTxt.setText('Score: ' + this.score);
          if (this.score % 5 === 0) this.sounds.score();
          // Bounce hero upward
          this.heroVY    = -JUMP_FORCE * 0.58;
          this.jumpCount = 1;
          this.sounds.jump();
          this.enemies.splice(i, 1);

        } else {
          // ── SIDE HIT: handled by ActionSystem (lives) or immediate game over ─
          if (ActionSystem.handleCollision(this, e.obj)) {
            this.triggerGameOver();
            return;
          }
          // Brief knockback so hero doesn't get stuck
          this.hero.x += hx > e.x ? 26 : -26;
        }
      }
    }

    // ── Game over ─────────────────────────────────────────────────────────────────
    triggerGameOver() {
      if (this.gameOver) return;
      this.gameOver = true;
      ActionSystem.destroy();
      this.sounds.gameOver();

      if (this.useHeroSpr) {
        this.hero.setTint(0xff4444);
      } else {
        this.hero.setText('💥');
      }

      var cx = W / 2, cy = H / 2;
      this.add.rectangle(cx, cy, 360, 200, 0x000000, 0.78).setDepth(20);
      this.add.text(cx, cy - 55, '💀 Game Over!', {
        fontSize: '34px', color: '#ff4444', stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(21);
      this.add.text(cx, cy - 5, 'Score: ' + this.score, {
        fontSize: '28px', color: '#ffffff', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(21);
      this.add.text(cx, cy + 44, 'Tap or SPACE to play again!', {
        fontSize: '16px', color: '#aaaaaa',
      }).setOrigin(0.5).setDepth(21);
    }
  }

  game = new Phaser.Game(makePhaserConfig(config.backgroundColor || '#4a7aaa', PlatformerScene));
}
