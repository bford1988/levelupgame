const config = require('./config');
const { MSG } = require('../shared/constants');
const Player = require('./Player');
const Projectile = require('./Projectile');
const Food = require('./Food');
const Obstacle = require('./Obstacle');
const Mine = require('./Mine');
const Bot = require('./Bot');
const SpatialHash = require('./SpatialHash');
const { circleCircle, circleRect, resolveCircleCircle, resolveCircleRect } = require('./Collision');

class Game {
  constructor() {
    this.players = new Map(); // id -> Player
    this.projectiles = [];
    this.food = [];
    this.obstacles = [];
    this.turrets = [];
    this.mines = [];
    this.explosions = []; // temporary, cleared after broadcast
    this.bots = [];
    this.spectators = []; // admin spectator websockets
    this.spectatorTickCounter = 0;
    this.spatialHash = new SpatialHash(200);
    this.tick = 0;
    this.loopInterval = null;
    this.instanceId = null; // set by InstanceManager
    this.mapWidth = config.MAP_WIDTH;
    this.mapHeight = config.MAP_HEIGHT;

    // Create obstacles (some get turrets mounted on edges)
    for (const o of config.OBSTACLES) {
      const obs = new Obstacle(o.x, o.y, o.width, o.height);
      this.obstacles.push(obs);

      if (Math.random() < config.TURRET_CHANCE) {
        // Pick a random edge to mount on
        const edge = Math.floor(Math.random() * 4);
        let tx, ty;
        switch (edge) {
          case 0: tx = o.x + o.width / 2; ty = o.y - 8; break;           // top
          case 1: tx = o.x + o.width / 2; ty = o.y + o.height + 8; break; // bottom
          case 2: tx = o.x - 8; ty = o.y + o.height / 2; break;           // left
          case 3: tx = o.x + o.width + 8; ty = o.y + o.height / 2; break;  // right
        }
        this.turrets.push({
          x: tx,
          y: ty,
          angle: 0,
          fireCooldown: Math.floor(Math.random() * config.TURRET_FIRE_RATE),
        });
      }
    }

    // Spawn initial food
    this.spawnFood();

    // Spawn mines
    this.spawnMines();

    // Spawn bots
    this.spawnBots();
  }

  start() {
    if (this.loopInterval) return;
    this.loopInterval = setInterval(() => this.update(), 1000 / config.TICK_RATE);
    console.log(`Game instance ${this.instanceId || '?'} started at ${config.TICK_RATE}Hz`);
  }

