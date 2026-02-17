const config = require('./config');

let nextMineId = 1;

class Mine {
  constructor(x, y) {
    this.id = 'm' + (nextMineId++);
    this.type = 'mine';
    this.x = x;
    this.y = y;
    this.radius = config.MINE_RADIUS;
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
