const config = require('./config');

let nextMineId = 1;

class Mine {
  constructor(x, y) {
    this.id = 'm' + (nextMineId++);
    this.type = 'mine';
    this.x = x;
    this.y = y;
    this.radius = config.MINE_RADIUS;

    // Slow drift
    const driftAngle = Math.random() * Math.PI * 2;
    const driftSpeed = 0.3 + Math.random() * 0.4;
    this.vx = Math.cos(driftAngle) * driftSpeed;
    this.vy = Math.sin(driftAngle) * driftSpeed;
  }

  update(mapW, mapH) {
    this.x += this.vx;
    this.y += this.vy;

    // Bounce off map edges
    const margin = this.radius + 20;
    if (this.x < margin) { this.x = margin; this.vx = Math.abs(this.vx); }
    if (this.x > mapW - margin) { this.x = mapW - margin; this.vx = -Math.abs(this.vx); }
    if (this.y < margin) { this.y = margin; this.vy = Math.abs(this.vy); }
    if (this.y > mapH - margin) { this.y = mapH - margin; this.vy = -Math.abs(this.vy); }
  }

  serialize() {
    return {
      x: Math.round(this.x),
      y: Math.round(this.y),
      r: this.radius,
    };
  }
}

module.exports = Mine;
