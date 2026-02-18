const Player = require('./Player');
const config = require('./config');

const BOT_NAMES = [
  'Destroyer', 'Shadow', 'Blaze', 'Phantom', 'Viper',
  'Storm', 'Cobra', 'Hawk', 'Wolf', 'Titan',
  'Rogue', 'Spike', 'Nova', 'Bolt', 'Fang',
  'Ghost', 'Fury', 'Dash', 'Rex', 'Ace',
  'Havoc', 'Onyx', 'Ember', 'Jinx', 'Nuke',
  'Razor', 'Sniper', 'Turbo', 'Wraith', 'Apex',
  'Blitz', 'Crash', 'Doom', 'Echo', 'Flame',
  'Grizzly', 'Hex', 'Ion', 'Jolt', 'Karma',
  'Lynx', 'Mako', 'Nitro', 'Orca', 'Pulse',
  'Quake', 'Rift', 'Saber', 'Talon', 'Ultra',
  'Vandal', 'Warden', 'Xenon', 'Yeti', 'Zephyr',
  'Anvil', 'Banshee', 'Cipher', 'Dagger', 'Forge',
  'Glacier', 'Hornet', 'Inferno', 'Jackal', 'Kraken',
  'Lancer', 'Mantis', 'Nebula', 'Oxide', 'Pyro',
  'Quickdraw', 'Raptor', 'Scorpion', 'Thunder', 'Umbra',
  'Vulcan', 'Warlock', 'Xeno', 'Yakuza', 'Zenith',
  'Arsenal', 'Bruiser', 'Cyclone', 'Diesel', 'Frostbite',
  'Gauntlet', 'Hydra', 'Impact', 'Juggernaut', 'Knuckles',
  'Locust', 'Maverick', 'Nomad', 'Outlaw', 'Prowler',
  'Rampage', 'Sentinel', 'Torpedo', 'Uprising', 'Vortex',
];

const BOT_COLORS = [
  '#8BC34A', '#9C27B0', '#FF5722', '#607D8B',
  '#795548', '#E91E63', '#009688', '#FFC107',
  '#3F51B5', '#CDDC39', '#FF9800', '#00BCD4',
];

const BOT_CATCHPHRASES = [
  'Too slow!', 'GG EZ', 'Nothing personal', 'Beep boop',
  'Calculated.', 'Later, nerd', 'skill issue', 'Outplayed!',
  'Get tanked!', 'Boom goes the dynamite', '01001100', 'Vroom vroom',
  'Should have dodged', 'Thanks for the points', 'My barrels send their regards',
  'That was for science', 'Oops', 'You zigged when you should have zagged',
  'All your base are belong to us', 'Surprise!', 'Did that hurt?',
  'Better luck next time', 'No scope!', 'First try btw',
  'Have you tried not dying?', 'Tactical elimination', 'Bonk',
  'Working as intended', 'You just got vectored', 'Skill diff',
  'Sent to the shadow realm', 'Critical hit!', 'Fatality',
  'Another one bites the dust', 'Mission accomplished', 'Hasta la vista',
  'Yoink!', 'Ka-boom!', 'Rest in pieces', 'Talk to my cannon',
  'You were in my way', 'Speed kills', 'Bye Felicia',
  'That was free', 'Catch these shells', 'Return to sender',
  'Not even close', 'Aim assist OFF', 'I barely tried',
  'Big tank energy', 'Delete!', 'Denied', 'No mercy',
  'Thanks for standing still', 'Drive-by!', 'Lights out',
  'Uninstall lol', 'You dropped this: L', 'EZ clap',
  'Imagine getting hit by that', 'Skill issue tbh', 'Rekt',
  'Do a barrel roll!', 'BOOM', 'Headshot... wait wrong game',
  'You had a good run', 'Press F', 'Wasted',
  'Splat!', 'I saw you coming', 'Too predictable',
  'The floor is lava... and you are the floor', 'Brrrrrt',
  'Rolling thunder!', 'You fell for the classic blunder',
  'That one had your name on it', 'Certified bruh moment',
  'Tank goes brrr', 'Was that supposed to dodge?',
  'You call that armor?', 'Spawn, die, repeat', 'Free real estate',
  'Insert coin to continue', 'Game over man, game over',
  'Obliterated', 'Vaporized!', 'One shot one kill',
  'Clean sweep', 'Annihilated', 'Eliminated with prejudice',
  'Consider yourself tanked', 'That was inevitable',
  'You should see the other guy... oh wait', 'Cannon fodder',
  'Ctrl+Alt+Defeated', 'Error 404: Skill not found',
  'git push --force', 'sudo rm -rf you', 'Top of the food chain',
  'Tanks for playing!', 'Tango down', 'Contact eliminated',
  '', '', '', '', '', '', '', '', '', '',  // ~10% no catchphrase
];

