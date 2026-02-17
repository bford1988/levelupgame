let nextFoodId = 1;

class Food {
  constructor(x, y, type) {
    this.id = 'f' + (nextFoodId++);
    this.type = 'food';
    this.x = x;
    this.y = y;
    this.radius = type.radius;
    this.value = type.value;
    this.color = type.color;
  }

  serialize() {
    return {
      i: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      r: this.radius,
      c: this.color,
    };
  }
}

module.exports = Food;
