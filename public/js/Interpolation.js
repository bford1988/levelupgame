class Interpolation {
  constructor() {
    this.buffer = [];
    this.renderDelay = 50; // ms behind server (adaptive)
    this.smoothRadius = new Map(); // playerId -> current display radius
    // Adaptive delay tracking
    this.lastPushTime = 0;
    this.jitter = 0; // exponential moving average of jitter
    this.expectedInterval = 33.3; // 1000 / 30Hz
  }

  pushState(serverState) {
    const now = Date.now();
    if (this.lastPushTime > 0) {
      const interval = now - this.lastPushTime;
      const deviation = Math.abs(interval - this.expectedInterval);
      this.jitter = this.jitter * 0.9 + deviation * 0.1;
      // Adaptive render delay: one tick + jitter margin, clamped
      const target = this.expectedInterval + this.jitter * 2.5;
      const clamped = Math.max(33, Math.min(200, target));
      // Smooth toward target to avoid sudden jumps
      this.renderDelay += (clamped - this.renderDelay) * 0.1;
    }
    this.lastPushTime = now;

    this.buffer.push({
      timestamp: now,
      state: serverState,
    });
    // Keep last 10 states
    if (this.buffer.length > 10) this.buffer.shift();
  }

  getInterpolatedState() {
    if (this.buffer.length === 0) return null;
    if (this.buffer.length === 1) {
      this.applySmoothRadius(this.buffer[0].state);
      return this.buffer[0].state;
    }

    const renderTime = Date.now() - this.renderDelay;

    // Find two states to interpolate between
    let before = null;
    let after = null;
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].timestamp <= renderTime &&
          this.buffer[i + 1].timestamp >= renderTime) {
        before = this.buffer[i];
        after = this.buffer[i + 1];
        break;
      }
    }

    // If render time is beyond all buffered states, use latest
    if (!before || !after) {
      const state = this.buffer[this.buffer.length - 1].state;
      this.applySmoothRadius(state);
      return state;
    }

    // Interpolation factor
    const range = after.timestamp - before.timestamp;
    const t = range > 0 ? (renderTime - before.timestamp) / range : 0;

    const result = this.lerpState(before.state, after.state, t);
    this.applySmoothRadius(result);
    return result;
  }

  applySmoothRadius(state) {
    if (!state || !state.p) return;

    const seen = new Set();
    for (const p of state.p) {
      seen.add(p.i);
      const current = this.smoothRadius.get(p.i);
      if (current === undefined) {
        // First time seeing this player, snap to actual
        this.smoothRadius.set(p.i, p.r);
      } else {
        // Lerp toward actual radius
        const lerped = current + (p.r - current) * 0.08;
        this.smoothRadius.set(p.i, lerped);
        p.r = lerped;
      }
    }

    // Clean up players no longer in state
    for (const id of this.smoothRadius.keys()) {
      if (!seen.has(id)) this.smoothRadius.delete(id);
    }
  }

  lerpState(a, b, t) {
    const result = { ...b };

    // Interpolate player positions
    if (a.p && b.p) {
      const playerMapA = new Map(a.p.map(p => [p.i, p]));
      result.p = b.p.map(pb => {
        const pa = playerMapA.get(pb.i);
        if (!pa) return pb;
        return {
          ...pb,
          x: pa.x + (pb.x - pa.x) * t,
          y: pa.y + (pb.y - pa.y) * t,
          a: this.lerpAngle(pa.a, pb.a, t),
        };
      });
    }

    // Interpolate bullet positions
    if (a.b && b.b) {
      // Bullets move fast and are short-lived, just use latest
      result.b = b.b;
    }

    return result;
  }

  lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }
}