class Bot {
  constructor() {
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const color = BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)];
    const catchphrase = BOT_CATCHPHRASES[Math.floor(Math.random() * BOT_CATCHPHRASES.length)];
    const accentColor = BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)];
    const decal = Math.floor(Math.random() * 10);
    const bulletShape = Math.floor(Math.random() * 5);
    this.player = new Player(name, color, null, catchphrase, accentColor, decal, bulletShape);
    this.player.isBot = true;

    this.state = 'WANDER';
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTimer = 60 + Math.random() * 90;
    this.detectionRange = 400;
    this.stuckCheckX = 0;
    this.stuckCheckY = 0;
    this.stuckCheckTimer = 0;
  }

  update(game) {
    const p = this.player;
    if (!p.alive) return;

    p.boostActive = false;
    this.wanderTimer--;

    // Stuck detection: every ~1 second, check if we've barely moved from where we were
    this.stuckCheckTimer++;
    if (this.stuckCheckTimer >= 30) { // 30 ticks = 1 second at 30Hz
      const dx = p.x - this.stuckCheckX;
      const dy = p.y - this.stuckCheckY;
      const movedDistSq = dx * dx + dy * dy;

      if (movedDistSq < 400) { // moved less than 20 units in 1 second = stuck
        // Find nearest obstacle and steer away from it
        let bestAngle = Math.random() * Math.PI * 2;
        let nearestObsDist = Infinity;
        for (const obs of game.obstacles) {
          const cx = obs.x + obs.width / 2;
          const cy = obs.y + obs.height / 2;
          const odx = p.x - cx;
          const ody = p.y - cy;
          const distSq = odx * odx + ody * ody;
          if (distSq < nearestObsDist) {
            nearestObsDist = distSq;
            bestAngle = Math.atan2(ody, odx); // away from obstacle center
          }
        }
        // Add some randomness so they don't just ping-pong
        bestAngle += (Math.random() - 0.5) * 1.2;
        this.wanderAngle = bestAngle;
        this.wanderTimer = 45 + Math.random() * 60;
        this.state = 'WANDER';
      }

      this.stuckCheckX = p.x;
      this.stuckCheckY = p.y;
      this.stuckCheckTimer = 0;
    }

    // Find nearest food and player
    const nearestFood = this.findNearestFood(game.food);
    const nearestPlayer = this.findNearestPlayer(game);

    // State transitions (don't override WANDER if we just got unstuck)
    if (this.state !== 'WANDER' || this.wanderTimer < 40) {
      if (nearestPlayer && nearestPlayer.radius < p.radius * 1.3) {
        this.state = 'ATTACK';
      } else if (nearestPlayer && nearestPlayer.radius > p.radius * 1.5) {
        this.state = 'FLEE';
      } else if (nearestFood) {
        this.state = 'CHASE_FOOD';
      } else {
        this.state = 'WANDER';
      }
    }

    let desiredAngle;

    switch (this.state) {
      case 'WANDER': {
        if (this.wanderTimer <= 0) {
          this.wanderAngle += (Math.random() - 0.5) * 1.5;
          this.wanderTimer = 60 + Math.random() * 90;
        }
        desiredAngle = this.wanderAngle;
        p.aimAngle = this.wanderAngle;

        // Bounce off walls
        if (p.x < 200) this.wanderAngle = 0;
        if (p.x > game.mapWidth - 200) this.wanderAngle = Math.PI;
        if (p.y < 200) this.wanderAngle = Math.PI / 2;
        if (p.y > game.mapHeight - 200) this.wanderAngle = -Math.PI / 2;
        desiredAngle = this.wanderAngle;
        break;
      }
      case 'CHASE_FOOD': {
        desiredAngle = Math.atan2(nearestFood.y - p.y, nearestFood.x - p.x);
        p.aimAngle = desiredAngle;
        break;
      }
      case 'ATTACK': {
        const toTarget = Math.atan2(nearestPlayer.y - p.y, nearestPlayer.x - p.x);
        desiredAngle = toTarget;
        p.aimAngle = toTarget + (Math.random() - 0.5) * 0.5;
        // Boost to close distance when attacking and have fuel
        if (p.boostFuel > config.BOOST_FUEL_MAX * 0.4) {
          p.boostActive = true;
        }
        break;
      }
      case 'FLEE': {
        desiredAngle = Math.atan2(p.y - nearestPlayer.y, p.x - nearestPlayer.x);
        p.aimAngle = desiredAngle + Math.PI;
        // Boost to escape when fleeing and have fuel
        if (p.boostFuel > config.BOOST_FUEL_MAX * 0.2) {
          p.boostActive = true;
        }
        break;
      }
    }

    // Obstacle avoidance: check if desired direction runs into an obstacle
    desiredAngle = this.avoidObstacles(p, desiredAngle, game.obstacles);

    p.inputDx = Math.cos(desiredAngle);
    p.inputDy = Math.sin(desiredAngle);
  }

  avoidObstacles(p, angle, obstacles) {
    const lookAhead = p.radius + 80;
    const aheadX = p.x + Math.cos(angle) * lookAhead;
    const aheadY = p.y + Math.sin(angle) * lookAhead;

    let blocked = false;
    let pushAngle = 0;

    for (const obs of obstacles) {
      const margin = p.radius + 10;
      const ox = obs.x - margin;
      const oy = obs.y - margin;
      const ow = obs.width + margin * 2;
      const oh = obs.height + margin * 2;

      if (aheadX > ox && aheadX < ox + ow && aheadY > oy && aheadY < oy + oh) {
        // Lookahead point is inside this obstacle's expanded bounds
        blocked = true;
        // Steer away from obstacle center
        const cx = obs.x + obs.width / 2;
        const cy = obs.y + obs.height / 2;
        const awayAngle = Math.atan2(p.y - cy, p.x - cx);

        // Blend: choose the side of the obstacle that's closest to desired direction
        const leftAngle = awayAngle + Math.PI / 2;
        const rightAngle = awayAngle - Math.PI / 2;
        const leftDiff = Math.abs(this.angleDiff(angle, leftAngle));
        const rightDiff = Math.abs(this.angleDiff(angle, rightAngle));
        pushAngle = leftDiff < rightDiff ? leftAngle : rightAngle;
        break;
      }
    }

    if (blocked) {
      return pushAngle;
    }
    return angle;
  }

  angleDiff(a, b) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  findNearestFood(food) {
    let nearest = null;
    let nearestDist = this.detectionRange * this.detectionRange;

    for (const f of food) {
      const dx = f.x - this.player.x;
      const dy = f.y - this.player.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDist) {
        nearestDist = distSq;
        nearest = f;
      }
    }
    return nearest;
  }

  findNearestPlayer(game) {
    let nearest = null;
    let nearestDist = this.detectionRange * this.detectionRange;

    for (const [id, other] of game.players) {
      if (other === this.player || !other.alive) continue;
      if (other.invulnTicks > 0 || other.score < 20) continue;
      const dx = other.x - this.player.x;
      const dy = other.y - this.player.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDist) {
        nearestDist = distSq;
        nearest = other;
      }
    }
    return nearest;
  }
}

module.exports = Bot;
