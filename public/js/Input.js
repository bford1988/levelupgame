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
    this.moveSide = null;       // 'left' or 'right' — which side joystick is on

    this.boostActive = false;
    this.boostTouch = null;
    this._lastAimAngle = 0;

    this.JOYSTICK_RADIUS = 60;
    this.BOOST_RADIUS = 40;

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

  // Boost button position — opposite side of joystick, ~15% from edge, near bottom
  getBoostPos() {
    if (!this.moveSide) return null;
    const margin = this.canvas.width * 0.15;
    const x = this.moveSide === 'left'
      ? (this.canvas.width - margin)
      : margin;
    const y = this.canvas.height - 60;
    return { x, y };
  }

  _isInBoostZone(clientX, clientY) {
    const bp = this.getBoostPos();
    if (!bp) return false;
    const dx = clientX - bp.x;
    const dy = clientY - bp.y;
    return (dx * dx + dy * dy) <= (this.BOOST_RADIUS + 12) * (this.BOOST_RADIUS + 12);
  }

  _onTouchStart(e) {
    e.preventDefault();
    const halfW = this.canvas.width / 2;
    const touches = e.changedTouches;

    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];

      // If joystick is active, check boost button first
      if (this.moveTouch !== null && this.boostTouch === null && this._isInBoostZone(touch.clientX, touch.clientY)) {
        this.boostTouch = touch.identifier;
        this.boostActive = true;
        continue;
      }

      // First available touch becomes movement joystick
      if (this.moveTouch === null) {
        this.moveTouch = touch.identifier;
        this.moveOriginX = touch.clientX;
        this.moveOriginY = touch.clientY;
        this.moveDx = 0;
        this.moveDy = 0;
        this.moveDistance = 0;
        this.moveSide = touch.clientX < halfW ? 'left' : 'right';
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
    const touches = e.changedTouches;

    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];

      if (touch.identifier === this.moveTouch) {
        this.moveTouch = null;
        this.moveDx = 0;
        this.moveDy = 0;
        this.moveDistance = 0;
        this.moveSide = null;
      }
      if (touch.identifier === this.boostTouch) {
        this.boostTouch = null;
        this.boostActive = false;
      }
    }
  }

  getMovement(camera, playerX, playerY) {
    if (this.isMobile) {
      // If joystick is active and past dead zone, update last direction
      if (this.moveTouch !== null && (Math.abs(this.moveDx) > 0.01 || Math.abs(this.moveDy) > 0.01)) {
        const len = Math.sqrt(this.moveDx * this.moveDx + this.moveDy * this.moveDy);
        this._lastMoveDx = this.moveDx / len;
        this._lastMoveDy = this.moveDy / len;
      }
      // Always moving — return last known direction (defaults to right)
      // Slightly faster on mobile to compensate for zoomed-out view
      const boost = 1.25;
      return { dx: (this._lastMoveDx || 1) * boost, dy: (this._lastMoveDy || 0) * boost };
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
