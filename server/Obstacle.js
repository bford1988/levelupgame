class Obstacle {
  constructor(x, y, width, height) {
    this.type = 'obstacle';
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  serialize() {
    return {
      x: this.x,
      y: this.y,
      w: this.width,
      h: this.height,
    };
  }
}

module.exports = Obstacle;
