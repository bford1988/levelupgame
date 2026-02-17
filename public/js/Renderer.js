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

  drawGrid(camera, mapWidth, mapHeight) {
    const ctx = this.ctx;
    const vp = camera.getViewport();
    const gs = this.gridSize;

    // Clamp grid to map bounds
    const left = Math.max(0, vp.left);
    const top = Math.max(0, vp.top);
    const right = Math.min(mapWidth, vp.right);
    const bottom = Math.min(mapHeight, vp.bottom);

    const startX = Math.ceil(left / gs) * gs;
    const startY = Math.ceil(top / gs) * gs;

    const dotR = Math.max(1, 1.2 * camera.zoom);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';

    for (let x = startX; x <= right; x += gs) {
      for (let y = startY; y <= bottom; y += gs) {
        const s = camera.worldToScreen(x, y);
        ctx.fillRect(s.x - dotR, s.y - dotR, dotR * 2, dotR * 2);
      }
    }
  }

  drawOutOfBounds(camera, mapWidth, mapHeight) {
    const ctx = this.ctx;
    const tl = camera.worldToScreen(0, 0);
    const br = camera.worldToScreen(mapWidth, mapHeight);
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    // Fill out-of-bounds regions with dark overlay + red tint
    ctx.fillStyle = 'rgba(40, 8, 8, 0.55)';

    // Top strip
    if (tl.y > 0) ctx.fillRect(0, 0, cw, tl.y);
    // Bottom strip
    if (br.y < ch) ctx.fillRect(0, br.y, cw, ch - br.y);
    // Left strip (between top and bottom)
    if (tl.x > 0) ctx.fillRect(0, tl.y, tl.x, br.y - tl.y);
    // Right strip (between top and bottom)
    if (br.x < cw) ctx.fillRect(br.x, tl.y, cw - br.x, br.y - tl.y);

    // Diagonal hash lines over out-of-bounds areas
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 30, 30, 0.07)';
    ctx.lineWidth = 2;
    const spacing = 24;

    // Clip to only the out-of-bounds region (inverse of map rect)
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    // Cut out the map area (counter-clockwise for inverse clip)
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tl.x, br.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(br.x, tl.y);
    ctx.closePath();
    ctx.clip('evenodd');

    ctx.beginPath();
    for (let i = -ch; i < cw + ch; i += spacing) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i + ch, ch);
    }
    ctx.stroke();
    ctx.restore();

    // Border line
    ctx.strokeStyle = 'rgba(255, 40, 40, 0.5)';
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

  drawMines(mines, camera) {
    if (!mines) return;
    const ctx = this.ctx;
    const vp = camera.getViewport();
    const time = Date.now() / 1000;

    for (const m of mines) {
      if (m.x < vp.left - 30 || m.x > vp.right + 30 ||
          m.y < vp.top - 30 || m.y > vp.bottom + 30) continue;

      const s = camera.worldToScreen(m.x, m.y);
      const r = m.r * camera.zoom;
      const pulse = 0.85 + Math.sin(time * 4 + m.x) * 0.15;

      // Outer danger glow
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 2 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,50,50,0.08)';
      ctx.fill();

      // Mine body
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#cc2200';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ff4444';
      ctx.stroke();

      // Inner warning dot
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8800';
      ctx.fill();

      // Spikes
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const sx = s.x + Math.cos(angle) * r * pulse;
        const sy = s.y + Math.sin(angle) * r * pulse;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4444';
        ctx.fill();
      }
    }
  }

  drawTurrets(turrets, camera) {
    if (!turrets) return;
    const ctx = this.ctx;
    const vp = camera.getViewport();

    for (const t of turrets) {
      if (t.x < vp.left - 40 || t.x > vp.right + 40 ||
          t.y < vp.top - 40 || t.y > vp.bottom + 40) continue;

      const s = camera.worldToScreen(t.x, t.y);
      const z = camera.zoom;
      const baseR = 14 * z;

      // Base circle
      ctx.beginPath();
      ctx.arc(s.x, s.y, baseR, 0, Math.PI * 2);
      ctx.fillStyle = '#553333';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ff3333';
      ctx.stroke();

      // Barrel
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(t.a);
      ctx.fillStyle = '#884444';
      ctx.fillRect(baseR * 0.2, -baseR * 0.3, baseR * 1.5, baseR * 0.6);
      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 1;
      ctx.strokeRect(baseR * 0.2, -baseR * 0.3, baseR * 1.5, baseR * 0.6);
      ctx.restore();

      // Center dot
      ctx.beginPath();
      ctx.arc(s.x, s.y, baseR * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3333';
      ctx.fill();
    }
  }

  render(state, camera, myId, mapWidth, mapHeight) {
    this.clear();
    this.drawGrid(camera, mapWidth, mapHeight);
    this.drawOutOfBounds(camera, mapWidth, mapHeight);
    this.drawMines(state.mn, camera);
    this.drawFood(state.f, camera);
    this.drawObstacles(state.obs, camera);
    this.drawTurrets(state.tu, camera);
    this.drawProjectiles(state.b, camera);
    this.drawTanks(state.p, camera, myId);
  }
}
