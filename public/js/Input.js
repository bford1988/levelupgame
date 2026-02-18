class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseX = canvas.width / 2;
    this.mouseY = canvas.height / 2;
    this.leftDown = false;

    // Mobile detection
    this.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // Touch state (mobile only)
    this.moveTouch = null;
    this.moveOriginX = 0;
    this.moveOriginY = 0;
    this.moveDx = 0;
    this.moveDy = 0;
    this.moveDistance = 0;

    this.boostActive = false;
    this.boostTouch = null;
    this.lastTouchEndTime = 0;
    this._lastAimAngle = 0;

    this.JOYSTICK_RADIUS = 60;

    // Desktop: mouse events
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

    window.addEventListener('blur', () => {
      this.leftDown = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mobile: touch events
    if (this.isMobile) {
      canvas.style.touchAction = 'none';
      canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
      canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
      canvas.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });
      canvas.addEventListener('touchcancel', (e) => this._onTouchEnd(e), { passive: false });
    }
  }

  _onTouchStart(e) {
    e.preventDefault();
    const now = Date.now();
    const touches = e.changedTouches;

    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];

      // Double-tap detection → boost
      if (now - this.lastTouchEndTime < 300 && this.boostTouch === null) {
        this.boostActive = true;
        this.boostTouch = touch.identifier;
      }

      // First available touch becomes movement joystick
      if (this.moveTouch === null) {
        this.moveTouch = touch.identifier;
        this.moveOriginX = touch.clientX;
        this.moveOriginY = touch.clientY;
        this.moveDx = 0;
        this.moveDy = 0;
        this.moveDistance = 0;
      }
    }
  }

  _onTouchMove(e) {
    e.preventDefault();
    const touches = e.changedTouches;

    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];

      if (touch.identifier === this.moveTouch) {
        const dx = touch.clientX - this.moveOriginX;
        const dy = touch.clientY - this.moveOriginY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.moveDistance = dist;

        if (dist > 10) {
          const clamped = Math.min(dist, this.JOYSTICK_RADIUS);
          this.moveDx = (dx / dist) * (clamped / this.JOYSTICK_RADIUS);
          this.moveDy = (dy / dist) * (clamped / this.JOYSTICK_RADIUS);
        } else {
          this.moveDx = 0;
          this.moveDy = 0;
        }
      }
    }
  }

  _onTouchEnd(e) {
    e.preventDefault();
    this.lastTouchEndTime = Date.now();
    const touches = e.changedTouches;

    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];

      if (touch.identifier === this.moveTouch) {
        this.moveTouch = null;
        this.moveDx = 0;
        this.moveDy = 0;
        this.moveDistance = 0;
      }
      if (touch.identifier === this.boostTouch) {
        this.boostTouch = null;
        this.boostActive = false;
      }
    }
  }

  getMovement(camera, playerX, playerY) {
    if (this.isMobile) {
      if (Math.abs(this.moveDx) < 0.01 && Math.abs(this.moveDy) < 0.01) {
        return { dx: 0, dy: 0 };
      }
      return { dx: this.moveDx, dy: this.moveDy };
    }

    // Desktop: move toward mouse
    const world = camera.screenToWorld(this.mouseX, this.mouseY);
    let dx = world.x - playerX;
    let dy = world.y - playerY;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len < 5) return { dx: 0, dy: 0 };

    dx /= len;
    dy /= len;
    return { dx, dy };
  }

  getAimAngle(camera, playerX, playerY) {
    if (this.isMobile) {
      // Aim follows joystick direction (same as mouse behavior)
      if (Math.abs(this.moveDx) > 0.01 || Math.abs(this.moveDy) > 0.01) {
        this._lastAimAngle = Math.atan2(this.moveDy, this.moveDx);
      }
      return this._lastAimAngle;
    }

    const world = camera.screenToWorld(this.mouseX, this.mouseY);
    return Math.atan2(world.y - playerY, world.x - playerX);
  }

  isBoostHeld() {
    if (this.isMobile) {
      return this.boostActive;
    }
    return this.leftDown;
  }

  resetBoost() {
    this.leftDown = false;
    this.boostActive = false;
    this.boostTouch = null;
  }
}
