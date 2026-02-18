const config = require('./config');

let nextId = 1;

class Player {
  constructor(name, color, ws, catchphrase, accentColor, decal, bulletShape) {
    this.id = 'p' + (nextId++);
    this.name = name;
    this.color = color;
    this.accentColor = accentColor || color;
    this.decal = (typeof decal === 'number') ? decal : 0;
    this.bulletShape = (typeof bulletShape === 'number') ? bulletShape : 0;
    this.ws = ws; // null for bots
    this.catchphrase = catchphrase || '';
    this.type = 'player';

    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;

    this.score = 0;
    this.kills = 0;
    this.radius = config.BASE_RADIUS;
    this.speed = config.BASE_SPEED;
    this.health = config.healthFromRadius(config.BASE_RADIUS);
    this.maxHealth = config.healthFromRadius(config.BASE_RADIUS);
    this.tier = 1;

    this.fireCooldown = 0;
    this.alive = true;
    this.respawnTimer = 0;
    this.invulnTicks = config.INVULNERABILITY_TICKS;
    this.wantsRespawn = false;

    // Input state
    this.inputDx = 0;
    this.inputDy = 0;
    this.aimAngle = 0;

    // Boost (fuel system)
    this.boostFuel = config.BOOST_FUEL_MAX;
    this.boostActive = false; // set by input each tick
    this.boostLockoutTicks = 0; // prevent auto-boost after respawn

    // Warp hole cooldown
    this.warpCooldown = 0;

    // Power-ups (two slots: gun + movement, stackable)
    this.gunPowerUp = null;        // 'laser' or 'rapidfire'
    this.gunPowerUpTicks = 0;
    this.gunPowerUpMaxTicks = 0;
    this.speedPowerUpTicks = 0;    // > 0 means speed boost active
    this.speedPowerUpMaxTicks = 0;

    // Viewport (for culling)
    this.viewportW = 1920;
    this.viewportH = 1080;
  }

  applyInput(input) {
    this.inputDx = input.dx || 0;
    this.inputDy = input.dy || 0;
    if (input.a !== undefined) this.aimAngle = input.a;

    // Boost: held by client, server manages fuel (lockout prevents auto-boost after respawn)
    this.boostActive = !!(input.boost && this.alive && this.boostLockoutTicks <= 0);
  }

  updateStats() {
    const oldMax = this.maxHealth;
    this.radius = config.radiusFromScore(this.score);
    this.speed = config.speedFromScore(this.score);
    this.maxHealth = config.healthFromRadius(this.radius);
    this.tier = config.tierFromScore(this.score);

    // Heal proportionally when growing
    if (this.maxHealth > oldMax) {
      this.health += this.maxHealth - oldMax;
    }
    this.health = Math.min(this.health, this.maxHealth);
  }

  reset() {
    this.score = 0;
    this.kills = 0;
    this.radius = config.BASE_RADIUS;
    this.speed = config.BASE_SPEED;
    this.health = config.healthFromRadius(config.BASE_RADIUS);
    this.maxHealth = config.healthFromRadius(config.BASE_RADIUS);
    this.tier = 1;
    this.fireCooldown = 0;
    this.alive = true;
    this.invulnTicks = config.INVULNERABILITY_TICKS;
    this.wantsRespawn = false;
    this.vx = 0;
    this.vy = 0;
    this.inputDx = 0;
    this.inputDy = 0;
    this.boostFuel = config.BOOST_FUEL_MAX;
    this.boostActive = false;
    this.boostLockoutTicks = 15; // ~0.5s lockout prevents auto-boost on respawn
    this.warpCooldown = 0;
    this.gunPowerUp = null;
    this.gunPowerUpTicks = 0;
    this.gunPowerUpMaxTicks = 0;
    this.speedPowerUpTicks = 0;
    this.speedPowerUpMaxTicks = 0;
  }

  serialize() {
    return {
      i: this.id,
      x: Math.round(this.x * 10) / 10,
      y: Math.round(this.y * 10) / 10,
      a: Math.round(this.aimAngle * 1000) / 1000,
      r: Math.round(this.radius * 10) / 10,
      s: this.score,
      h: Math.round(this.health),
      mh: Math.round(this.maxHealth),
      n: this.name,
      c: this.color,
      ac: this.accentColor,
      d: this.decal,
      bs: this.bulletShape,
      k: this.kills,
      ti: this.tier,
      al: this.alive ? 1 : 0,
      inv: this.invulnTicks > 0 ? 1 : 0,
      bf: Math.round(this.boostFuel),     // boost fuel remaining
      bfm: config.BOOST_FUEL_MAX,          // boost fuel max (for UI)
      boosting: this.boostActive && this.boostFuel > 0 ? 1 : 0,
      gpu: this.gunPowerUp,             // gun power-up: 'laser', 'rapidfire', or null
      gpt: this.gunPowerUpTicks,        // gun power-up ticks remaining
      gptm: this.gunPowerUpMaxTicks,    // gun power-up max ticks
      spt: this.speedPowerUpTicks,      // speed power-up ticks remaining
      sptm: this.speedPowerUpMaxTicks,  // speed power-up max ticks
    };
  }
}

module.exports = Player;
