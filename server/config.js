const config = {
  PORT: 3000,
  TICK_RATE: 30,
  MAP_WIDTH: 10000,
  MAP_HEIGHT: 10000,
  MAX_PLAYERS: 30,
  BOT_COUNT: 20,

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

  // Boost
  BOOST_MULTIPLIER: 3.0,
  BOOST_COOLDOWN: 150,
  BOOST_DURATION: 100,

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

  // Map obstacles (spread across larger map)
  OBSTACLES: [
    // Center cluster
    { x: 4800, y: 4800, width: 250, height: 250 },
    { x: 5100, y: 4700, width: 80, height: 200 },
    { x: 4600, y: 5100, width: 200, height: 80 },
    // Quadrant anchors
    { x: 2000, y: 2000, width: 180, height: 70 },
    { x: 8000, y: 2000, width: 70, height: 180 },
    { x: 2000, y: 8000, width: 100, height: 140 },
    { x: 8000, y: 8000, width: 140, height: 100 },
    // Mid-ring obstacles
    { x: 5000, y: 1500, width: 120, height: 50 },
    { x: 1500, y: 5000, width: 50, height: 120 },
    { x: 5000, y: 8500, width: 120, height: 50 },
    { x: 8500, y: 5000, width: 50, height: 120 },
    // Scattered cover
    { x: 3200, y: 3500, width: 90, height: 90 },
    { x: 6800, y: 3500, width: 90, height: 90 },
    { x: 3200, y: 6500, width: 90, height: 90 },
    { x: 6800, y: 6500, width: 90, height: 90 },
    { x: 3800, y: 1200, width: 60, height: 150 },
    { x: 6200, y: 8800, width: 150, height: 60 },
    { x: 1200, y: 3200, width: 150, height: 50 },
    { x: 8800, y: 7000, width: 50, height: 150 },
    { x: 7200, y: 1800, width: 100, height: 40 },
    { x: 2800, y: 8200, width: 40, height: 100 },
  ],

  // Formulas
  radiusFromScore(score) {
    // Power curve - keeps growing, never truly caps
    // score 100 → ~32, score 1K → 45, score 10K → 74
    // score 100K → 136, score 1M → 270, score 10M → 540 (hits safety cap)
    const raw = 20 + Math.pow(score, 0.33) * 2.5;
    return Math.min(raw, config.MAP_WIDTH * 0.05);
  },
  speedFromRadius(radius) {
    return 5.5 * Math.pow(20 / radius, 0.2);
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
