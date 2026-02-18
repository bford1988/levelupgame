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
      const shape = b.bs || 0;

      ctx.fillStyle = b.c;
      ctx.beginPath();

      switch (shape) {
        case 1: // square
          ctx.rect(s.x - r, s.y - r, r * 2, r * 2);
          break;
        case 2: // triangle
          ctx.moveTo(s.x, s.y - r);
          ctx.lineTo(s.x + r * 0.866, s.y + r * 0.5);
          ctx.lineTo(s.x - r * 0.866, s.y + r * 0.5);
          ctx.closePath();
          break;
        case 3: // star (5-point)
          for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
            const rad = i % 2 === 0 ? r : r * 0.45;
            const px = s.x + Math.cos(angle) * rad;
            const py = s.y + Math.sin(angle) * rad;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          break;
        case 4: // diamond
          ctx.moveTo(s.x, s.y - r);
          ctx.lineTo(s.x + r * 0.7, s.y);
          ctx.lineTo(s.x, s.y + r);
          ctx.lineTo(s.x - r * 0.7, s.y);
          ctx.closePath();
          break;
        default: // circle
          ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
          break;
      }

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
      if (m.x < vp.left - 40 || m.x > vp.right + 40 ||
          m.y < vp.top - 40 || m.y > vp.bottom + 40) continue;

      const s = camera.worldToScreen(m.x, m.y);
      const r = m.r * camera.zoom;
      const pulse = 0.9 + Math.sin(time * 3 + m.x) * 0.1;
      const spin = time * 0.8 + m.x * 0.01;

      // Outer danger glow
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 2.2 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,50,50,0.08)';
      ctx.fill();

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(spin);

      // Mine body
      ctx.beginPath();
      ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#cc2200';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ff4444';
      ctx.stroke();

      // Triangle spikes around the edge (single path, no per-spike save/restore)
      const spikeCount = 8;
      const spikeLen = r * 0.45;
      const spikeBase = r * 0.18;
      const rp = r * pulse;
      ctx.fillStyle = '#ff4444';
      ctx.strokeStyle = '#cc2200';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < spikeCount; i++) {
        const angle = (i / spikeCount) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        // Tip of spike
        const tipDist = rp + spikeLen;
        // Base points perpendicular to spike direction
        const baseDist = rp - 2;
        ctx.moveTo(tipDist * cos, tipDist * sin);
        ctx.lineTo(baseDist * cos - spikeBase * sin, baseDist * sin + spikeBase * cos);
        ctx.lineTo(baseDist * cos + spikeBase * sin, baseDist * sin - spikeBase * cos);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();

      // Inner warning dot
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8800';
      ctx.fill();

      ctx.restore();
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

  drawWarpHoles(warpHoles, camera, myScore, myPos) {
    if (!warpHoles) return;
    const ctx = this.ctx;
    const vp = camera.getViewport();
    const time = Date.now() / 1000;
    const LABEL_DISTANCE = 600; // world units - only show labels when this close

    for (const wh of warpHoles) {
      if (wh.x < vp.left - 100 || wh.x > vp.right + 100 ||
          wh.y < vp.top - 100 || wh.y > vp.bottom + 100) continue;

      const s = camera.worldToScreen(wh.x, wh.y);
      const r = wh.r * camera.zoom;
      const canUse = myScore <= wh.ms;

      // Distance from player to warp hole
      let dist = Infinity;
      if (myPos) {
        const dx = myPos.x - wh.x;
        const dy = myPos.y - wh.y;
        dist = Math.sqrt(dx * dx + dy * dy);
      }
      const isNearby = dist < LABEL_DISTANCE;

      // Color based on max score tier
      let color, glowColor;
      if (wh.ms <= 5000) { color = '#00e5ff'; glowColor = 'rgba(0,229,255,'; }
      else if (wh.ms <= 10000) { color = '#00ff88'; glowColor = 'rgba(0,255,136,'; }
      else { color = '#aa44ff'; glowColor = 'rgba(170,68,255,'; }

      const alpha = canUse ? 1.0 : 0.3;
      const pulse = 0.85 + Math.sin(time * 3) * 0.15;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Outer glow
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 1.8 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = glowColor + '0.06)';
      ctx.fill();

      // Swirl rings
      for (let ring = 0; ring < 3; ring++) {
        const ringR = r * (0.4 + ring * 0.3) * pulse;
        const rotation = time * (2 - ring * 0.5) + ring;
        ctx.beginPath();
        ctx.arc(s.x, s.y, ringR, rotation, rotation + Math.PI * 1.2);
        ctx.lineWidth = (3 - ring) * camera.zoom;
        ctx.strokeStyle = glowColor + (0.6 - ring * 0.15) + ')';
        ctx.stroke();
      }

      // Center portal
      const gradient = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 0.6);
      gradient.addColorStop(0, glowColor + '0.3)');
      gradient.addColorStop(0.7, glowColor + '0.1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Border circle
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.lineWidth = 2 * camera.zoom;
      ctx.strokeStyle = canUse ? color : 'rgba(100,100,100,0.5)';
      ctx.stroke();

      // Proximity-based labels (only when nearby, all inside the circle)
      if (isNearby) {
        const maxStr = wh.ms >= 1000 ? (wh.ms / 1000) + 'K' : wh.ms;
        ctx.textAlign = 'center';

        if (canUse) {
          // "WARP" top line inside portal
          ctx.font = `bold ${Math.round(22 * camera.zoom)}px "Segoe UI", Arial, sans-serif`;
          ctx.fillStyle = color;
          ctx.fillText('WARP', s.x, s.y - 4 * camera.zoom);
          // Score limit below, still inside circle
          ctx.font = `bold ${Math.round(20 * camera.zoom)}px "Segoe UI", Arial, sans-serif`;
          ctx.globalAlpha = alpha * 0.7;
          ctx.fillText(`< ${maxStr}`, s.x, s.y + 18 * camera.zoom);
        } else {
          // "LOCKED" top line inside portal
          ctx.font = `bold ${Math.round(20 * camera.zoom)}px "Segoe UI", Arial, sans-serif`;
          ctx.fillStyle = '#ff6666';
          ctx.fillText('LOCKED', s.x, s.y - 4 * camera.zoom);
          // Max info inside circle
          ctx.font = `bold ${Math.round(18 * camera.zoom)}px "Segoe UI", Arial, sans-serif`;
          ctx.fillStyle = '#999';
          ctx.fillText(`Max: ${maxStr}`, s.x, s.y + 18 * camera.zoom);
        }
      }

      ctx.restore();
    }
  }

  render(state, camera, myId, mapWidth, mapHeight, myScore, myPos) {
    this.clear();
    this.drawGrid(camera, mapWidth, mapHeight);
    this.drawOutOfBounds(camera, mapWidth, mapHeight);
    this.drawWarpHoles(state.wh, camera, myScore || 0, myPos);
    this.drawMines(state.mn, camera);
    this.drawPowerUps(state.pu, camera);
    this.drawFood(state.f, camera);
    this.drawObstacles(state.obs, camera);
    this.drawTurrets(state.tu, camera);
    this.drawProjectiles(state.b, camera);
    this.drawBeams(state.bm, camera);
    this.drawTanks(state.p, camera, myId);
    this.drawPowerUpBars(state.p, camera, myId);
  }

  drawPowerUps(powerUps, camera) {
    if (!powerUps) return;
    const ctx = this.ctx;
    const vp = camera.getViewport();
    const time = Date.now() / 1000;

    for (const pu of powerUps) {
      if (pu.x < vp.left - 30 || pu.x > vp.right + 30 ||
          pu.y < vp.top - 30 || pu.y > vp.bottom + 30) continue;

      const s = camera.worldToScreen(pu.x, pu.y);
      const r = pu.r * camera.zoom;
      const pulse = 0.85 + Math.sin(time * 4 + pu.x) * 0.15;
      const rotation = time * 2;

      // Outer glow
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 2.5 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = pu.c + '15';
      ctx.fill();

      // Rotating diamond shape
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(rotation);

      const size = r * 1.5 * pulse;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size, 0);
      ctx.closePath();
      ctx.fillStyle = pu.c;
      ctx.fill();
      ctx.lineWidth = 2 * camera.zoom;
      ctx.strokeStyle = '#ffffff80';
      ctx.stroke();

      ctx.restore();

      // Label above the diamond
      ctx.font = `bold ${Math.round(18 * camera.zoom)}px "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = pu.c;
      let label = '';
      if (pu.pt === 'laser') label = 'LASER';
      else if (pu.pt === 'rapidfire') label = 'RAPID FIRE';
      else if (pu.pt === 'speed') label = 'SPEED';
      ctx.fillText(label, s.x, s.y - size - 6 * camera.zoom);
    }
  }

  drawBeams(beams, camera) {
    if (!beams) return;
    const ctx = this.ctx;

    for (const bm of beams) {
      const s1 = camera.worldToScreen(bm.x1, bm.y1);
      const s2 = camera.worldToScreen(bm.x2, bm.y2);

      // Outer glow
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.lineWidth = 12 * camera.zoom;
      ctx.strokeStyle = bm.c + '40';
      ctx.stroke();

      // Mid glow
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.lineWidth = 6 * camera.zoom;
      ctx.strokeStyle = bm.c + 'aa';
      ctx.stroke();

      // Core beam
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.lineWidth = 3 * camera.zoom;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Impact flash at endpoint
      ctx.beginPath();
      ctx.arc(s2.x, s2.y, 8 * camera.zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffffcc';
      ctx.fill();
    }
  }

  drawPowerUpBars(players, camera, myId) {
    if (!players) return;
    const ctx = this.ctx;

    for (const p of players) {
      if (!p.al) continue;

      // Collect active power-up bars (up to 2: gun + speed)
      const bars = [];
      if (p.gpu && p.gpt > 0) {
        const color = p.gpu === 'laser' ? '#ff4444' : '#ffcc00';
        bars.push({ ratio: p.gpt / p.gptm, color });
      }
      if (p.spt > 0) {
        bars.push({ ratio: p.spt / p.sptm, color: '#00ff66' });
      }
      if (bars.length === 0) continue;

      const s = camera.worldToScreen(p.x, p.y);
      const r = p.r * camera.zoom;
      const barW = r * 2;
      const barH = 5 * camera.zoom;
      const barX = s.x - barW / 2;
      const gap = 3 * camera.zoom;

      for (let i = 0; i < bars.length; i++) {
        const barY = s.y - r - (22 + i * (5 + 3)) * camera.zoom;

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

        // Empty
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(barX, barY, barW, barH);

        // Fill
        ctx.fillStyle = bars[i].color;
        ctx.fillRect(barX, barY, barW * bars[i].ratio, barH);
      }
    }
  }
}
