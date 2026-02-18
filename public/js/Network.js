class Network {
  constructor() {
    this.ws = null;
    this.myId = null;
    this.mapWidth = 4000;
    this.mapHeight = 4000;
    this.obstacles = [];
    this.warpHoles = [];
    this.onState = null;
    this.onWelcome = null;
    this.onDeath = null;
    this.onKillFeed = null;
    this.onWarpDenied = null;
    this.instanceId = null;
    this.connected = false;
    this.lastInputSend = 0;
    // Cache static player data (name, color, accent, decal, etc.)
    this.playerCache = new Map();
  }

  connect(name, color, catchphrase, accentColor, decal, bulletShape) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}`);

    this.ws.onopen = () => {
      this.connected = true;
      const data = { name, color, accentColor, decal, bulletShape };
      if (catchphrase) data.catchphrase = catchphrase;
      this.send(MSG.JOIN, data);
    };

    this.ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        return;
      }

      switch (msg.t) {
        case MSG.WELCOME:
          this.myId = msg.id;
          this.mapWidth = msg.mw;
          this.mapHeight = msg.mh;
          this.obstacles = msg.obs;
          this.warpHoles = msg.wh || [];
          this.instanceId = msg.inst || null;
          if (this.onWelcome) this.onWelcome(msg);
          break;
        case MSG.STATE:
          // Merge cached static data into player objects
          if (msg.p) {
            for (let i = 0; i < msg.p.length; i++) {
              const p = msg.p[i];
              // If this player has static fields (name), cache them
              if (p.n !== undefined) {
                this.playerCache.set(p.i, { n: p.n, c: p.c, ac: p.ac, d: p.d, bs: p.bs, bfm: p.bfm });
              } else {
                // Merge cached static data into the dynamic-only object
                const cached = this.playerCache.get(p.i);
                if (cached) Object.assign(p, cached);
              }
            }
          }
          if (this.onState) this.onState(msg);
          break;
        case MSG.DEATH:
          if (this.onDeath) this.onDeath(msg);
          break;
        case MSG.KILL_FEED:
          if (this.onKillFeed) this.onKillFeed(msg);
          break;
        case MSG.WARP_DENIED:
          if (this.onWarpDenied) this.onWarpDenied(msg);
          break;
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
    };
  }

  send(type, data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ t: type, ...data }));
  }

  sendInput(input, camera) {
    const now = Date.now();

    // Throttle to 30Hz
    if (now - this.lastInputSend < 33) return;
    this.lastInputSend = now;

    const px = this._lastX || 0;
    const py = this._lastY || 0;
    const mov = input.getMovement(camera, px, py);
    const msg = {
      dx: mov.dx,
      dy: mov.dy,
      a: input.getAimAngle(camera, px, py),
    };
    if (input.isBoostHeld()) msg.boost = 1;
    this.send(MSG.INPUT, msg);
  }

  sendRespawn() {
    this.send(MSG.RESPAWN, {});
  }

  updateMyPosition(x, y) {
    this._lastX = x;
    this._lastY = y;
  }
}
