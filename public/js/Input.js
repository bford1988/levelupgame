class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseX = canvas.width / 2;
    this.mouseY = canvas.height / 2;
    this.leftDown = false;

    canvas.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.leftDown = true;
      e.preventDefault();
    });

    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.leftDown = false;
      e.preventDefault();
    });

    // Handle mouse leaving window
    window.addEventListener('blur', () => {
      this.leftDown = false;
    });

    // Prevent right-click context menu
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  getMovement(camera, playerX, playerY) {
    // Always move toward mouse
    const world = camera.screenToWorld(this.mouseX, this.mouseY);
    let dx = world.x - playerX;
    let dy = world.y - playerY;
    const len = Math.sqrt(dx * dx + dy * dy);

    // Dead zone - don't move if cursor is very close to tank
    if (len < 5) return { dx: 0, dy: 0 };

    dx /= len;
    dy /= len;
    return { dx, dy };
  }

  getAimAngle(camera, playerX, playerY) {
    const world = camera.screenToWorld(this.mouseX, this.mouseY);
    return Math.atan2(world.y - playerY, world.x - playerX);
  }

  isBoostHeld() {
    return this.leftDown;
  }

  resetBoost() {
    this.leftDown = false;
  }
}
