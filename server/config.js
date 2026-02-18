const config = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  TICK_RATE: 30,
  MAP_WIDTH: 10000,
  MAP_HEIGHT: 10000,
  MAX_PLAYERS: 50,
  MIN_ENTITIES: 30,
  BOT_COUNT: 30,

  // Food
  FOOD_TARGET_COUNT: 500,
  FOOD_TYPES: [
    { weight: 70, radius: 5, value: 5, color: '#FFEB3B' },
    { weight: 25, radius: 10, value: 25, color: '#FF9800' },
    { weight: 5, radius: 18, value: 100, color: '#F44336' },
  ],

  // Player base stats
  BASE_RADIUS: 20,
  BASE_SPEED: 5.5,
  BASE_HEALTH: 150,
  ACCELERATION: 0.18,
  FRICTION: 0.94,

  // Boost (hold-to-use fuel system)
  BOOST_MULTIPLIER: 3.0,
  BOOST_FUEL_MAX: 180,      // ticks of full boost (~6 seconds)
  BOOST_FUEL_DRAIN: 1,      // fuel consumed per tick while boosting
  BOOST_FUEL_REGEN: 0.5,    // fuel recovered per tick while not boosting

  // Projectile base stats
  BASE_BULLET_RADIUS: 4,
  BASE_BULLET_DAMAGE: 7,
  BASE_FIRE_RATE: 10,
  BULLET_SPEED: 22, // fast enough to always outrun boosted players
  BULLET_LIFETIME: 45, // shorter lifetime to compensate for speed increase

  // Combat
  RAM_DAMAGE_FACTOR: 8,
  RESPAWN_DELAY: 60,
  INVULNERABILITY_TICKS: 90,
  SPAWN_SPEED_BOOST: 1.8,

  // Turrets (on some obstacles)
  TURRET_CHANCE: 0.18,           // ~18% of obstacles get a turret
  TURRET_RANGE: 600,
  TURRET_FIRE_RATE: 30,          // ticks between shots
  TURRET_BULLET_SPEED: 14,
  TURRET_BULLET_DAMAGE: 12,
  TURRET_BULLET_RADIUS: 5,
  TURRET_BULLET_LIFETIME: 50,
  TURRET_COLOR: '#ff3333',

  // Mines
  MINE_COUNT: 25,
  MINE_RADIUS: 14,
  MINE_DAMAGE_PERCENT: 0.5,      // 50% of max health
  HEALTH_REGEN: 0.5,

  // Kill reward
  KILL_SCORE_PERCENT: 0.5,
  KILL_SCORE_FLAT: 50,

  // 25 Tier thresholds - exponential scaling, goes deep
  TIER_THRESHOLDS: [
    0, 200, 600, 1200, 2500,
    5000, 10000, 20000, 40000, 75000,
    130000, 220000, 380000, 600000, 950000,
    1500000, 2400000, 3800000, 6000000, 9500000,
    15000000, 24000000, 38000000, 60000000, 100000000,
  ],

  // Map obstacles (spread across 10K x 10K map, ~80 total)
  OBSTACLES: [
    // Center cluster
    { x: 4800, y: 4800, width: 250, height: 250 },
    { x: 5100, y: 4700, width: 80, height: 200 },
    { x: 4600, y: 5100, width: 200, height: 80 },
    { x: 5200, y: 5200, width: 100, height: 100 },
    { x: 4400, y: 4500, width: 60, height: 180 },
    // Quadrant anchors (NW, NE, SW, SE)
    { x: 2000, y: 2000, width: 180, height: 70 },
    { x: 2200, y: 2200, width: 70, height: 130 },
    { x: 8000, y: 2000, width: 70, height: 180 },
    { x: 7800, y: 2200, width: 130, height: 60 },
    { x: 2000, y: 8000, width: 100, height: 140 },
    { x: 2300, y: 7800, width: 60, height: 100 },
    { x: 8000, y: 8000, width: 140, height: 100 },
    { x: 7700, y: 8200, width: 100, height: 60 },
    // Cardinal mid-ring
    { x: 5000, y: 1500, width: 120, height: 50 },
    { x: 5200, y: 1600, width: 50, height: 100 },
    { x: 1500, y: 5000, width: 50, height: 120 },
    { x: 1600, y: 5200, width: 100, height: 50 },
    { x: 5000, y: 8500, width: 120, height: 50 },
    { x: 4800, y: 8400, width: 50, height: 100 },
    { x: 8500, y: 5000, width: 50, height: 120 },
    { x: 8400, y: 4800, width: 100, height: 50 },
    // Inner ring (r~2000 from center)
    { x: 3200, y: 3500, width: 90, height: 90 },
    { x: 6800, y: 3500, width: 90, height: 90 },
    { x: 3200, y: 6500, width: 90, height: 90 },
    { x: 6800, y: 6500, width: 90, height: 90 },
    { x: 3800, y: 3000, width: 60, height: 120 },
    { x: 6200, y: 3000, width: 120, height: 60 },
    { x: 3800, y: 7000, width: 120, height: 60 },
    { x: 6200, y: 7000, width: 60, height: 120 },
    // Diagonal corridors
    { x: 3800, y: 1200, width: 60, height: 150 },
    { x: 6200, y: 8800, width: 150, height: 60 },
    { x: 1200, y: 3200, width: 150, height: 50 },
    { x: 8800, y: 7000, width: 50, height: 150 },
    { x: 7200, y: 1800, width: 100, height: 40 },
    { x: 2800, y: 8200, width: 40, height: 100 },
    { x: 1800, y: 7200, width: 100, height: 40 },
    { x: 8200, y: 2800, width: 40, height: 100 },
    // Edge walls (north)
    { x: 800, y: 500, width: 200, height: 50 },
    { x: 2500, y: 400, width: 50, height: 150 },
    { x: 4000, y: 600, width: 140, height: 60 },
    { x: 6000, y: 500, width: 60, height: 140 },
    { x: 7500, y: 400, width: 150, height: 50 },
    { x: 9200, y: 600, width: 50, height: 130 },
    // Edge walls (south)
    { x: 800, y: 9400, width: 180, height: 50 },
    { x: 2500, y: 9500, width: 50, height: 130 },
    { x: 4000, y: 9300, width: 130, height: 60 },
    { x: 6000, y: 9400, width: 60, height: 130 },
    { x: 7500, y: 9500, width: 140, height: 50 },
    { x: 9200, y: 9300, width: 50, height: 120 },
    // Edge walls (west)
    { x: 400, y: 1500, width: 50, height: 140 },
    { x: 500, y: 3500, width: 130, height: 50 },
    { x: 400, y: 6500, width: 50, height: 150 },
    { x: 600, y: 8500, width: 120, height: 50 },
    // Edge walls (east)
    { x: 9500, y: 1500, width: 50, height: 140 },
    { x: 9400, y: 3500, width: 120, height: 50 },
    { x: 9500, y: 6500, width: 50, height: 150 },
    { x: 9300, y: 8500, width: 130, height: 50 },
    // Mid-field scattered cover
    { x: 1500, y: 1500, width: 80, height: 80 },
    { x: 3500, y: 2000, width: 110, height: 45 },
    { x: 6500, y: 2000, width: 45, height: 110 },
    { x: 8500, y: 1500, width: 80, height: 80 },
    { x: 1500, y: 3800, width: 45, height: 100 },
    { x: 8500, y: 3800, width: 100, height: 45 },
    { x: 1500, y: 6200, width: 100, height: 45 },
    { x: 8500, y: 6200, width: 45, height: 100 },
    { x: 1500, y: 8500, width: 80, height: 80 },
    { x: 3500, y: 8000, width: 45, height: 110 },
    { x: 6500, y: 8000, width: 110, height: 45 },
    { x: 8500, y: 8500, width: 80, height: 80 },
    // Central cross corridors
    { x: 4200, y: 5000, width: 40, height: 160 },
    { x: 5800, y: 5000, width: 40, height: 160 },
    { x: 5000, y: 4200, width: 160, height: 40 },
    { x: 5000, y: 5800, width: 160, height: 40 },
    // Additional mid-range cover
    { x: 3000, y: 5000, width: 70, height: 130 },
    { x: 7000, y: 5000, width: 130, height: 70 },
    { x: 5000, y: 3000, width: 130, height: 70 },
    { x: 5000, y: 7000, width: 70, height: 130 },
    { x: 4000, y: 4000, width: 80, height: 80 },
    { x: 6000, y: 4000, width: 80, height: 80 },
    { x: 4000, y: 6000, width: 80, height: 80 },
    { x: 6000, y: 6000, width: 80, height: 80 },
  ],

  // Formulas
  radiusFromScore(score) {
    // Steeper power curve - noticeable growth early, tapers late
    // score 1K → 56, score 5K → 86, score 25K → 140
    // score 100K → 228, score 500K → 414, score 1M → 496 (near cap)
    const raw = 20 + Math.pow(score, 0.38) * 2.5;
    return Math.min(raw, config.MAP_WIDTH * 0.05);
  },
  speedFromRadius(radius) {
    return 5.5 * Math.pow(20 / radius, 0.12);
  },
  healthFromRadius(radius) {
    return 150 * (radius / 20);
  },
  bulletRadiusFromPlayerRadius(r) {
    return 4 + (r - 20) * 0.08;
  },
  bulletDamageFromPlayerRadius(r) {
    return 7 + (r - 20) * 0.1;
  },
  fireRateFromRadius(r) {
    return Math.max(7, 10 - Math.floor((r - 20) / 30));
  },
  tierFromScore(score) {
    const t = config.TIER_THRESHOLDS;
    for (let i = t.length - 1; i >= 0; i--) {
      if (score >= t[i]) return i + 1;
    }
    return 1;
  },
  ramDamage(attackerRadius, defenderRadius) {
    return (attackerRadius / defenderRadius) * config.RAM_DAMAGE_FACTOR;
  },
  // Barrel configs are now generated procedurally in TankRenderer
  getBarrelsForTier(tier) {
    if (tier <= 1) return [{ angle: 0, length: 1.2, width: 0.3 }];
    if (tier <= 2) return [{ angle: 0, length: 1.4, width: 0.34 }];
    if (tier <= 3) return [{ angle: 0, length: 1.4, width: 0.34 }];

    // Procedural: barrel count increases with tier
    const barrels = [];
    const count = Math.min(10, 2 + Math.floor(tier / 3));
    const hasRear = tier >= 7;
    const frontBarrels = hasRear ? count - 1 : count;
    const spread = Math.min(1.2, 0.3 + (tier - 4) * 0.05);

    // Main front barrel (always biggest)
    barrels.push({ angle: 0, length: 1.3 + tier * 0.02, width: 0.3 + tier * 0.008 });

    // Side barrels spread symmetrically
    for (let i = 1; i < frontBarrels; i++) {
      const side = Math.ceil(i / 2);
      const sign = i % 2 === 1 ? -1 : 1;
      const angle = sign * side * (spread / Math.ceil((frontBarrels - 1) / 2));
      barrels.push({
        angle,
        length: 1.1 + tier * 0.015,
        width: 0.24 + tier * 0.006,
      });
    }

    // Rear barrel
    if (hasRear) {
      barrels.push({ angle: Math.PI, length: 0.8 + tier * 0.01, width: 0.22 + tier * 0.005 });
    }

    return barrels;
  },
};

module.exports = config;
