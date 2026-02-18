// Mobile detection
const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
if (isMobile) document.body.classList.add('mobile');

// Global game state
let canvas, camera, input, renderer, network, interpolation, particles, hud;
let myId = null;
let lastTime = 0;
let gameActive = false;
let playerName = '';
let playerCatchphrase = '';

// Growth tracking
let lastScore = 0;
let lastTier = 0;
let lastHealth = -1;
let scoreAccumulator = 0; // accumulates small gains before showing text
let playerHealthMap = new Map(); // track health of all visible players

// DOM elements
const joinScreen = document.getElementById('join-screen');
const nameInput = document.getElementById('name-input');
const colorInput = document.getElementById('color-input');
const catchphraseInput = document.getElementById('catchphrase-input');
const playBtn = document.getElementById('play-btn');
const deathOverlay = document.getElementById('death-overlay');
const deathMessage = document.getElementById('death-message');
const deathStats = document.getElementById('death-stats');
const respawnBtn = document.getElementById('respawn-btn');

// Join game
playBtn.addEventListener('click', startGame);
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startGame();
});

function startGame() {
  playerName = nameInput.value.trim() || 'Player';
  playerCatchphrase = catchphraseInput.value.trim();
  const color = colorInput.value;
  const accentColor = document.getElementById('accent-input').value;
  const decal = parseInt(document.getElementById('decal-input').value, 10) || 0;
  const bulletShape = parseInt(document.getElementById('bullet-input').value, 10) || 0;

  // Setup canvas
  canvas = document.getElementById('game-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  // Mobile: request fullscreen and landscape
  if (isMobile) {
    canvas.style.touchAction = 'none';

    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }

  // Hide join screen
  joinScreen.style.display = 'none';

  // Initialize systems
  camera = new Camera(canvas);
  if (isMobile) camera._mobileZoomFactor = 0.85;
  input = new Input(canvas);
  renderer = new Renderer(canvas);
  network = new Network();
  interpolation = new Interpolation();
  particles = new ParticleSystem();
  hud = new HUD();

  // Reset tracking
  lastScore = 0;
  lastTier = 0;
  scoreAccumulator = 0;

  // Network callbacks
  network.onWelcome = (msg) => {
    myId = msg.id;
  };

  network.onState = (msg) => {
    interpolation.pushState(msg);
  };

  network.onDeath = (msg) => {
    showDeathScreen(msg.killerName, msg.score, msg.kills, msg.catchphrase);
    input.resetBoost(); // prevent auto-boost on respawn
    // Reset tracking on death
    lastScore = 0;
    lastTier = 0;
    lastHealth = -1;
    scoreAccumulator = 0;
  };

  network.onKillFeed = (msg) => {
    hud.addKill(msg.killer, msg.victim, msg.catchphrase);

    // If I got the kill, celebration!
    if (msg.killer === playerName) {
      camera.shake(12);
    }

    // Show catchphrase as floating world text at the kill location
    if (msg.catchphrase && msg.x != null && msg.y != null) {
      particles.emitCatchphrase(
        `"${msg.catchphrase}"`,
        msg.x,
        msg.y - 30,
        '#ffcc80'
      );
    }
  };

  network.onWarpDenied = (msg) => {
    const maxStr = msg.ms >= 1000 ? (msg.ms / 1000) + 'K' : msg.ms;
    hud.showWarpDenied(`Too many points! Max: ${maxStr}`);
  };

  // Connect
  network.connect(playerName, color, playerCatchphrase, accentColor, decal, bulletShape);
  gameActive = true;

  // Start game loop
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
  if (!gameActive) return;

  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  // Get interpolated state
  const state = interpolation.getInterpolatedState();

  if (state && state.p) {
    // Find myself in the state
    const me = state.p.find(p => p.i === myId);

    if (me && me.al) {
      // Update camera target
      camera.setTarget(me.x, me.y, me.r);
      network.updateMyPosition(me.x, me.y);

      // Send input to server
      network.sendInput(input, camera);

      // --- Growth feedback ---
      const currentScore = me.s || 0;
      const currentTier = me.ti || 1;

      // Score change detection
      if (lastScore > 0 || currentScore > 0) {
        const scoreDelta = currentScore - lastScore;
        if (scoreDelta > 0) {
          scoreAccumulator += scoreDelta;
          hud.flashScore();

          // Show floating text when accumulated enough (avoids spam from tiny food)
          const threshold = currentScore < 500 ? 3 : (currentScore < 5000 ? 10 : 30);
          if (scoreAccumulator >= threshold) {
            const textColor = scoreAccumulator >= 100 ? '#ff4444' : (scoreAccumulator >= 20 ? '#FF9800' : '#FFEB3B');
            const textSize = Math.min(28, 14 + Math.sqrt(scoreAccumulator) * 0.8);
            particles.emitText(
              `+${scoreAccumulator}`,
              me.x + (Math.random() - 0.5) * me.r,
              me.y - me.r - 15,
              textColor,
              textSize
            );
            scoreAccumulator = 0;
          }
        }
      }
      lastScore = currentScore;

      // Tier change detection
      if (currentTier > lastTier && lastTier > 0) {
        // TIER UP celebration!
        particles.emitTierUp(me.x, me.y, me.c);
        camera.shake(18);
        hud.showTierUp(currentTier);
      }
      lastTier = currentTier;

      // Health drop detection for ME (obstacle/combat damage)
      const currentHealth = me.h || 0;
      if (lastHealth >= 0 && currentHealth < lastHealth) {
        const dmg = lastHealth - currentHealth;
        if (dmg > 2) {
          particles.emit('hit', me.x, me.y, '#ff4444', Math.min(12, 3 + Math.floor(dmg / 3)));
          camera.shake(Math.min(10, 2 + dmg * 0.3));
          hud.flashDamage(Math.min(1, dmg / 30));
        }
      }
      lastHealth = currentHealth;
    }

    // Health drop detection for ALL visible players (hit effects on others)
    if (state.p) {
      const seen = new Set();
      for (const p of state.p) {
        if (!p.al) continue;
        seen.add(p.i);
        const prevHealth = playerHealthMap.get(p.i);
        if (prevHealth !== undefined && p.h < prevHealth) {
          const dmg = prevHealth - p.h;
          if (dmg > 2 && p.i !== myId) {
            particles.emit('hit', p.x, p.y, '#ff4444', Math.min(8, 2 + Math.floor(dmg / 4)));
          }
        }
        playerHealthMap.set(p.i, p.h);
      }
      // Clean up players no longer visible
      for (const id of playerHealthMap.keys()) {
        if (!seen.has(id)) playerHealthMap.delete(id);
      }
    }

    // Mine explosion events
    if (state.ex) {
      for (const e of state.ex) {
        particles.emitExplosion(e.x, e.y, e.r);
        camera.shake(15);
      }
    }

    // Warp effects
    if (state.wp) {
      for (const w of state.wp) {
        particles.emitWarp(w.x, w.y, w.r);
      }
    }

    // Laser beam effects
    if (state.bm) {
      for (const bm of state.bm) {
        camera.shake(4);
        particles.emit('hit', bm.x2, bm.y2, '#ffffff', 5);
      }
    }

    camera.update();

    // Update particles and tank renderer
    particles.update(dt);
    renderer.tankRenderer.update(dt);

    // Render
    const me2 = state.p.find(p => p.i === myId);
    const stateWithObs = {
      ...state,
      obs: network.obstacles,
      wh: network.warpHoles,
    };
    const myScore = me2 ? (me2.s || 0) : 0;
    const myPos = me2 ? { x: me2.x, y: me2.y } : null;
    renderer.render(stateWithObs, camera, myId, network.mapWidth, network.mapHeight, myScore, myPos);

    // Particles
    particles.draw(renderer.ctx, camera);

    // HUD
    if (me2) me2.zoom = camera.zoom;
    hud.draw(renderer.ctx, stateWithObs, me2, canvas, network.mapWidth, network.mapHeight, network.instanceId, input);
  }

  requestAnimationFrame(gameLoop);
}

function showDeathScreen(killerName, score, kills, catchphrase) {
  deathOverlay.style.display = 'flex';
  deathMessage.textContent = killerName ? `Killed by ${killerName}` : 'You died!';
  deathStats.innerHTML = `Score: ${score || 0} | Kills: ${kills || 0}`;
  // Show killer's catchphrase
  const existing = document.getElementById('death-catchphrase');
  if (existing) existing.remove();
  if (catchphrase && killerName) {
    const el = document.createElement('p');
    el.id = 'death-catchphrase';
    el.textContent = `"${catchphrase}"`;
    deathStats.insertAdjacentElement('afterend', el);
  }
}

respawnBtn.addEventListener('click', () => {
  deathOverlay.style.display = 'none';
  if (input) input.resetBoost();
  network.sendRespawn();
});

if (isMobile) {
  respawnBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    deathOverlay.style.display = 'none';
    if (input) input.resetBoost();
    network.sendRespawn();
  });

  // Prevent pull-to-refresh on document (allow scrolling inside join screen)
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest('#join-screen')) {
      e.preventDefault();
    }
  }, { passive: false });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && deathOverlay.style.display === 'flex') {
    deathOverlay.style.display = 'none';
    if (input) input.resetBoost();
    network.sendRespawn();
  }
});
