const Player = require('./Player');
const config = require('./config');

const BOT_NAMES = [
  'Destroyer', 'Shadow', 'Blaze', 'Phantom', 'Viper',
  'Storm', 'Cobra', 'Hawk', 'Wolf', 'Titan',
  'Rogue', 'Spike', 'Nova', 'Bolt', 'Fang',
  'Ghost', 'Fury', 'Dash', 'Rex', 'Ace',
];

const BOT_COLORS = [
  '#8BC34A', '#9C27B0', '#FF5722', '#607D8B',
  '#795548', '#E91E63', '#009688', '#FFC107',
  '#3F51B5', '#CDDC39', '#FF9800', '#00BCD4',
];

class Bot {
  constructor() {
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const color = BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)];
    this.player = new Player(name, color, null);
    this.player.isBot = true;

    this.state = 'WANDER';
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTimer = 60 + Math.random() * 90;
    this.detectionRange = 400;
  }

  update(game) {
    const p = this.player;
    if (!p.alive) return;

    p.boostActive = false; // default off, FLEE state may turn on
    this.wanderTimer--;

    // Find nearest food and player
    const nearestFood = this.findNearestFood(game.food);
    const nearestPlayer = this.findNearestPlayer(game);

    // State transitions
    if (nearestPlayer && nearestPlayer.radius < p.radius * 1.3) {
      this.state = 'ATTACK';
    } else if (nearestPlayer && nearestPlayer.radius > p.radius * 1.5) {
      this.state = 'FLEE';
    } else if (nearestFood) {
      this.state = 'CHASE_FOOD';
    } else {
      this.state = 'WANDER';
    }

    switch (this.state) {
      case 'WANDER': {
        if (this.wanderTimer <= 0) {
          this.wanderAngle += (Math.random() - 0.5) * 1.5;
          this.wanderTimer = 60 + Math.random() * 90;
        }
        p.inputDx = Math.cos(this.wanderAngle);
        p.inputDy = Math.sin(this.wanderAngle);
        p.aimAngle = this.wanderAngle;

        // Bounce off walls
        if (p.x < 200) this.wanderAngle = 0;
        if (p.x > game.mapWidth - 200) this.wanderAngle = Math.PI;
        if (p.y < 200) this.wanderAngle = Math.PI / 2;
        if (p.y > game.mapHeight - 200) this.wanderAngle = -Math.PI / 2;
        break;
      }
      case 'CHASE_FOOD': {
        const toFood = Math.atan2(nearestFood.y - p.y, nearestFood.x - p.x);
        p.inputDx = Math.cos(toFood);
        p.inputDy = Math.sin(toFood);
        p.aimAngle = toFood;
        break;
      }
      case 'ATTACK': {
        const toTarget = Math.atan2(nearestPlayer.y - p.y, nearestPlayer.x - p.x);
        p.inputDx = Math.cos(toTarget);
        p.inputDy = Math.sin(toTarget);
        // Inaccurate aim
        p.aimAngle = toTarget + (Math.random() - 0.5) * 0.5;
        break;
      }
      case 'FLEE': {
        const away = Math.atan2(p.y - nearestPlayer.y, p.x - nearestPlayer.x);
        p.inputDx = Math.cos(away);
        p.inputDy = Math.sin(away);
        p.aimAngle = away + Math.PI;
        // Occasionally boost to escape (hold for a bit)
        if (p.boostFuel > config.BOOST_FUEL_MAX * 0.3 && Math.random() < 0.05) {
          p.boostActive = true;
        } else {
          p.boostActive = false;
        }
        break;
      }
    }
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
      // Don't target invulnerable or very small players (fresh spawns)
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
