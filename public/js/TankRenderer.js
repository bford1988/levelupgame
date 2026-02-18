class TankRenderer {
  constructor() {
    this.time = 0;
    this.gradientCache = new Map();
    this.decalCache = new Map();
    this.frameCount = 0;
    // Pre-compute color caches for darken/lighten
    this.colorCache = new Map();
  }

  update(dt) {
    this.time += dt;
    this.frameCount++;
    // Clear caches periodically to prevent unbounded growth
    if (this.frameCount % 120 === 0) {
      if (this.gradientCache.size > 200) this.gradientCache.clear();
      if (this.decalCache.size > 50) this.decalCache.clear();
      if (this.colorCache.size > 500) this.colorCache.clear();
    }
  }

  getCachedColor(type, hex, amount) {
    const key = type + hex + amount;
    let result = this.colorCache.get(key);
    if (!result) {
      result = type === 'd' ? this._darken(hex, amount) : this._lighten(hex, amount);
      this.colorCache.set(key, result);
    }
    return result;
  }

  drawTank(ctx, camera, player, isMe) {
    const screen = camera.worldToScreen(player.x, player.y);
    const z = camera.zoom;
    const r = player.r * z;
    const tier = player.ti || 1;

    // Don't draw if off screen
    const margin = r * 3;
    if (screen.x < -margin || screen.x > camera.canvas.width + margin ||
        screen.y < -margin || screen.y > camera.canvas.height + margin) {
      return;
    }

    // Invulnerability flash
    if (player.inv && Math.floor(this.time * 8) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    const color = player.c;
    const accent = player.ac || player.c;

    ctx.save();
    ctx.translate(screen.x, screen.y);

    // Tier 20+: background aura
    if (tier >= 20) {
      this.drawAura(ctx, r, tier, accent);
    }

    // Tier 15+: rotating outer ring
    if (tier >= 15) {
      this.drawOrbitRing(ctx, r, tier, accent);
    }

    // Draw barrels (behind body)
    this.drawBarrels(ctx, r, tier, accent, player.a);

    // Draw body
    this.drawBody(ctx, r, tier, color, accent, player.d || 0);

    // Tier 10+: crown spikes
    if (tier >= 10) {
      this.drawCrown(ctx, r, tier, accent);
    }

    ctx.restore();

    // Name and health bar (screen space)
    this.drawName(ctx, screen, r, player.n, isMe, tier);
    this.drawHealthBar(ctx, screen, r, player.h, player.mh, color);

    // Boost indicator
    if (player.boosting) {
      this.drawBoostTrail(ctx, screen, r, accent, player.a);
    }

    ctx.globalAlpha = 1.0;
  }

  drawBody(ctx, r, tier, color, accent, decal) {
    // Tier 22+: double body (outer translucent ring)
    if (tier >= 22) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = color + '25';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color + '60';
      ctx.stroke();
    }

    // Main body
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Outline thickness scales with tier
    ctx.lineWidth = 1.5 + tier * 0.4;
    ctx.strokeStyle = this.darken(color, 0.3);
    ctx.stroke();

    // Tier 3+: inner accent ring
    if (tier >= 3) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
      ctx.strokeStyle = this.lighten(color, 0.3);
      ctx.lineWidth = 1 + tier * 0.1;
      ctx.globalAlpha = 0.5 + Math.min(0.4, tier * 0.02);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Tier 6+: second inner ring
    if (tier >= 6) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.strokeStyle = this.lighten(color, 0.2);
      ctx.lineWidth = 1 + tier * 0.05;
      ctx.globalAlpha = 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Tier 4+: armor plates (count increases with tier)
    if (tier >= 4) {
      const plateCount = Math.min(12, 4 + Math.floor((tier - 4) / 2));
      const plateWidth = r * (0.2 + tier * 0.005);
      const plateHeight = r * (0.08 + tier * 0.003);
      for (let i = 0; i < plateCount; i++) {
        const angle = (i / plateCount) * Math.PI * 2;
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = this.darken(accent, 0.2);
        ctx.fillRect(r * 0.7, -plateHeight, plateWidth, plateHeight * 2);
        // Plate outline for higher tiers
        if (tier >= 8) {
          ctx.strokeStyle = this.darken(accent, 0.4);
          ctx.lineWidth = 1;
          ctx.strokeRect(r * 0.7, -plateHeight, plateWidth, plateHeight * 2);
        }
        ctx.restore();
      }
    }

    // Tier 5+: outer glow (intensity scales) - cached gradient
    if (tier >= 5) {
      const intensity = Math.min(1, (tier - 4) * 0.08);
      const pulse = 0.9 + Math.sin(this.time * 3) * 0.1;
      const glowR = r * (1.2 + tier * 0.02) * pulse;
      const rr = Math.round(r);
      const gr = Math.round(glowR);
      const alpha = Math.floor(intensity * 80).toString(16).padStart(2, '0');
      const gKey = `g1_${accent}_${rr}_${gr}`;
      let gradient = this.gradientCache.get(gKey);
      if (!gradient) {
        gradient = ctx.createRadialGradient(0, 0, rr, 0, 0, gr);
        gradient.addColorStop(0, accent + alpha);
        gradient.addColorStop(1, accent + '00');
        this.gradientCache.set(gKey, gradient);
      }
      ctx.beginPath();
      ctx.arc(0, 0, glowR, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Tier 12+: second glow layer - cached gradient
    if (tier >= 12) {
      const pulse2 = 0.85 + Math.sin(this.time * 2 + 1) * 0.15;
      const glowR2 = r * (1.5 + tier * 0.03) * pulse2;
      const ri = Math.round(r * 1.1);
      const gr2 = Math.round(glowR2);
      const gKey2 = `g2_${accent}_${ri}_${gr2}`;
      let gradient2 = this.gradientCache.get(gKey2);
      if (!gradient2) {
        gradient2 = ctx.createRadialGradient(0, 0, ri, 0, 0, gr2);
        gradient2.addColorStop(0, accent + '20');
        gradient2.addColorStop(1, accent + '00');
        this.gradientCache.set(gKey2, gradient2);
      }
      ctx.beginPath();
      ctx.arc(0, 0, glowR2, 0, Math.PI * 2);
      ctx.fillStyle = gradient2;
      ctx.fill();
    }

    // Center highlight
    const highlightSize = 0.2 - Math.min(0.1, tier * 0.005);
    const hR = r * Math.max(0.1, highlightSize);
    ctx.beginPath();
    ctx.arc(0, 0, hR, 0, Math.PI * 2);
    ctx.fillStyle = this.lighten(color, 0.2);
    ctx.fill();

    // Decal (drawn on top of highlight)
    if (decal > 0) {
      this.drawDecal(ctx, 0, 0, hR * 1.6, decal, accent);
    }

    // Tier 18+: center emblem (star shape) - only if no decal
    if (tier >= 18 && !decal) {
      this.drawStar(ctx, 0, 0, r * 0.25, r * 0.12, 5 + Math.floor((tier - 18) / 2), color);
    }
  }

  drawBarrels(ctx, r, tier, color, angle) {
    const barrels = this.getBarrelsForTier(tier);
    const barrelColor = this.darken(color, 0.15);
    const outlineColor = this.darken(color, 0.4);

    for (const barrel of barrels) {
      ctx.save();
      ctx.rotate(angle + barrel.angle);

      const bw = r * barrel.width;
      const bl = r * barrel.length;

      // Barrel body
      ctx.fillStyle = barrelColor;
      ctx.fillRect(r * 0.3, -bw / 2, bl - r * 0.3, bw);

      // Barrel outline
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1 + tier * 0.1;
      ctx.strokeRect(r * 0.3, -bw / 2, bl - r * 0.3, bw);

      // Tier 3+: muzzle detail
      if (tier >= 3) {
        ctx.fillStyle = this.darken(color, 0.3);
        const muzzleW = bw * (1.15 + tier * 0.01);
        ctx.fillRect(bl - bw * 0.5, -muzzleW / 2, bw * 0.5, muzzleW);
      }

      // Tier 9+: barrel stripes
      if (tier >= 9) {
        ctx.fillStyle = this.darken(color, 0.35);
        const stripes = Math.min(3, Math.floor((tier - 8) / 3));
        for (let s = 0; s < stripes; s++) {
          const sx = r * 0.4 + (bl - r * 0.4) * ((s + 1) / (stripes + 2));
          ctx.fillRect(sx, -bw / 2, 2, bw);
        }
      }

      // Tier 14+: double barrel effect (inner barrel)
      if (tier >= 14) {
        const innerW = bw * 0.5;
        ctx.fillStyle = this.lighten(color, 0.1);
        ctx.fillRect(r * 0.35, -innerW / 2, bl - r * 0.55, innerW);
      }

      ctx.restore();
    }
  }

  drawCrown(ctx, r, tier, color) {
    const spikeCount = Math.min(8, 3 + Math.floor((tier - 10) / 2));
    const spikeLen = r * (0.15 + (tier - 10) * 0.01);
    const spikeBase = r * 0.08;

    ctx.fillStyle = this.lighten(color, 0.3);
    ctx.strokeStyle = this.darken(color, 0.2);
    ctx.lineWidth = 1;

    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2 + this.time * 0.3;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(r + spikeLen, 0);
      ctx.lineTo(r - 2, -spikeBase);
      ctx.lineTo(r - 2, spikeBase);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  drawOrbitRing(ctx, r, tier, color) {
    const ringR = r * (1.25 + (tier - 15) * 0.02);
    const dotCount = Math.min(16, 4 + (tier - 15) * 2);
    const dotSize = r * 0.06;
    const speed = 0.5 + (tier - 15) * 0.1;

    ctx.fillStyle = this.lighten(color, 0.4);
    for (let i = 0; i < dotCount; i++) {
      const angle = (i / dotCount) * Math.PI * 2 + this.time * speed;
      const dx = Math.cos(angle) * ringR;
      const dy = Math.sin(angle) * ringR;
      ctx.beginPath();
      ctx.arc(dx, dy, dotSize, 0, Math.PI * 2);
      ctx.globalAlpha = 0.6;
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Ring line
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = color + '30';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawAura(ctx, r, tier, color) {
    const auraR = r * (1.8 + (tier - 20) * 0.1);
    const pulse = 0.8 + Math.sin(this.time * 1.5) * 0.2;
    const innerR = Math.round(r * 0.5);
    const outerR = Math.round(auraR * pulse);
    const alpha = Math.min(40, 15 + (tier - 20) * 5);
    const aKey = `a1_${color}_${innerR}_${outerR}`;
    let gradient = this.gradientCache.get(aKey);
    if (!gradient) {
      gradient = ctx.createRadialGradient(0, 0, innerR, 0, 0, outerR);
      gradient.addColorStop(0, color + alpha.toString(16).padStart(2, '0'));
      gradient.addColorStop(0.6, color + '10');
      gradient.addColorStop(1, color + '00');
      this.gradientCache.set(aKey, gradient);
    }
    ctx.beginPath();
    ctx.arc(0, 0, auraR * pulse, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Tier 23+: second aura layer, different timing
    if (tier >= 23) {
      const pulse2 = 0.7 + Math.sin(this.time * 1.1 + 2) * 0.3;
      const aura2 = auraR * 1.3 * pulse2;
      const rr = Math.round(r);
      const ar2 = Math.round(aura2);
      const aKey2 = `a2_${color}_${rr}_${ar2}`;
      let g2 = this.gradientCache.get(aKey2);
      if (!g2) {
        g2 = ctx.createRadialGradient(0, 0, rr, 0, 0, ar2);
        g2.addColorStop(0, color + '15');
        g2.addColorStop(1, color + '00');
        this.gradientCache.set(aKey2, g2);
      }
      ctx.beginPath();
      ctx.arc(0, 0, aura2, 0, Math.PI * 2);
      ctx.fillStyle = g2;
      ctx.fill();
    }
  }

  drawDecal(ctx, x, y, size, decalId, color) {
    const s = size * 0.6;
    const cacheSize = Math.round(s);
    // Skip tiny decals
    if (cacheSize < 2) return;

    const cacheKey = `dc_${decalId}_${color}_${cacheSize}`;
    let cached = this.decalCache.get(cacheKey);
    if (cached) {
      ctx.drawImage(cached, x - cached.width / 2, y - cached.height / 2);
      return;
    }

    // Render to off-screen canvas
    const pad = Math.ceil(s * 2.5);
    const offscreen = document.createElement('canvas');
    offscreen.width = pad * 2;
    offscreen.height = pad * 2;
    const oc = offscreen.getContext('2d');
    oc.translate(pad, pad);

    // Glow behind decal
    oc.shadowColor = color;
    oc.shadowBlur = s * 0.8;
    oc.fillStyle = color;
    oc.strokeStyle = this.lighten(color, 0.3);
    oc.lineWidth = 1.5;
    oc.globalAlpha = 0.9;

    this._renderDecalPaths(oc, s, decalId, color);

    oc.globalAlpha = 1.0;
    oc.shadowBlur = 0;

    this.decalCache.set(cacheKey, offscreen);
    ctx.drawImage(offscreen, x - pad, y - pad);
    return;
  }

  _renderDecalPaths(ctx, s, decalId, color) {
    switch (decalId) {
      case 1: { // Skull
        // Cranium
        ctx.beginPath();
        ctx.arc(0, -s * 0.12, s * 0.6, Math.PI, 0);
        ctx.lineTo(s * 0.5, s * 0.15);
        ctx.quadraticCurveTo(s * 0.4, s * 0.45, s * 0.25, s * 0.5);
        ctx.lineTo(-s * 0.25, s * 0.5);
        ctx.quadraticCurveTo(-s * 0.4, s * 0.45, -s * 0.5, s * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Eyes (glowing voids)
        ctx.shadowBlur = s * 0.5;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(-s * 0.2, -s * 0.1, s * 0.15, s * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(s * 0.2, -s * 0.1, s * 0.15, s * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eye glow dots
        ctx.shadowBlur = 0;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(-s * 0.2, -s * 0.12, s * 0.05, 0, Math.PI * 2);
        ctx.arc(s * 0.2, -s * 0.12, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        // Nose
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(0, s * 0.08);
        ctx.lineTo(-s * 0.06, s * 0.18);
        ctx.lineTo(s * 0.06, s * 0.18);
        ctx.closePath();
        ctx.fill();
        // Teeth
        ctx.fillStyle = this.lighten(color, 0.4);
        ctx.strokeStyle = this.darken(color, 0.3);
        ctx.lineWidth = 0.5;
        for (let i = -2; i <= 2; i++) {
          ctx.fillRect(i * s * 0.1 - s * 0.04, s * 0.28, s * 0.07, s * 0.14);
          ctx.strokeRect(i * s * 0.1 - s * 0.04, s * 0.28, s * 0.07, s * 0.14);
        }
        break;
      }
      case 2: { // Lightning bolt (thick with bright core)
        const path = [
          [-s * 0.2, -s * 0.95],
          [s * 0.1, -s * 0.1],
          [-s * 0.1, -s * 0.05],
          [s * 0.2, s * 0.95],
          [-s * 0.05, s * 0.15],
          [s * 0.1, s * 0.1],
        ];
        ctx.beginPath();
        ctx.moveTo(path[0][0], path[0][1]);
        for (let i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Bright inner core
        ctx.shadowBlur = 0;
        ctx.fillStyle = this.lighten(color, 0.6);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(-s * 0.1, -s * 0.7);
        ctx.lineTo(s * 0.02, -s * 0.08);
        ctx.lineTo(-s * 0.04, -s * 0.04);
        ctx.lineTo(s * 0.1, s * 0.7);
        ctx.lineTo(0, s * 0.12);
        ctx.lineTo(s * 0.03, s * 0.08);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 3: { // Star (5-point with double outline)
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const rad = i % 2 === 0 ? s : s * 0.38;
          if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
          else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Inner star highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = this.lighten(color, 0.5);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const rad = i % 2 === 0 ? s * 0.5 : s * 0.2;
          if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
          else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 4: { // Crosshair (detailed with tick marks)
        ctx.lineWidth = 2;
        // Outer ring
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        // Cross lines with gap in center
        const gap = s * 0.2;
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(0, -gap);
        ctx.moveTo(0, gap); ctx.lineTo(0, s);
        ctx.moveTo(-s, 0); ctx.lineTo(-gap, 0);
        ctx.moveTo(gap, 0); ctx.lineTo(s, 0);
        ctx.stroke();
        // Tick marks on ring
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 12; i++) {
          if (i % 3 === 0) continue; // skip main axis positions
          const a = (i / 12) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.6);
          ctx.lineTo(Math.cos(a) * s * 0.8, Math.sin(a) * s * 0.8);
          ctx.stroke();
        }
        // Center dot
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 5: { // Flame (layered with hot core)
        // Outer flame
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(s * 0.7, -s * 0.2, s * 0.45, s * 0.3);
        ctx.quadraticCurveTo(s * 0.25, s * 0.55, 0, s * 0.7);
        ctx.quadraticCurveTo(-s * 0.25, s * 0.55, -s * 0.45, s * 0.3);
        ctx.quadraticCurveTo(-s * 0.7, -s * 0.2, 0, -s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Inner hot core
        ctx.shadowBlur = 0;
        ctx.fillStyle = this.lighten(color, 0.5);
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.55);
        ctx.quadraticCurveTo(s * 0.35, -s * 0.05, s * 0.2, s * 0.25);
        ctx.quadraticCurveTo(s * 0.1, s * 0.4, 0, s * 0.35);
        ctx.quadraticCurveTo(-s * 0.1, s * 0.4, -s * 0.2, s * 0.25);
        ctx.quadraticCurveTo(-s * 0.35, -s * 0.05, 0, -s * 0.55);
        ctx.closePath();
        ctx.fill();
        // White-hot tip
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(0, s * 0.1, s * 0.08, s * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 6: { // Shield (with inner chevron)
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.85, -s * 0.45);
        ctx.lineTo(s * 0.85, s * 0.15);
        ctx.quadraticCurveTo(s * 0.45, s * 0.85, 0, s);
        ctx.quadraticCurveTo(-s * 0.45, s * 0.85, -s * 0.85, s * 0.15);
        ctx.lineTo(-s * 0.85, -s * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Inner chevron
        ctx.shadowBlur = 0;
        ctx.strokeStyle = this.lighten(color, 0.5);
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(-s * 0.4, -s * 0.1);
        ctx.lineTo(0, s * 0.3);
        ctx.lineTo(s * 0.4, -s * 0.1);
        ctx.stroke();
        break;
      }
      case 7: { // Diamond (faceted)
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.7, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.7, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Facet lines
        ctx.shadowBlur = 0;
        ctx.strokeStyle = this.lighten(color, 0.4);
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(-s * 0.35, -s * 0.35);
        ctx.lineTo(0, s * 0.2);
        ctx.lineTo(s * 0.35, -s * 0.35);
        ctx.stroke();
        // Top highlight
        ctx.fillStyle = this.lighten(color, 0.6);
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.35, -s * 0.35);
        ctx.lineTo(0, s * 0.2);
        ctx.lineTo(-s * 0.35, -s * 0.35);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 8: { // Heart (with shine)
        ctx.beginPath();
        ctx.moveTo(0, s * 0.75);
        ctx.bezierCurveTo(-s * 1.1, s * 0.1, -s * 1.1, -s * 0.75, 0, -s * 0.3);
        ctx.bezierCurveTo(s * 1.1, -s * 0.75, s * 1.1, s * 0.1, 0, s * 0.75);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Highlight shine
        ctx.shadowBlur = 0;
        ctx.fillStyle = this.lighten(color, 0.6);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(-s * 0.3, -s * 0.3, s * 0.12, s * 0.2, -0.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 9: { // Biohazard (with ring and glow)
        // Outer ring
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        // Three lobes
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * s * 0.35, Math.sin(a) * s * 0.35, s * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        // Center cutout with glow
        ctx.fillStyle = '#000';
        ctx.shadowColor = color;
        ctx.shadowBlur = s * 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2);
        ctx.fill();
        // Gaps between lobes
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000';
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 - Math.PI / 2 + Math.PI / 3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, s * 0.75, a - 0.25, a + 0.25);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
    }
  }

  drawStar(ctx, x, y, outerR, innerR, points, color) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2 + this.time * 0.5;
      const radius = i % 2 === 0 ? outerR : innerR;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = this.lighten(color, 0.5);
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  drawBoostTrail(ctx, screen, r, color, angle) {
    const rgb = this.hexToRgb(color);
    const trailAngle = angle + Math.PI; // behind the tank
    const flicker = 0.85 + Math.random() * 0.3;
    const flameLen = r * 2.2 * flicker;
    const baseWidth = r * 0.55;

    // Perpendicular direction for flame width
    const px = Math.cos(trailAngle + Math.PI / 2);
    const py = Math.sin(trailAngle + Math.PI / 2);

    // Flame origin (just behind the tank body)
    const ox = screen.x + Math.cos(trailAngle) * r * 0.6;
    const oy = screen.y + Math.sin(trailAngle) * r * 0.6;

    // Flame tip
    const tipX = ox + Math.cos(trailAngle) * flameLen;
    const tipY = oy + Math.sin(trailAngle) * flameLen;

    ctx.save();

    // Outer flame (player color, wide, faded)
    ctx.beginPath();
    ctx.moveTo(ox + px * baseWidth, oy + py * baseWidth);
    ctx.quadraticCurveTo(
      ox + Math.cos(trailAngle) * flameLen * 0.5 + px * baseWidth * 0.3 + (Math.random() - 0.5) * r * 0.15,
      oy + Math.sin(trailAngle) * flameLen * 0.5 + py * baseWidth * 0.3 + (Math.random() - 0.5) * r * 0.15,
      tipX, tipY
    );
    ctx.quadraticCurveTo(
      ox + Math.cos(trailAngle) * flameLen * 0.5 - px * baseWidth * 0.3 + (Math.random() - 0.5) * r * 0.15,
      oy + Math.sin(trailAngle) * flameLen * 0.5 - py * baseWidth * 0.3 + (Math.random() - 0.5) * r * 0.15,
      ox - px * baseWidth, oy - py * baseWidth
    );
    ctx.closePath();

    // Gradient from color to transparent along the flame
    const outerGrad = ctx.createLinearGradient(ox, oy, tipX, tipY);
    outerGrad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.6)`);
    outerGrad.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},0.3)`);
    outerGrad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    ctx.fillStyle = outerGrad;
    ctx.fill();

    // Inner flame (brighter white-hot core, narrower)
    const innerWidth = baseWidth * 0.4;
    const innerLen = flameLen * 0.6;
    const innerTipX = ox + Math.cos(trailAngle) * innerLen;
    const innerTipY = oy + Math.sin(trailAngle) * innerLen;

    ctx.beginPath();
    ctx.moveTo(ox + px * innerWidth, oy + py * innerWidth);
    ctx.quadraticCurveTo(
      ox + Math.cos(trailAngle) * innerLen * 0.5 + (Math.random() - 0.5) * r * 0.05,
      oy + Math.sin(trailAngle) * innerLen * 0.5 + (Math.random() - 0.5) * r * 0.05,
      innerTipX, innerTipY
    );
    ctx.quadraticCurveTo(
      ox + Math.cos(trailAngle) * innerLen * 0.5 + (Math.random() - 0.5) * r * 0.05,
      oy + Math.sin(trailAngle) * innerLen * 0.5 + (Math.random() - 0.5) * r * 0.05,
      ox - px * innerWidth, oy - py * innerWidth
    );
    ctx.closePath();

    const innerGrad = ctx.createLinearGradient(ox, oy, innerTipX, innerTipY);
    innerGrad.addColorStop(0, 'rgba(255,255,255,0.7)');
    innerGrad.addColorStop(0.5, `rgba(${Math.min(255, rgb.r + 100)},${Math.min(255, rgb.g + 100)},${Math.min(255, rgb.b + 100)},0.3)`);
    innerGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = innerGrad;
    ctx.fill();

    ctx.restore();
  }

  drawName(ctx, screen, r, name, isMe, tier) {
    if (!name) return;
    const fontSize = Math.max(12, Math.min(24, r * 0.45));
    ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(name, screen.x + 1, screen.y - r - 9);

    // Text color: gets more vivid at high tiers
    if (tier >= 20) {
      ctx.fillStyle = '#ffeb3b';
    } else if (tier >= 15) {
      ctx.fillStyle = '#ff9800';
    } else {
      ctx.fillStyle = isMe ? '#00e5ff' : '#ffffff';
    }
    ctx.fillText(name, screen.x, screen.y - r - 10);

    // Tier 15+: tier badge
    if (tier >= 10) {
      ctx.font = `bold ${fontSize * 0.6}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillStyle = tier >= 20 ? '#ffeb3b' : tier >= 15 ? '#ff9800' : '#aaa';
      ctx.fillText(`T${tier}`, screen.x, screen.y - r - 10 - fontSize * 0.8);
    }
  }

  drawHealthBar(ctx, screen, r, health, maxHealth, color) {
    if (health === undefined || health >= maxHealth) return;

    const barW = Math.min(r * 2, 80);
    const barH = Math.max(3, Math.min(6, r * 0.12));
    const x = screen.x - barW / 2;
    const y = screen.y + r + 6;
    const ratio = Math.max(0, health / maxHealth);

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);

    ctx.fillStyle = ratio > 0.5 ? '#4caf50' : ratio > 0.25 ? '#ff9800' : '#f44336';
    ctx.fillRect(x, y, barW * ratio, barH);
  }

  getBarrelsForTier(tier) {
    if (tier <= 1) return [{ angle: 0, length: 1.2, width: 0.3 }];
    if (tier <= 2) return [{ angle: 0, length: 1.4, width: 0.34 }];
    if (tier <= 3) return [{ angle: 0, length: 1.4, width: 0.34 }];

    const barrels = [];
    const count = Math.min(10, 2 + Math.floor(tier / 3));
    const hasRear = tier >= 7;
    const frontBarrels = hasRear ? count - 1 : count;
    const spread = Math.min(1.2, 0.3 + (tier - 4) * 0.05);

    barrels.push({ angle: 0, length: 1.3 + tier * 0.02, width: 0.3 + tier * 0.008 });

    for (let i = 1; i < frontBarrels; i++) {
      const side = Math.ceil(i / 2);
      const sign = i % 2 === 1 ? -1 : 1;
      const angle = sign * side * (spread / Math.ceil((frontBarrels - 1) / 2));
      barrels.push({
        angle,
        length: 1.1 + tier * 0.015,
        width: 0.24 + tier * 0.006,
      });
    }

    if (hasRear) {
      barrels.push({ angle: Math.PI, length: 0.8 + tier * 0.01, width: 0.22 + tier * 0.005 });
    }

    return barrels;
  }

  darken(hex, amount) {
    return this.getCachedColor('d', hex, amount);
  }

  lighten(hex, amount) {
    return this.getCachedColor('l', hex, amount);
  }

  _darken(hex, amount) {
    const rgb = this.hexToRgb(hex);
    const f = 1 - amount;
    return `rgb(${Math.floor(rgb.r * f)},${Math.floor(rgb.g * f)},${Math.floor(rgb.b * f)})`;
  }

  _lighten(hex, amount) {
    const rgb = this.hexToRgb(hex);
    return `rgb(${Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * amount))},${Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * amount))},${Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * amount))})`;
  }

  hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  }
}