  stop() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    for (const [, player] of this.players) {
      if (player.ws && player.ws.readyState === 1) {
        player.ws.close();
      }
    }
    this.players.clear();
    this.bots = [];
    console.log(`Game instance ${this.instanceId || '?'} stopped`);
  }

  addSpectator(ws) {
    this.spectators.push(ws);
    this.sendTo(ws, {
      t: MSG.WELCOME,
      id: '__spectator',
      mw: this.mapWidth,
      mh: this.mapHeight,
      obs: this.obstacles.map(o => o.serialize()),
      inst: this.instanceId,
    });
  }

  removeSpectator(ws) {
    this.spectators = this.spectators.filter(s => s !== ws);
  }

  addPlayer(ws, name, color, catchphrase) {
    if (this.getRealPlayerCount() >= config.MAX_PLAYERS) {
      return null;
    }

    const player = new Player(name, color, ws, catchphrase);
    this.spawnAtRandom(player);
    this.players.set(player.id, player);

    // Displace a bot if we exceed MIN_ENTITIES
    if (this.bots.length > 0 && this.players.size > config.MIN_ENTITIES) {
      this.displaceBot();
    }

    // Send welcome
    this.sendTo(ws, {
      t: MSG.WELCOME,
      id: player.id,
      mw: this.mapWidth,
      mh: this.mapHeight,
      obs: this.obstacles.map(o => o.serialize()),
      inst: this.instanceId,
    });

    return player;
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;

    this.players.delete(playerId);

    // If it was a bot, also remove from bots array
    if (player.isBot) {
      const idx = this.bots.findIndex(b => b.player.id === playerId);
      if (idx !== -1) this.bots.splice(idx, 1);
    }

    // Backfill bots to maintain MIN_ENTITIES
    while (this.players.size < config.MIN_ENTITIES) {
      this.addBot();
    }
  }

  getRealPlayerCount() {
    let count = 0;
    for (const [, p] of this.players) {
      if (!p.isBot) count++;
    }
    return count;
  }

  addBot() {
    const bot = new Bot();
    this.spawnAtRandom(bot.player);
    this.players.set(bot.player.id, bot.player);
    this.bots.push(bot);
    return bot;
  }

  displaceBot() {
    let lowestIdx = -1;
    let lowestScore = Infinity;
    for (let i = 0; i < this.bots.length; i++) {
      if (this.bots[i].player.score < lowestScore) {
        lowestScore = this.bots[i].player.score;
        lowestIdx = i;
      }
    }
    if (lowestIdx !== -1) {
      const bot = this.bots[lowestIdx];
      this.players.delete(bot.player.id);
      this.bots.splice(lowestIdx, 1);
    }
  }

  handleInput(playerId, input) {
    const player = this.players.get(playerId);
    if (player && player.alive) {
      player.applyInput(input);
    }
  }

  handleRespawn(playerId) {
    const player = this.players.get(playerId);
    if (player && !player.alive) {
      // If timer still running, mark that they want to respawn
      player.wantsRespawn = true;
      if (player.respawnTimer <= 0) {
        player.wantsRespawn = false;
        player.reset();
        this.spawnAtRandom(player);
      }
    }
  }

  // --- Main update loop ---

  update() {
    this.tick++;
    this.updatePositions();
    this.attractFood();
    this.autoFire();
    this.updateTurrets();
    this.updateProjectiles();
    this.checkCollisions();
    this.updateTimers();
    this.spawnFood();
    this.spawnMines();
    this.updateBots();
    this.broadcastState();
  }

  updatePositions() {
    for (const [, player] of this.players) {
      if (!player.alive) continue;

      // Calculate max speed (with spawn speed boost)
      let maxSpeed = player.speed;
      if (player.invulnTicks > 0) {
        const boostFade = player.invulnTicks / config.INVULNERABILITY_TICKS;
        maxSpeed *= 1 + (config.SPAWN_SPEED_BOOST - 1) * boostFade;
      }

      // Boost: hold-to-use fuel system
      if (player.boostActive && player.boostFuel > 0) {
        maxSpeed *= config.BOOST_MULTIPLIER;
        player.boostFuel = Math.max(0, player.boostFuel - config.BOOST_FUEL_DRAIN);
      } else if (!player.boostActive) {
        // Only regen fuel when button is released
        player.boostFuel = Math.min(config.BOOST_FUEL_MAX, player.boostFuel + config.BOOST_FUEL_REGEN);
      }

      // Physics: accelerate toward desired velocity
      const targetVx = player.inputDx * maxSpeed;
      const targetVy = player.inputDy * maxSpeed;

      if (player.inputDx !== 0 || player.inputDy !== 0) {
        // Accelerate toward target
        player.vx += (targetVx - player.vx) * config.ACCELERATION;
        player.vy += (targetVy - player.vy) * config.ACCELERATION;
      } else {
        // No input: apply friction (glide to stop)
        player.vx *= config.FRICTION;
        player.vy *= config.FRICTION;

        // Stop completely if very slow
        if (Math.abs(player.vx) < 0.05) player.vx = 0;
        if (Math.abs(player.vy) < 0.05) player.vy = 0;
      }

      // Apply velocity to position
      player.x += player.vx;
      player.y += player.vy;

      // Clamp to map bounds (and zero out velocity if hitting wall)
      if (player.x < player.radius) { player.x = player.radius; player.vx = 0; }
      if (player.x > this.mapWidth - player.radius) { player.x = this.mapWidth - player.radius; player.vx = 0; }
      if (player.y < player.radius) { player.y = player.radius; player.vy = 0; }
      if (player.y > this.mapHeight - player.radius) { player.y = this.mapHeight - player.radius; player.vy = 0; }

      // Resolve obstacle collisions (bounce + damage)
      for (const obs of this.obstacles) {
        if (circleRect(player, obs)) {
          // Compute collision normal before resolving
          const closestX = Math.max(obs.x, Math.min(player.x, obs.x + obs.width));
          const closestY = Math.max(obs.y, Math.min(player.y, obs.y + obs.height));
          const dx = player.x - closestX;
          const dy = player.y - closestY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          resolveCircleRect(player, obs);

          if (dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;

            // Reflect velocity off surface
            const dot = player.vx * nx + player.vy * ny;
            player.vx -= 2 * dot * nx;
            player.vy -= 2 * dot * ny;

            // Lose energy on bounce
            player.vx *= 0.6;
            player.vy *= 0.6;

            // Damage proportional to impact speed (ignore gentle touches)
            const impactSpeed = Math.abs(dot);
            if (impactSpeed > 1.5) {
              player.health -= impactSpeed * 0.8;
              if (player.health <= 0 && player.alive) {
                this.killPlayer(player, null);
              }
            }
          } else {
            player.vx *= -0.5;
            player.vy *= -0.5;
          }
        }
      }

      // Aim angle
      player.angle = player.aimAngle;

      // Health regen
      if (player.health < player.maxHealth) {
        player.health = Math.min(player.maxHealth, player.health + config.HEALTH_REGEN);
      }
    }
  }

  attractFood() {
    for (const [, player] of this.players) {
      if (!player.alive) continue;

      const attractRange = player.radius * 3;
      const attractRangeSq = attractRange * attractRange;

      for (const f of this.food) {
        const dx = player.x - f.x;
        const dy = player.y - f.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < attractRangeSq && distSq > 1) {
          const dist = Math.sqrt(distSq);
          // Stronger pull the closer the food is
          const strength = 1 - dist / attractRange;
          const pull = 2 + strength * 6;
          f.x += (dx / dist) * pull;
          f.y += (dy / dist) * pull;
        }
      }
    }
  }

  autoFire() {
    for (const [, player] of this.players) {
      if (!player.alive) continue;

      player.fireCooldown--;
      if (player.fireCooldown > 0) continue;

      const barrels = config.getBarrelsForTier(player.tier);
      const bulletRadius = config.bulletRadiusFromPlayerRadius(player.radius);
      const bulletDamage = config.bulletDamageFromPlayerRadius(player.radius);

      for (const barrel of barrels) {
        const angle = player.aimAngle + barrel.angle;
        const spawnDist = player.radius * barrel.length;
        const bx = player.x + Math.cos(angle) * spawnDist;
        const by = player.y + Math.sin(angle) * spawnDist;

        this.projectiles.push(new Projectile(
          bx, by, angle, bulletRadius, bulletDamage, player.id, player.color
        ));
      }

      player.fireCooldown = config.fireRateFromRadius(player.radius);
    }
  }

  updateTurrets() {
    const rangeSq = config.TURRET_RANGE * config.TURRET_RANGE;

    for (const turret of this.turrets) {
      turret.fireCooldown--;

      // Find nearest alive player in range
      let nearest = null;
      let nearestDistSq = rangeSq;
      for (const [, player] of this.players) {
        if (!player.alive || player.invulnTicks > 0) continue;
        const dx = player.x - turret.x;
        const dy = player.y - turret.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < nearestDistSq) {
          nearestDistSq = distSq;
          nearest = player;
        }
      }

      if (nearest) {
        // Rotate toward target
        const targetAngle = Math.atan2(nearest.y - turret.y, nearest.x - turret.x);
        let diff = targetAngle - turret.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        turret.angle += diff * 0.08; // slow tracking

        // Fire
        if (turret.fireCooldown <= 0) {
          turret.fireCooldown = config.TURRET_FIRE_RATE;
          const bx = turret.x + Math.cos(turret.angle) * 20;
          const by = turret.y + Math.sin(turret.angle) * 20;
          this.projectiles.push(new Projectile(
            bx, by, turret.angle,
            config.TURRET_BULLET_RADIUS,
            config.TURRET_BULLET_DAMAGE,
            'turret',
            config.TURRET_COLOR,
            config.TURRET_BULLET_SPEED,
            config.TURRET_BULLET_LIFETIME
          ));
        }
      }
    }
  }

  updateProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update();

      if (proj.isExpired() || proj.isOutOfBounds(this.mapWidth, this.mapHeight)) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Obstacle collision
      for (const obs of this.obstacles) {
        if (circleRect(proj, obs)) {
          this.projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  checkCollisions() {
    this.spatialHash.clear();

    // Insert all alive entities
    for (const [, player] of this.players) {
      if (player.alive) this.spatialHash.insert(player);
    }
    for (const proj of this.projectiles) {
      this.spatialHash.insert(proj);
    }
    for (const f of this.food) {
      this.spatialHash.insert(f);
    }
    for (const m of this.mines) {
      this.spatialHash.insert(m);
    }

    // Check player collisions
    const processed = new Set();
    for (const [, player] of this.players) {
      if (!player.alive) continue;

      const candidates = this.spatialHash.query(player);
      for (const other of candidates) {
        if (!circleCircle(player, other)) continue;

        if (other.type === 'food') {
          player.score += other.value;
          player.updateStats();
          player.boostFuel = Math.min(config.BOOST_FUEL_MAX, player.boostFuel + other.value * 0.15);
          this.removeFood(other);
        } else if (other.type === 'player' && other.alive && other.id !== player.id) {
          // Avoid double-processing
          const pairKey = player.id < other.id ? player.id + ':' + other.id : other.id + ':' + player.id;
          if (processed.has(pairKey)) continue;
          processed.add(pairKey);

          // Skip if both invulnerable
          if (player.invulnTicks > 0 && other.invulnTicks > 0) continue;

          // Ram damage
          if (player.invulnTicks <= 0 && other.invulnTicks <= 0) {
            const dmgToOther = config.ramDamage(player.radius, other.radius);
            const dmgToPlayer = config.ramDamage(other.radius, player.radius);
            other.health -= dmgToOther;
            player.health -= dmgToPlayer;
          } else if (player.invulnTicks > 0) {
            // Only other takes damage
            other.health -= config.ramDamage(player.radius, other.radius);
          } else {
            player.health -= config.ramDamage(other.radius, player.radius);
          }

          resolveCircleCircle(player, other);

          if (other.health <= 0 && other.alive) this.killPlayer(other, player);
          if (player.health <= 0 && player.alive) this.killPlayer(player, other);
        } else if (other.type === 'projectile' && other.ownerId !== player.id) {
          if (player.invulnTicks > 0) continue;

          player.health -= other.damage;
          this.removeProjectile(other);

          if (player.health <= 0 && player.alive) {
            const killer = this.players.get(other.ownerId);
            this.killPlayer(player, killer);
          }
        } else if (other.type === 'mine') {
          if (player.invulnTicks > 0) continue;
          // Mine explosion: 50% max health damage
          player.health -= player.maxHealth * config.MINE_DAMAGE_PERCENT;
          this.explosions.push({ x: other.x, y: other.y, r: 80 });
          this.removeMine(other);
          if (player.health <= 0 && player.alive) {
            this.killPlayer(player, null);
          }
        }
      }
    }
  }

  killPlayer(victim, killer) {
    victim.alive = false;
    victim.respawnTimer = config.RESPAWN_DELAY;

    if (killer && killer.alive) {
      killer.score += Math.floor(victim.score * config.KILL_SCORE_PERCENT) + config.KILL_SCORE_FLAT;
      killer.kills++;
      killer.updateStats();
    }

    // Notify victim
    if (victim.ws) {
      const deathMsg = {
        t: MSG.DEATH,
        killerName: killer ? killer.name : null,
        score: victim.score,
        kills: victim.kills,
      };
      if (killer && killer.catchphrase) deathMsg.catchphrase = killer.catchphrase;
      this.sendTo(victim.ws, deathMsg);
    }

    // Broadcast kill feed
    const killMsg = {
      t: MSG.KILL_FEED,
      killer: killer ? killer.name : '???',
      victim: victim.name,
      x: Math.round(victim.x),
      y: Math.round(victim.y),
    };
    if (killer && killer.catchphrase) killMsg.catchphrase = killer.catchphrase;
    this.broadcast(killMsg);

    // Scatter some food at death location
    const foodCount = Math.min(15, Math.floor(victim.score / 50) + 2);
    for (let i = 0; i < foodCount; i++) {
      const angle = (i / foodCount) * Math.PI * 2;
      const dist = 20 + Math.random() * 40;
      const fx = victim.x + Math.cos(angle) * dist;
      const fy = victim.y + Math.sin(angle) * dist;
      if (fx > 0 && fx < this.mapWidth && fy > 0 && fy < this.mapHeight) {
        this.food.push(new Food(fx, fy, config.FOOD_TYPES[0]));
      }
    }
  }

  updateTimers() {
    for (const [, player] of this.players) {
      if (!player.alive) {
        player.respawnTimer--;
        if (player.respawnTimer <= 0 && (player.isBot || player.wantsRespawn)) {
          player.wantsRespawn = false;
          player.reset();
          this.spawnAtRandom(player);
        }
      }
      if (player.invulnTicks > 0) {
        player.invulnTicks--;
      }
    }
  }

  // --- Food ---

  spawnFood() {
    while (this.food.length < config.FOOD_TARGET_COUNT) {
      const type = this.randomFoodType();
      let x, y, valid;
      let attempts = 0;
      do {
        x = 50 + Math.random() * (this.mapWidth - 100);
        y = 50 + Math.random() * (this.mapHeight - 100);
        valid = !this.obstacles.some(obs => circleRect({ x, y, radius: type.radius + 5 }, obs));
        attempts++;
      } while (!valid && attempts < 10);

      this.food.push(new Food(x, y, type));
    }
  }

  randomFoodType() {
    const roll = Math.random() * 100;
    let cumulative = 0;
    for (const t of config.FOOD_TYPES) {
      cumulative += t.weight;
      if (roll < cumulative) return t;
    }
    return config.FOOD_TYPES[0];
  }

  removeFood(food) {
    const idx = this.food.indexOf(food);
    if (idx !== -1) this.food.splice(idx, 1);
  }

  removeProjectile(proj) {
    const idx = this.projectiles.indexOf(proj);
    if (idx !== -1) this.projectiles.splice(idx, 1);
  }

  // --- Mines ---

  spawnMines() {
    while (this.mines.length < config.MINE_COUNT) {
      let x, y, valid;
      let attempts = 0;
      do {
        x = 100 + Math.random() * (this.mapWidth - 200);
        y = 100 + Math.random() * (this.mapHeight - 200);
        valid = !this.obstacles.some(obs => circleRect({ x, y, radius: config.MINE_RADIUS + 10 }, obs));
        attempts++;
      } while (!valid && attempts < 10);
      this.mines.push(new Mine(x, y));
    }
  }

  removeMine(mine) {
    const idx = this.mines.indexOf(mine);
    if (idx !== -1) this.mines.splice(idx, 1);
  }

  // --- Bots ---

  spawnBots() {
    for (let i = 0; i < config.BOT_COUNT; i++) {
      this.addBot();
    }
  }

  updateBots() {
    for (const bot of this.bots) {
      bot.update(this);
    }
  }

  // --- Spawning ---

  spawnAtRandom(player) {
    let bestX = this.mapWidth / 2;
    let bestY = this.mapHeight / 2;
    let bestMinDist = 0;

    // Try multiple positions, pick the one farthest from any other player
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = 150 + Math.random() * (this.mapWidth - 300);
      const y = 150 + Math.random() * (this.mapHeight - 300);

      if (this.isNearObstacle(x, y, 80)) continue;

      let minDist = Infinity;
      for (const [, other] of this.players) {
        if (other === player || !other.alive) continue;
        const dx = other.x - x;
        const dy = other.y - y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) minDist = dist;
      }

      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestX = x;
        bestY = y;
      }
    }

    player.x = bestX;
    player.y = bestY;
  }

  isNearObstacle(x, y, margin) {
    return this.obstacles.some(obs =>
      x > obs.x - margin && x < obs.x + obs.width + margin &&
      y > obs.y - margin && y < obs.y + obs.height + margin
    );
  }

  // --- Networking ---

  broadcastState() {
    // Build leaderboard once (all players, lightweight)
    const leaderboard = [];
    for (const [, p] of this.players) {
      if (p.alive) {
        leaderboard.push({ i: p.id, n: p.name, s: p.score, k: p.kills, c: p.color, ti: p.tier });
      }
    }
    leaderboard.sort((a, b) => b.s - a.s);
    const top10 = leaderboard.slice(0, 10);

    for (const [, player] of this.players) {
      if (!player.ws) continue; // skip bots

      // Viewport culling
      const zoom = 1.0 / (1 + (player.radius - 20) * 0.012);
      const halfW = (player.viewportW || 1920) / zoom / 2 + 200;
      const halfH = (player.viewportH || 1080) / zoom / 2 + 200;

      const visiblePlayers = [];
      for (const [, p] of this.players) {
        if (Math.abs(p.x - player.x) < halfW && Math.abs(p.y - player.y) < halfH) {
          visiblePlayers.push(p.serialize());
        }
      }

      const visibleBullets = [];
      for (const b of this.projectiles) {
        if (Math.abs(b.x - player.x) < halfW && Math.abs(b.y - player.y) < halfH) {
          visibleBullets.push(b.serialize());
        }
      }

      const visibleFood = [];
      for (const f of this.food) {
        if (Math.abs(f.x - player.x) < halfW && Math.abs(f.y - player.y) < halfH) {
          visibleFood.push(f.serialize());
        }
      }

      const visibleMines = [];
      for (const m of this.mines) {
        if (Math.abs(m.x - player.x) < halfW && Math.abs(m.y - player.y) < halfH) {
          visibleMines.push(m.serialize());
        }
      }

      const visibleTurrets = [];
      for (const t of this.turrets) {
        if (Math.abs(t.x - player.x) < halfW && Math.abs(t.y - player.y) < halfH) {
          visibleTurrets.push({ x: Math.round(t.x), y: Math.round(t.y), a: Math.round(t.angle * 100) / 100 });
        }
      }

      const visibleExplosions = [];
      for (const e of this.explosions) {
        if (Math.abs(e.x - player.x) < halfW && Math.abs(e.y - player.y) < halfH) {
          visibleExplosions.push(e);
        }
      }

      const msg = {
        t: MSG.STATE,
        k: this.tick,
        p: visiblePlayers,
        b: visibleBullets,
        f: visibleFood,
        mn: visibleMines,
        tu: visibleTurrets,
        lb: top10,
      };
      if (visibleExplosions.length > 0) msg.ex = visibleExplosions;
      this.sendTo(player.ws, msg);
    }

    // Send state to spectators at 10Hz (every 3rd tick) to avoid lag
    this.spectatorTickCounter++;
    if (this.spectators.length > 0 && this.spectatorTickCounter % 3 === 0) {
      const allPlayers = [];
      for (const [, p] of this.players) {
        allPlayers.push(p.serialize());
      }
      const allBullets = [];
      for (const b of this.projectiles) {
        allBullets.push(b.serialize());
      }
      const allMines = [];
      for (const m of this.mines) {
        allMines.push(m.serialize());
      }
      const allTurrets = [];
      for (const t of this.turrets) {
        allTurrets.push({ x: Math.round(t.x), y: Math.round(t.y), a: Math.round(t.angle * 100) / 100 });
      }

      const specMsg = {
        t: MSG.STATE,
        k: this.tick,
        p: allPlayers,
        b: allBullets,
        mn: allMines,
        tu: allTurrets,
        lb: top10,
      };
      if (this.explosions.length > 0) specMsg.ex = this.explosions;
      const specStr = JSON.stringify(specMsg);

      for (let i = this.spectators.length - 1; i >= 0; i--) {
        const ws = this.spectators[i];
        if (ws.readyState === 1) {
          ws.send(specStr);
        } else {
          this.spectators.splice(i, 1);
        }
      }
    }

    // Clear one-time events after broadcast
    this.explosions = [];
  }

  sendTo(ws, data) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    }
  }

  broadcast(data) {
    const msg = JSON.stringify(data);
    for (const [, player] of this.players) {
      if (player.ws && player.ws.readyState === 1) {
        player.ws.send(msg);
      }
    }
  }
}

module.exports = Game;
