class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseX = canvas.width / 2;
    this.mouseY = canvas.height / 2;
    this.leftDown = false;

    // Mobile detection
    this.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // Touch state (mobile only)
    this.moveTouch = null;       // active touch identifier for movement
    this.moveOriginX = 0;        // where movement touch started
    this.moveOriginY = 0;
    this.moveDx = 0;             // normalized direction (-1 to 1)
    this.moveDy = 0;
    this.moveDistance = 0;

    this.aimTouch = null;        // active touch identifier for aim
    this.aimScreenX = canvas.width / 2;
    this.aimScreenY = canvas.height / 2;

    this.boostTouch = null;      // active touch identifier for boost
    this.boostActive = false;

    this.JOYSTICK_RADIUS = 60;
    this.BOOST_RADIUS = 36;

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

    // Handle mouse leaving window
    window.addEventListener('blur', () => {
      this.leftDown = false;
    });

    // Prevent right-click context menu
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mobile: touch events
    if (this.isMobile) {
      canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
      canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
      canvas.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });
      canvas.addEventListener('touchcancel', (e) => this._onTouchEnd(e), { passive: false });
    }
  }

  // Boost button position (bottom-right)
  _getBoostPos() {
    return { x: this.canvas.width - 80, y: this.canvas.height - 100 };
  }

  _isInBoostZone(clientX, clientY) {
    const bp = this._getBoostPos();
    const dx = clientX - bp.x;
    const dy = clientY - bp.y;
    return (dx * dx + dy * dy) <= (this.BOOST_RADIUS + 10) * (this.BOOST_RADIUS + 10);
  }

  _onTouchStart(e) {
    e.preventDefault();
    const halfW = this.canvas.width / 2;

    for (const touch of e.changedTouches) {
      // Check boost button first
      if (this.boostTouch === null && this._isInBoostZone(touch.clientX, touch.clientY)) {
        this.boostTouch = touch.identifier;
        this.boostActive = true;
        continue;
      }

      if (touch.clientX < halfW && this.moveTouch === null) {
        // Left half: movement joystick
        this.moveTouch = touch.identifier;
        this.moveOriginX = touch.clientX;
        this.moveOriginY = touch.clientY;
        this.moveDx = 0;
        this.moveDy = 0;
        this.moveDistance = 0;
      } else if (touch.clientX >= halfW && this.aimTouch === null) {
        // Right half: aim
        this.aimTouch = touch.identifier;
        this.aimScreenX = touch.clientX;
        this.aimScreenY = touch.clientY;
      }
    }
  }

  _onTouchMove(e) {
    e.preventDefault();

    for (const touch of e.changedTouches) {
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
      } else if (touch.identifier === this.aimTouch) {
        this.aimScreenX = touch.clientX;
        this.aimScreenY = touch.clientY;
      }
      // boostTouch doesn't need move handling
    }
  }

  _onTouchEnd(e) {
    e.preventDefault();

    for (const touch of e.changedTouches) {
      if (touch.identifier === this.moveTouch) {
        this.moveTouch = null;
        this.moveDx = 0;
        this.moveDy = 0;
        this.moveDistance = 0;
      } else if (touch.identifier === this.aimTouch) {
        this.aimTouch = null;
        // Keep last aim position — tank keeps aiming last direction
      } else if (touch.identifier === this.boostTouch) {
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
      const world = camera.screenToWorld(this.aimScreenX, this.aimScreenY);
      return Math.atan2(world.y - playerY, world.x - playerX);
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
