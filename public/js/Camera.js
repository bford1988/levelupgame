class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.zoom = 1.0;
    this.targetZoom = 1.0;
  }

  setTarget(x, y, playerRadius) {
    this.targetX = x;
    this.targetY = y;
    // Zoom out as player grows - scales smoothly for huge tanks
    this.targetZoom = 1.0 / (1 + (playerRadius - 20) * 0.008);
    this.targetZoom = Math.max(0.15, Math.min(1.0, this.targetZoom));
  }

  update() {
    this.x += (this.targetX - this.x) * 0.1;
    this.y += (this.targetY - this.y) * 0.1;
    this.zoom += (this.targetZoom - this.zoom) * 0.05;
  }

  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.canvas.width / 2,
      y: (wy - this.y) * this.zoom + this.canvas.height / 2,
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.canvas.width / 2) / this.zoom + this.x,
      y: (sy - this.canvas.height / 2) / this.zoom + this.y,
    };
  }

  getViewport() {
    const halfW = (this.canvas.width / 2) / this.zoom;
    const halfH = (this.canvas.height / 2) / this.zoom;
    return {
      left: this.x - halfW,
      top: this.y - halfH,
      right: this.x + halfW,
      bottom: this.y + halfH,
    };
  }
}
