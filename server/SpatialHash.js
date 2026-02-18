class SpatialHash {
  constructor(cellSize) {
    this.cellSize = cellSize || 200;
    this.grid = new Map();
  }

  clear() {
    this.grid.clear();
  }

  _key(cx, cy) {
    return cx * 73856093 ^ cy * 19349663; // fast integer hash
  }

  insert(entity) {
    const r = entity.radius || 0;
    const minCX = Math.floor((entity.x - r) / this.cellSize);
    const maxCX = Math.floor((entity.x + r) / this.cellSize);
    const minCY = Math.floor((entity.y - r) / this.cellSize);
    const maxCY = Math.floor((entity.y + r) / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const key = this._key(cx, cy);
        let cell = this.grid.get(key);
        if (!cell) {
          cell = [];
          this.grid.set(key, cell);
        }
        cell.push(entity);
      }
    }
  }

  query(entity) {
    const candidates = new Set();
    const r = entity.radius || 0;
    const minCX = Math.floor((entity.x - r) / this.cellSize);
    const maxCX = Math.floor((entity.x + r) / this.cellSize);
    const minCY = Math.floor((entity.y - r) / this.cellSize);
    const maxCY = Math.floor((entity.y + r) / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.grid.get(this._key(cx, cy));
        if (cell) {
          for (const e of cell) {
            if (e !== entity) candidates.add(e);
          }
        }
      }
    }
    return candidates;
  }
}

module.exports = SpatialHash;
