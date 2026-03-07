import type { GameConfig } from '../../lib/types';

// ── Global state ──────────────────────────────────────────────────────────────
// eslint-disable-next-line prefer-const
var game: any = null;
var currentConfig: GameConfig | null = null;

// ── Shared Phaser Game options ────────────────────────────────────────────────
function makePhaserConfig(bgColor: string, sceneClass: any) {
  return {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: bgColor || '#1a1a2e',
    scene: [sceneClass],
    parent: document.body,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    audio: { disableWebAudio: true },
  };
}

// ── Procedural Web Audio sounds ───────────────────────────────────────────────
// Our own AudioContext — completely separate from Phaser's audio system.
function createSounds() {
  try {
    const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    function tone(freq: number, dur: number, type?: OscillatorType, vol?: number) {
      type = type || 'sine'; vol = vol || 0.22;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur);
    }
    return {
      // Rising chirp: short + crisp
      jump()     { tone(300, 0.04); setTimeout(function(){ tone(520, 0.07); }, 40); },
      // Soft thud on landing
      land()     { tone(130, 0.07, 'triangle', 0.16); },
      // Sad descending tones
      gameOver() {
        [400, 300, 180].forEach(function(f, i) {
          setTimeout(function(){ tone(f, 0.14, 'sawtooth', 0.14); }, i * 130);
        });
      },
      // Coin-style ding
      score()    { tone(523, 0.05); setTimeout(function(){ tone(784, 0.09); }, 60); },
      // Shooter: pop + snap
      shoot()    { tone(900, 0.03, 'square', 0.1); setTimeout(function(){ tone(500, 0.05, 'square', 0.08); }, 25); },
      // Shooter: low thud on hit
      hit()      { tone(180, 0.12, 'sawtooth', 0.18); },
    };
  } catch (e) {
    // Web Audio unavailable — return no-op object
    return { jump: function(){}, land: function(){}, gameOver: function(){}, score: function(){}, shoot: function(){}, hit: function(){} };
  }
}

// ── Dispatch on template ──────────────────────────────────────────────────────
function startGame(config: GameConfig) {
  currentConfig = config;

  // Hide placeholder
  var placeholder = document.getElementById('placeholder');
  if (placeholder) placeholder.style.display = 'none';

  // Destroy existing game
  if (game) { game.destroy(true); game = null; }

  if (config.template === 'topdown') {
    startTopDownGame(config);
  } else if (config.template === 'shooter') {
    startShooterGame(config);
  } else if (config.template === 'platformer') {
    startPlatformerGame(config);
  } else {
    startRunnerGame(config);
  }
}
