class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tankRenderer = new TankRenderer();
    this.gridSize = 40;
  }

  clear() {
    this.ctx.fillStyle = '#0e0e1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawGrid(camera) {
    const ctx = this.ctx;
    const vp = camera.getViewport();
    const gs = this.gridSize;

    const startX = Math.floor(vp.left / gs) * gs;
    const startY = Math.floor(vp.top / gs) * gs;

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let x = startX; x <= vp.right; x += gs) {
      const s = camera.worldToScreen(x, 0);
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x, this.canvas.height);
    }
    for (let y = startY; y <= vp.bottom; y += gs) {
      const s = camera.worldToScreen(0, y);
      ctx.moveTo(0, s.y);
      ctx.lineTo(this.canvas.width, s.y);
    }
    ctx.stroke();
  }

  drawMapBorder(camera, mapWidth, mapHeight) {
    const ctx = this.ctx;
    const tl = camera.worldToScreen(0, 0);
    const br = camera.worldToScreen(mapWidth, mapHeight);

    ctx.strokeStyle = 'rgba(255,60,60,0.4)';
    ctx.lineWidth = 3 * camera.zoom;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  }

  drawFood(food, camera) {
    if (!food) return;
    const ctx = this.ctx;
    const vp = camera.getViewport();

    for (const f of food) {
      if (f.x < vp.left - 20 || f.x > vp.right + 20 ||
          f.y < vp.top - 20 || f.y > vp.bottom + 20) continue;

      const s = camera.worldToScreen(f.x, f.y);
      const r = f.r * camera.zoom;

      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = f.c;
      ctx.fill();

      // Small glow
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = f.c + '20';
      ctx.fill();
    }
  }

  drawObstacles(obstacles, camera) {
    if (!obstacles) return;
    const ctx = this.ctx;

    ctx.fillStyle = '#2a2a3e';
    ctx.strokeStyle = '#3a3a5e';
    ctx.lineWidth = 2;

    for (const o of obstacles) {
      const s = camera.worldToScreen(o.x, o.y);
      const w = o.w * camera.zoom;
      const h = o.h * camera.zoom;

      ctx.fillRect(s.x, s.y, w, h);
      ctx.strokeRect(s.x, s.y, w, h);
    }
  }

  drawProjectiles(bullets, camera) {
    if (!bullets) return;
    const ctx = this.ctx;
    const vp = camera.getViewport();

    for (const b of bullets) {
      if (b.x < vp.left - 10 || b.x > vp.right + 10 ||
          b.y < vp.top - 10 || b.y > vp.bottom + 10) continue;

      const s = camera.worldToScreen(b.x, b.y);
      const r = b.r * camera.zoom;

      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = b.c;
      ctx.fill();

      // Bullet outline
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.stroke();
    }
  }

  drawTanks(players, camera, myId) {
    if (!players) return;

    // Draw other tanks first, then self (self on top)
    const others = [];
    let me = null;
    for (const p of players) {
      if (!p.al) continue;
      if (p.i === myId) {
        me = p;
      } else {
        others.push(p);
      }
    }

    for (const p of others) {
      this.tankRenderer.drawTank(this.ctx, camera, p, false);
    }
    if (me) {
      this.tankRenderer.drawTank(this.ctx, camera, me, true);
    }
  }

  render(state, camera, myId, mapWidth, mapHeight) {
    this.clear();
    this.drawGrid(camera);
    this.drawMapBorder(camera, mapWidth, mapHeight);
    this.drawFood(state.f, camera);
    this.drawObstacles(state.obs, camera);
    this.drawProjectiles(state.b, camera);
    this.drawTanks(state.p, camera, myId);
  }
}
