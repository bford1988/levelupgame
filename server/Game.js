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
    this.warpEffects = []; // temporary, cleared after broadcast
    this.beams = [];      // temporary laser beams, cleared after broadcast
    this.bots = [];
    this.powerUps = [];
    this.spectators = []; // admin spectator websockets
    this.warpHoles = []; // warp hole portals
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

    // Create warp holes
    for (const wh of config.WARP_HOLES) {
      this.warpHoles.push({
        x: wh.x,
        y: wh.y,
        radius: config.WARP_HOLE_RADIUS,
        maxScore: wh.maxScore,
      });
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
      wh: this.warpHoles.map(wh => ({ x: wh.x, y: wh.y, r: wh.radius, ms: wh.maxScore })),
      inst: this.instanceId,
    });
  }

  removeSpectator(ws) {
    this.spectators = this.spectators.filter(s => s !== ws);
  }

  addPlayer(ws, name, color, catchphrase, accentColor, decal, bulletShape) {
    if (this.getRealPlayerCount() >= config.MAX_PLAYERS) {
      return null;
    }

    const player = new Player(name, color, ws, catchphrase, accentColor, decal, bulletShape);
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
      wh: this.warpHoles.map(wh => ({ x: wh.x, y: wh.y, r: wh.radius, ms: wh.maxScore })),
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
    this.updateMines();
    this.attractFood();
    this.autoFire();
    this.updateTurrets();
    this.updateProjectiles();
    this.checkCollisions();
    this.updateTimers();
    this.spawnFood();
    this.spawnMines();
    this.spawnPowerUps();
    this.updateBots();
    this.broadcastState();
  }

  updatePositions() {
    for (const [, player] of this.players) {
      if (!player.alive) continue;

      // Calculate max speed (with spawn speed boost and power-ups)
      let maxSpeed = player.speed;
      if (player.speedPowerUpTicks > 0) maxSpeed *= config.SPEED_POWERUP_MULT;
      if (player.invulnTicks > 0) {
        const boostFade = player.invulnTicks / config.INVULNERABILITY_TICKS;
        maxSpeed *= 1 + (config.SPAWN_SPEED_BOOST - 1) * boostFade;
      }

      // Boost lockout countdown (prevents auto-boost after respawn)
      if (player.boostLockoutTicks > 0) player.boostLockoutTicks--;

      // Boost: hold-to-use fuel system
      if (player.boostActive && player.boostFuel > 0) {
        maxSpeed *= config.BOOST_MULTIPLIER;
        player.boostFuel = Math.max(0, player.boostFuel - config.BOOST_FUEL_DRAIN);
      } else if (!player.boostActive) {
        // Regen scales with size: fast for small, slow for big
        const regenRate = config.boostRegenFromRadius(player.radius);
        player.boostFuel = Math.min(config.BOOST_FUEL_MAX, player.boostFuel + regenRate);
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

      // Also attract power-ups
      for (const pu of this.powerUps) {
        const dx = player.x - pu.x;
        const dy = player.y - pu.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < attractRangeSq && distSq > 1) {
          const dist = Math.sqrt(distSq);
          const strength = 1 - dist / attractRange;
          const pull = 2 + strength * 6;
          pu.x += (dx / dist) * pull;
          pu.y += (dy / dist) * pull;
        }
      }
    }
  }

  autoFire() {
    for (const [, player] of this.players) {
      if (!player.alive) continue;

      player.fireCooldown--;
      if (player.fireCooldown > 0) continue;

      if (player.gunPowerUp === 'laser') {
        // Laser: hitscan beam
        this.fireLaser(player);
        player.fireCooldown = config.LASER_FIRE_RATE;
      } else {
        // Normal bullets (with rapid fire modifier)
        const barrels = config.getBarrelsForTier(player.tier);
        const bulletRadius = config.bulletRadiusFromPlayerRadius(player.radius);
        const bulletDamage = config.bulletDamageFromPlayerRadius(player.radius);

        const isRapid = player.gunPowerUp === 'rapidfire';
        const bulletSpeed = isRapid ? config.BULLET_SPEED * config.RAPID_FIRE_SPEED_MULT : undefined;
        const bulletLifetime = isRapid ? Math.round(config.BULLET_LIFETIME * config.RAPID_FIRE_RANGE_MULT) : undefined;

        for (const barrel of barrels) {
          const angle = player.aimAngle + barrel.angle;
          const spawnDist = player.radius * barrel.length;
          const bx = player.x + Math.cos(angle) * spawnDist;
          const by = player.y + Math.sin(angle) * spawnDist;

          this.projectiles.push(new Projectile(
            bx, by, angle, bulletRadius, bulletDamage, player.id, player.color, bulletSpeed, bulletLifetime, player.bulletShape
          ));
        }

        let cooldown = config.fireRateFromRadius(player.radius);
        if (isRapid) {
          cooldown = Math.max(2, Math.floor(cooldown / config.RAPID_FIRE_MULT));
        }
        player.fireCooldown = cooldown;
      }
    }
  }

  fireLaser(player) {
    const angle = player.aimAngle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const startX = player.x + cos * player.radius;
    const startY = player.y + sin * player.radius;
    const maxRange = config.LASER_RANGE;
    const damage = config.bulletDamageFromPlayerRadius(player.radius) * config.LASER_DAMAGE_MULT;

    // Find beam endpoint: check obstacles
    let beamLen = maxRange;
    for (const obs of this.obstacles) {
      const hitDist = this.rayRectIntersect(startX, startY, cos, sin, obs);
      if (hitDist !== null && hitDist < beamLen) {
        beamLen = hitDist;
      }
    }

    // Check players along beam - find closest hit
    let closestHitDist = beamLen;
    let hitPlayer = null;
    for (const [, other] of this.players) {
      if (other === player || !other.alive || other.invulnTicks > 0) continue;
      const hitDist = this.rayCircleIntersect(startX, startY, cos, sin, other.x, other.y, other.radius);
      if (hitDist !== null && hitDist < closestHitDist) {
        closestHitDist = hitDist;
        hitPlayer = other;
      }
    }

    // Apply damage to hit player
    if (hitPlayer) {
      hitPlayer.health -= damage;
      beamLen = closestHitDist;
      if (hitPlayer.health <= 0 && hitPlayer.alive) {
        this.killPlayer(hitPlayer, player);
      }
    }

    // Store beam for broadcast
    const endX = startX + cos * beamLen;
    const endY = startY + sin * beamLen;
    this.beams.push({
      x1: Math.round(startX),
      y1: Math.round(startY),
      x2: Math.round(endX),
      y2: Math.round(endY),
      c: player.color,
    });
  }

  rayRectIntersect(ox, oy, dx, dy, rect) {
    // Returns distance to intersection or null
    const tMinX = (rect.x - ox) / (dx || 1e-10);
    const tMaxX = (rect.x + rect.width - ox) / (dx || 1e-10);
    const tMinY = (rect.y - oy) / (dy || 1e-10);
    const tMaxY = (rect.y + rect.height - oy) / (dy || 1e-10);

    const tNearX = Math.min(tMinX, tMaxX);
    const tFarX = Math.max(tMinX, tMaxX);
    const tNearY = Math.min(tMinY, tMaxY);
    const tFarY = Math.max(tMinY, tMaxY);

    const tNear = Math.max(tNearX, tNearY);
    const tFar = Math.min(tFarX, tFarY);

    if (tNear > tFar || tFar < 0) return null;
    const t = tNear > 0 ? tNear : tFar;
    return t > 0 ? t : null;
  }

  rayCircleIntersect(ox, oy, dx, dy, cx, cy, cr) {
    // Returns distance to intersection or null
    const fx = ox - cx;
    const fy = oy - cy;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - cr * cr;
    let disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    disc = Math.sqrt(disc);
    const t1 = (-b - disc) / (2 * a);
    const t2 = (-b + disc) / (2 * a);
    if (t1 >= 0) return t1;
    if (t2 >= 0) return t2;
    return null;
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
    for (const pu of this.powerUps) {
      this.spatialHash.insert(pu);
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
        } else if (other.type === 'powerup') {
          // Pick up power-up (gun and speed are separate slots, stackable)
          const puDef = config.POWERUP_TYPES.find(t => t.type === other.puType);
          if (puDef) {
            if (other.puType === 'speed') {
              player.speedPowerUpTicks = puDef.duration;
              player.speedPowerUpMaxTicks = puDef.duration;
            } else {
              // laser or rapidfire go in gun slot (replaces current gun power-up)
              player.gunPowerUp = other.puType;
              player.gunPowerUpTicks = puDef.duration;
              player.gunPowerUpMaxTicks = puDef.duration;
            }
          }
          this.removePowerUp(other);
        }
      }

      // Warp hole collision (separate from spatial hash since they're few and static)
      if (player.alive && player.warpCooldown <= 0) {
        for (const wh of this.warpHoles) {
          const dx = player.x - wh.x;
          const dy = player.y - wh.y;
          const distSq = dx * dx + dy * dy;
          const touchDist = wh.radius + player.radius;

          if (distSq < touchDist * touchDist) {
            if (player.score > wh.maxScore) {
              // Too big - notify player (once per cooldown)
              if (player.ws && player.warpCooldown <= 0) {
                this.sendTo(player.ws, {
                  t: MSG.WARP_DENIED,
                  ms: wh.maxScore,
                });
                player.warpCooldown = 60; // 2s cooldown before next denial message
              }
            } else {
              // Eligible - warp to empty spot
              const dest = this.findEmptySpot(player);
              this.warpEffects.push({ x: player.x, y: player.y, r: wh.radius });
              this.warpEffects.push({ x: dest.x, y: dest.y, r: 40 });
              player.x = dest.x;
              player.y = dest.y;
              player.vx = 0;
              player.vy = 0;
              player.warpCooldown = config.WARP_HOLE_COOLDOWN;
            }
            break;
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

    // Scatter food at death location - scales with victim's score/tier
    const foodCount = config.deathFoodCount(victim.score);
    const foodType = config.deathFoodValue(victim.score);
    const scatterRadius = 20 + Math.min(80, victim.radius * 0.5);
    for (let i = 0; i < foodCount; i++) {
      const angle = (i / foodCount) * Math.PI * 2;
      const dist = scatterRadius * (0.4 + Math.random() * 0.6);
      const fx = victim.x + Math.cos(angle) * dist;
      const fy = victim.y + Math.sin(angle) * dist;
      if (fx > 0 && fx < this.mapWidth && fy > 0 && fy < this.mapHeight) {
        this.food.push(new Food(fx, fy, foodType));
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
      if (player.warpCooldown > 0) {
        player.warpCooldown--;
      }
      if (player.gunPowerUpTicks > 0) {
        player.gunPowerUpTicks--;
        if (player.gunPowerUpTicks <= 0) {
          player.gunPowerUp = null;
          player.gunPowerUpMaxTicks = 0;
        }
      }
      if (player.speedPowerUpTicks > 0) {
        player.speedPowerUpTicks--;
        if (player.speedPowerUpTicks <= 0) {
          player.speedPowerUpMaxTicks = 0;
        }
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
        valid = !this.obstacles.some(obs => circleRect({ x, y, radius: type.radius + 5 }, obs))
          && !this.isNearWarpHole(x, y, config.WARP_HOLE_RADIUS + 10);
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

  updateMines() {
    for (const m of this.mines) {
      m.update(this.mapWidth, this.mapHeight);
    }
  }

  spawnMines() {
    while (this.mines.length < config.MINE_COUNT) {
      let x, y, valid;
      let attempts = 0;
      do {
        x = 100 + Math.random() * (this.mapWidth - 200);
        y = 100 + Math.random() * (this.mapHeight - 200);
        valid = !this.obstacles.some(obs => circleRect({ x, y, radius: config.MINE_RADIUS + 10 }, obs))
          && !this.isNearWarpHole(x, y, config.WARP_HOLE_RADIUS + 30);
        attempts++;
      } while (!valid && attempts < 10);
      this.mines.push(new Mine(x, y));
    }
  }

  removeMine(mine) {
    const idx = this.mines.indexOf(mine);
    if (idx !== -1) this.mines.splice(idx, 1);
  }

  // --- Power-ups ---

  spawnPowerUps() {
    for (const puDef of config.POWERUP_TYPES) {
      let count = 0;
      for (const p of this.powerUps) { if (p.puType === puDef.type) count++; }
      while (count < puDef.maxCount) {
        count++;
        let x, y, valid;
        let attempts = 0;
        do {
          x = 200 + Math.random() * (this.mapWidth - 400);
          y = 200 + Math.random() * (this.mapHeight - 400);
          valid = !this.isNearObstacle(x, y, 60) && !this.isNearWarpHole(x, y, 100);
          attempts++;
        } while (!valid && attempts < 10);
        this.powerUps.push({
          id: 'pu' + this.tick + '_' + Math.random().toString(36).slice(2, 6),
          type: 'powerup',
          puType: puDef.type,
          x, y,
          radius: puDef.radius,
          color: puDef.color,
        });
      }
    }
  }

  removePowerUp(pu) {
    const idx = this.powerUps.indexOf(pu);
    if (idx !== -1) this.powerUps.splice(idx, 1);
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
    const spot = this.findEmptySpot(player);
    player.x = spot.x;
    player.y = spot.y;
  }

  findEmptySpot(excludePlayer) {
    let bestX = this.mapWidth / 2;
    let bestY = this.mapHeight / 2;
    let bestMinDist = 0;

    // Try many positions, pick the one farthest from any alive player
    for (let attempt = 0; attempt < 50; attempt++) {
      const x = 200 + Math.random() * (this.mapWidth - 400);
      const y = 200 + Math.random() * (this.mapHeight - 400);

      if (this.isNearObstacle(x, y, 100)) continue;
      if (this.isNearWarpHole(x, y, 150)) continue;

      let minDist = Infinity;
      for (const [, other] of this.players) {
        if (other === excludePlayer || !other.alive) continue;
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

    return { x: bestX, y: bestY };
  }

  isNearObstacle(x, y, margin) {
    return this.obstacles.some(obs =>
      x > obs.x - margin && x < obs.x + obs.width + margin &&
      y > obs.y - margin && y < obs.y + obs.height + margin
    );
  }

  isNearWarpHole(x, y, margin) {
    return this.warpHoles.some(wh => {
      const dx = wh.x - x;
      const dy = wh.y - y;
      return dx * dx + dy * dy < margin * margin;
    });
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

      const visibleWarps = [];
      for (const w of this.warpEffects) {
        if (Math.abs(w.x - player.x) < halfW && Math.abs(w.y - player.y) < halfH) {
          visibleWarps.push(w);
        }
      }

      const visiblePowerUps = [];
      for (const pu of this.powerUps) {
        if (Math.abs(pu.x - player.x) < halfW && Math.abs(pu.y - player.y) < halfH) {
          visiblePowerUps.push({ x: Math.round(pu.x), y: Math.round(pu.y), r: pu.radius, c: pu.color, pt: pu.puType });
        }
      }

      const visibleBeams = [];
      for (const bm of this.beams) {
        // Check if either endpoint is in viewport
        if ((Math.abs(bm.x1 - player.x) < halfW && Math.abs(bm.y1 - player.y) < halfH) ||
            (Math.abs(bm.x2 - player.x) < halfW && Math.abs(bm.y2 - player.y) < halfH)) {
          visibleBeams.push(bm);
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
      if (visibleWarps.length > 0) msg.wp = visibleWarps;
      if (visiblePowerUps.length > 0) msg.pu = visiblePowerUps;
      if (visibleBeams.length > 0) msg.bm = visibleBeams;
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
    this.warpEffects = [];
    this.beams = [];
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
