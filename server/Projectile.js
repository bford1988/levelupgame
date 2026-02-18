const config = require('./config');

let nextBulletId = 1;

class Projectile {
  constructor(x, y, angle, radius, damage, ownerId, color, speed, lifetime, bulletShape) {
    this.id = 'b' + (nextBulletId++);
    this.type = 'projectile';
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * (speed || config.BULLET_SPEED);
    this.vy = Math.sin(angle) * (speed || config.BULLET_SPEED);
    this.radius = radius;
    this.damage = damage;
    this.ownerId = ownerId;
    this.color = color;
    this.lifetime = lifetime || config.BULLET_LIFETIME;
    this.bulletShape = bulletShape || 0;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.lifetime--;
  }

  isExpired() {
    return this.lifetime <= 0;
  }

  isOutOfBounds(mapW, mapH) {
    return this.x < -50 || this.x > mapW + 50 || this.y < -50 || this.y > mapH + 50;
  }

  serialize() {
    const out = {
      x: Math.round(this.x),
      y: Math.round(this.y),
      r: Math.round(this.radius * 10) / 10,
      c: this.color,
    };
    if (this.bulletShape) out.bs = this.bulletShape;
    return out;
  }
}

module.exports = Projectile;
