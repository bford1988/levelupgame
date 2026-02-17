class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    // Screen shake
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
  }

  setTarget(x, y, playerRadius) {
    this.targetX = x;
    this.targetY = y;
    // Zoom out as player grows - scales smoothly for huge tanks
    this.targetZoom = 1.0 / (1 + (playerRadius - 20) * 0.008);
    this.targetZoom = Math.max(0.15, Math.min(1.0, this.targetZoom));
  }

  shake(intensity) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = 0.3;
  }

  update() {
    this.x += (this.targetX - this.x) * 0.1;
    this.y += (this.targetY - this.y) * 0.1;
    this.zoom += (this.targetZoom - this.zoom) * 0.05;

    // Screen shake
    if (this.shakeDuration > 0) {
      this.shakeDuration -= 0.016;
      const t = Math.max(0, this.shakeDuration / 0.3);
      const shake = this.shakeIntensity * t;
      this.shakeOffsetX = (Math.random() - 0.5) * shake * 2;
      this.shakeOffsetY = (Math.random() - 0.5) * shake * 2;
      if (this.shakeDuration <= 0) {
        this.shakeIntensity = 0;
      }
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
  }

  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.canvas.width / 2 + this.shakeOffsetX,
      y: (wy - this.y) * this.zoom + this.canvas.height / 2 + this.shakeOffsetY,
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
