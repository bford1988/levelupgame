// Global game state
let canvas, camera, input, renderer, network, interpolation, particles, hud;
let myId = null;
let lastTime = 0;
let gameActive = false;

// DOM elements
const joinScreen = document.getElementById('join-screen');
const nameInput = document.getElementById('name-input');
const colorInput = document.getElementById('color-input');
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
  const name = nameInput.value.trim() || 'Player';
  const color = colorInput.value;

  // Setup canvas
  canvas = document.getElementById('game-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  // Hide join screen
  joinScreen.style.display = 'none';

  // Initialize systems
  camera = new Camera(canvas);
  input = new Input(canvas);
  renderer = new Renderer(canvas);
  network = new Network();
  interpolation = new Interpolation();
  particles = new ParticleSystem();
  hud = new HUD();

  // Network callbacks
  network.onWelcome = (msg) => {
    myId = msg.id;
  };

  network.onState = (msg) => {
    interpolation.pushState(msg);
  };

  network.onDeath = (msg) => {
    showDeathScreen(msg.killerName, msg.score, msg.kills);
  };

  network.onKillFeed = (msg) => {
    hud.addKill(msg.killer, msg.victim);
  };

  // Connect
  network.connect(name, color);
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
    }

    camera.update();

    // Update particles and tank renderer
    particles.update(dt);
    renderer.tankRenderer.update(dt);

    // Render
    const stateWithObs = {
      ...state,
      obs: network.obstacles,
    };
    renderer.render(stateWithObs, camera, myId, network.mapWidth, network.mapHeight);

    // Particles
    particles.draw(renderer.ctx, camera);

    // HUD
    const me2 = state.p.find(p => p.i === myId);
    if (me2) me2.zoom = camera.zoom;
    hud.draw(renderer.ctx, stateWithObs, me2, canvas, network.mapWidth, network.mapHeight);
  }

  requestAnimationFrame(gameLoop);
}

function showDeathScreen(killerName, score, kills) {
  deathOverlay.style.display = 'flex';
  deathMessage.textContent = killerName ? `Killed by ${killerName}` : 'You died!';
  deathStats.textContent = `Score: ${score || 0} | Kills: ${kills || 0}`;
}

respawnBtn.addEventListener('click', () => {
  deathOverlay.style.display = 'none';
  network.sendRespawn();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && deathOverlay.style.display === 'flex') {
    deathOverlay.style.display = 'none';
    network.sendRespawn();
  }
});
