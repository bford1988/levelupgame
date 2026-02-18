class HUD {
  constructor() {
    this.killFeed = [];
    this.tierUpNotification = null;
    this.scoreFlash = 0; // 0-1 flash intensity
    this.damageFlash = 0; // 0-1 red vignette intensity
    this.warpDeniedNotification = null;
    this.tierNames = [
      '', 'Recruit', 'Soldier', 'Veteran', 'Fighter', 'Warrior',
      'Guardian', 'Knight', 'Champion', 'Destroyer', 'Warlord',
      'Titan', 'Conqueror', 'Overlord', 'Dominator', 'Annihilator',
      'Behemoth', 'Leviathan', 'Colossus', 'Harbinger', 'Juggernaut',
      'Sovereign', 'Apex Predator', 'World Eater', 'God King', 'Eternal',
    ];
    this.tierThresholds = [
      0, 200, 600, 1200, 2500,
      5000, 10000, 20000, 40000, 75000,
      130000, 220000, 380000, 600000, 950000,
      1500000, 2400000, 3800000, 6000000, 9500000,
      15000000, 24000000, 38000000, 60000000, 100000000,
    ];
  }

  formatScore(n) {
    if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return '' + n;
  }

  addKill(killerName, victimName, catchphrase) {
    this.killFeed.unshift({
      killer: killerName,
      victim: victimName,
      catchphrase: catchphrase || '',
      time: Date.now(),
    });
    if (this.killFeed.length > 5) this.killFeed.pop();
  }

  showTierUp(tier) {
    const name = this.tierNames[tier] || `Tier ${tier}`;
    this.tierUpNotification = {
      text: `TIER UP!`,
      tierName: name,
      time: Date.now(),
      duration: 2500,
    };
  }

  flashScore() {
    this.scoreFlash = 1.0;
  }

  flashDamage(intensity) {
    this.damageFlash = Math.min(1, Math.max(this.damageFlash, intensity));
  }

  showWarpDenied(text) {
    this.warpDeniedNotification = {
      text,
      time: Date.now(),
      duration: 2000,
    };
  }

  draw(ctx, state, me, canvas, mapWidth, mapHeight, instanceId, input) {
    if (!state) return;

    const isMob = input && input.isMobile;

    this.drawDamageVignette(ctx, canvas);
    const lbBottom = this.drawLeaderboard(ctx, state.lb || state.p, me, canvas, isMob);
    this.drawMinimap(ctx, state, me, canvas, mapWidth, mapHeight, isMob, lbBottom);
    this.drawTierProgress(ctx, me, canvas, isMob);
    this.drawScore(ctx, me, canvas, isMob);
    if (!isMob) this.drawKillFeed(ctx, canvas);
    this.drawTierUpNotification(ctx, canvas);
    this.drawWarpDeniedNotification(ctx, canvas);
    if (!isMob) this.drawInstanceId(ctx, canvas, instanceId);
    if (isMob && input) this.drawTouchControls(ctx, canvas, input);
  }

  drawLeaderboard(ctx, players, me, canvas, isMob) {
    if (!players || players.length === 0) return 0;

    const maxEntries = isMob ? 5 : 10;
    const sorted = [...players]
      .sort((a, b) => b.s - a.s)
      .slice(0, maxEntries);

    const w = isMob ? 200 : 270;
    const rowH = isMob ? 24 : 30;
    const titleFontSize = isMob ? 16 : 20;
    const rowFontSize = isMob ? 13 : 16;
    const headerH = isMob ? 30 : 38;

    const x = canvas.width - w - 10;
    const y = 10;
    const h = headerH + sorted.length * rowH;

    // Background
    ctx.fillStyle = isMob ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, w, h);

    const textAlpha = isMob ? 0.7 : 1;
    ctx.globalAlpha = textAlpha;

    // Title
    ctx.font = `bold ${titleFontSize}px "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle = '#00e5ff';
    ctx.textAlign = 'center';
    ctx.fillText('LEADERBOARD', x + w / 2, y + (isMob ? 20 : 26));

    // Rows
    ctx.font = `${rowFontSize}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'left';
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const ry = y + headerH + i * rowH;
      const isMe = me && p.i === me.i;
      const textY = ry + (isMob ? 16 : 20);

      if (isMe) {
        ctx.fillStyle = isMob ? 'rgba(0,229,255,0.1)' : 'rgba(0,229,255,0.15)';
        ctx.fillRect(x, ry, w, rowH);
      }

      // Rank
      ctx.fillStyle = '#888';
      ctx.fillText(`${i + 1}.`, x + (isMob ? 8 : 10), textY);

      // Color dot
      ctx.beginPath();
      ctx.arc(x + (isMob ? 28 : 36), ry + (isMob ? 12 : 15), isMob ? 5 : 6, 0, Math.PI * 2);
      ctx.fillStyle = p.c;
      ctx.fill();

      // Name
      ctx.fillStyle = isMe ? '#00e5ff' : '#ddd';
      const name = (p.n || '???').substring(0, isMob ? 8 : 12);
      ctx.fillText(name, x + (isMob ? 38 : 50), textY);

      // Score (skip kills on mobile)
      ctx.fillStyle = '#999';
      ctx.textAlign = 'right';
      if (isMob) {
        ctx.fillText(this.formatScore(p.s), x + w - 8, textY);
      } else {
        ctx.fillText(`${this.formatScore(p.s)} | ${p.k} kills`, x + w - 10, textY);
      }
      ctx.textAlign = 'left';
    }

    ctx.globalAlpha = 1;
    return y + h;
  }

  drawMinimap(ctx, state, me, canvas, mapWidth, mapHeight, isMob, lbBottom) {
    const size = isMob ? 100 : 160;
    const padding = 10;
    const x = canvas.width - size - padding;
    // Mobile: right below leaderboard; Desktop: bottom-right
    const y = isMob ? ((lbBottom || 0) + 6) : (canvas.height - size - padding);
    const scaleX = size / mapWidth;
    const scaleY = size / mapHeight;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);

    // Food (tiny dots)
    if (state.f) {
      for (const f of state.f) {
        ctx.fillStyle = f.c;
        ctx.fillRect(x + f.x * scaleX, y + f.y * scaleY, 1, 1);
      }
    }

    // Obstacles
    if (state.obs) {
      ctx.fillStyle = 'rgba(100,100,100,0.6)';
      for (const o of state.obs) {
        ctx.fillRect(
          x + o.x * scaleX,
          y + o.y * scaleY,
          Math.max(2, o.w * scaleX),
          Math.max(2, o.h * scaleY)
        );
      }
    }

    // Warp holes
    if (state.wh) {
      for (const wh of state.wh) {
        const wr = Math.max(3, wh.r * scaleX);
        let whColor;
        if (wh.ms <= 5000) whColor = '#00e5ff';
        else if (wh.ms <= 10000) whColor = '#00ff88';
        else whColor = '#aa44ff';
        ctx.beginPath();
        ctx.arc(x + wh.x * scaleX, y + wh.y * scaleY, wr, 0, Math.PI * 2);
        ctx.strokeStyle = whColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Power-ups
    if (state.pu) {
      for (const pu of state.pu) {
        ctx.fillStyle = pu.c;
        ctx.save();
        ctx.translate(x + pu.x * scaleX, y + pu.y * scaleY);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-2, -2, 4, 4);
        ctx.restore();
      }
    }

    // Players
    if (state.p) {
      for (const p of state.p) {
        if (!p.al) continue;
        const isMe = me && p.i === me.i;
        const dotSize = isMe ? 4 : 2.5;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(x + p.x * scaleX, y + p.y * scaleY, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Viewport rectangle
    if (me) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      const vpW = canvas.width / (me.zoom || 1);
      const vpH = canvas.height / (me.zoom || 1);
      ctx.strokeRect(
        x + (me.x - vpW / 2) * scaleX,
        y + (me.y - vpH / 2) * scaleY,
        vpW * scaleX,
        vpH * scaleY
      );
    }
  }

  drawTierProgress(ctx, me, canvas, isMob) {
    if (!me) return;

    const tier = me.ti || 1;
    const score = me.s || 0;
    const currentThreshold = this.tierThresholds[tier - 1] || 0;
    const nextThreshold = this.tierThresholds[tier] || null;

    if (!nextThreshold) return;

    let progress = (score - currentThreshold) / (nextThreshold - currentThreshold);
    progress = Math.max(0, Math.min(1, progress));

    const barW = isMob ? 160 : 300;
    const barH = isMob ? 12 : 18;

    // Mobile: upper-left below score; Desktop: bottom center
    const barX = isMob ? 12 : (canvas.width / 2 - barW / 2);
    const barY = isMob ? 62 : (canvas.height - 110);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    // Empty bar
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(barX, barY, barW, barH);

    // Fill bar
    const nearLevelUp = progress > 0.85;
    const barColor = nearLevelUp ? '#ffab00' : '#00e5ff';
    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, barW * progress, barH);

    // Pulsing glow when near tier-up
    if (nearLevelUp) {
      const pulse = 0.3 + Math.sin(Date.now() * 0.008) * 0.3;
      ctx.fillStyle = `rgba(255, 171, 0, ${pulse})`;
      ctx.fillRect(barX, barY, barW * progress, barH);
    }

    // Bar border
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Label
    const labelFont = isMob ? 11 : 15;
    ctx.font = `${labelFont}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = isMob ? 'left' : 'center';
    ctx.fillStyle = nearLevelUp ? '#ffab00' : '#8899aa';
    const tierName = this.tierNames[tier] || `Tier ${tier}`;
    const nextName = this.tierNames[tier + 1] || `Tier ${tier + 1}`;
    const labelX = isMob ? barX : canvas.width / 2;
    ctx.fillText(`${tierName}  \u2192  ${nextName}`, labelX, barY - 5);

    // Percentage
    const pctFont = isMob ? 10 : 13;
    ctx.font = `${pctFont}px "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle = '#ccc';
    ctx.textAlign = isMob ? 'right' : 'center';
    const pctX = isMob ? (barX + barW) : canvas.width / 2;
    ctx.fillText(`${Math.floor(progress * 100)}%`, pctX, barY + barH - 1);
    ctx.textAlign = 'left';
  }

  drawScore(ctx, me, canvas, isMob) {
    if (!me) return;

    const tier = me.ti || 1;
    const scoreFont = isMob ? 18 : 28;
    const tierFont = isMob ? 14 : 20;

    if (isMob) {
      // Mobile: upper-left (thumbs cover bottom)
      const baseX = 12;
      const baseY = 28;

      ctx.textAlign = 'left';

      // Score
      ctx.font = `bold ${scoreFont}px "Segoe UI", Arial, sans-serif`;
      if (this.scoreFlash > 0) {
        ctx.save();
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 15 * this.scoreFlash;
        ctx.fillStyle = '#fff';
        ctx.fillText(`${(me.s || 0).toLocaleString()}`, baseX, baseY);
        ctx.restore();
        this.scoreFlash = Math.max(0, this.scoreFlash - 0.03);
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillText(`${(me.s || 0).toLocaleString()}`, baseX, baseY);
      }

      // Tier + kills on same line
      ctx.font = `${tierFont}px "Segoe UI", Arial, sans-serif`;
      ctx.fillStyle = '#aaa';
      ctx.fillText(`${this.tierNames[tier]} | K: ${me.k || 0}`, baseX, baseY + 18);
    } else {
      // Desktop: bottom center
      ctx.textAlign = 'center';

      ctx.font = `bold ${scoreFont}px "Segoe UI", Arial, sans-serif`;
      if (this.scoreFlash > 0) {
        ctx.save();
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 15 * this.scoreFlash;
        ctx.fillStyle = '#fff';
        ctx.fillText(`Score: ${(me.s || 0).toLocaleString()}`, canvas.width / 2, canvas.height - 62);
        ctx.restore();
        this.scoreFlash = Math.max(0, this.scoreFlash - 0.03);
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillText(`Score: ${(me.s || 0).toLocaleString()}`, canvas.width / 2, canvas.height - 62);
      }

      // Tier + kills
      ctx.font = `${tierFont}px "Segoe UI", Arial, sans-serif`;
      ctx.fillStyle = '#aaa';
      ctx.fillText(`${this.tierNames[tier]} | Kills: ${me.k || 0}`, canvas.width / 2, canvas.height - 38);
    }

    // Boost fuel gauge
    const fuelMax = me.bfm || 180;
    const fuel = me.bf != null ? me.bf : fuelMax;
    const fuelRatio = fuel / fuelMax;
    const isBoosting = me.boosting;
    const barW = isMob ? 100 : 160;
    const barH = isMob ? 8 : 10;

    // Mobile: upper-left below tier bar; Desktop: bottom center
    const barX = isMob ? 12 : (canvas.width / 2 - barW / 2);
    const barY = isMob ? 84 : (canvas.height - 20);

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(barX, barY, barW, barH);

    const fuelColor = fuelRatio < 0.2 ? '#ff4444' : (isBoosting ? '#00ffcc' : '#00e5ff');
    ctx.fillStyle = fuelColor;
    ctx.fillRect(barX, barY, barW * fuelRatio, barH);

    // Boost label
    if (isMob) {
      ctx.font = '11px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = isBoosting ? '#00ffcc' : '#556';
      ctx.fillText(isBoosting ? 'BOOSTING' : 'BOOST', barX, barY - 3);
    } else {
      ctx.font = '14px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = isBoosting ? '#00ffcc' : (fuelRatio > 0.99 ? '#00e5ff' : '#667');
      const label = isBoosting ? 'BOOSTING' : (fuelRatio > 0.99 ? 'BOOST [Hold Click]' : 'BOOST');
      ctx.fillText(label, canvas.width / 2, barY - 4);
    }
  }

  drawTierUpNotification(ctx, canvas) {
    if (!this.tierUpNotification) return;

    const elapsed = Date.now() - this.tierUpNotification.time;
    if (elapsed > this.tierUpNotification.duration) {
      this.tierUpNotification = null;
      return;
    }

    const progress = elapsed / this.tierUpNotification.duration;
    let alpha;
    if (progress < 0.15) {
      alpha = progress / 0.15;
    } else if (progress < 0.6) {
      alpha = 1;
    } else {
      alpha = 1 - (progress - 0.6) / 0.4;
    }

    let scale = 1;
    if (progress < 0.15) {
      scale = 0.5 + progress / 0.15 * 0.7;
    } else if (progress < 0.3) {
      scale = 1.2 - (progress - 0.15) / 0.15 * 0.2;
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);

    ctx.font = `bold ${Math.round(42 * scale)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#00e5ff';
    ctx.fillText(this.tierUpNotification.text, canvas.width / 2, canvas.height / 3);

    ctx.font = `bold ${Math.round(26 * scale)}px "Segoe UI", Arial, sans-serif`;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.tierUpNotification.tierName, canvas.width / 2, canvas.height / 3 + 40);

    ctx.restore();
  }

  drawWarpDeniedNotification(ctx, canvas) {
    if (!this.warpDeniedNotification) return;

    const elapsed = Date.now() - this.warpDeniedNotification.time;
    if (elapsed > this.warpDeniedNotification.duration) {
      this.warpDeniedNotification = null;
      return;
    }

    const progress = elapsed / this.warpDeniedNotification.duration;
    let alpha;
    if (progress < 0.1) alpha = progress / 0.1;
    else if (progress < 0.6) alpha = 1;
    else alpha = 1 - (progress - 0.6) / 0.4;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ff6666';
    ctx.fillText(this.warpDeniedNotification.text, canvas.width / 2, canvas.height / 2 - 60);
    ctx.restore();
  }

  drawDamageVignette(ctx, canvas) {
    if (this.damageFlash <= 0) return;

    const alpha = this.damageFlash * 0.4;
    const gradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.width * 0.3,
      canvas.width / 2, canvas.height / 2, canvas.width * 0.7
    );
    gradient.addColorStop(0, 'rgba(255,0,0,0)');
    gradient.addColorStop(1, `rgba(255,0,0,${alpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.damageFlash = Math.max(0, this.damageFlash - 0.05);
  }

  drawKillFeed(ctx, canvas) {
    const now = Date.now();
    ctx.textAlign = 'left';

    let y = 28;
    for (let i = 0; i < this.killFeed.length; i++) {
      const entry = this.killFeed[i];
      const age = (now - entry.time) / 1000;
      if (age > 5) continue;

      const alpha = Math.max(0, 1 - age / 5);
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#ff8a80';
      ctx.fillText(`${entry.killer} killed ${entry.victim}`, 14, y);
      y += 32;

      if (entry.catchphrase) {
        ctx.font = 'italic 22px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#ffcc80';
        ctx.fillText(`  "${entry.catchphrase}"`, 14, y);
        y += 28;
      }
    }
    ctx.globalAlpha = 1.0;

    // Clean old entries
    this.killFeed = this.killFeed.filter(e => (now - e.time) < 5000);
  }

  drawInstanceId(ctx, canvas, instanceId) {
    if (!instanceId) return;
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#888';
    ctx.fillText(`inst: ${instanceId}`, 8, canvas.height - 6);
    ctx.restore();
  }

  drawTouchControls(ctx, canvas, input) {
    // Movement joystick (only when active)
    if (input.moveTouch !== null) {
      const ox = input.moveOriginX;
      const oy = input.moveOriginY;
      const jr = input.JOYSTICK_RADIUS;

      // Base circle
      ctx.beginPath();
      ctx.arc(ox, oy, jr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Thumb position
      const thumbX = ox + input.moveDx * jr;
      const thumbY = oy + input.moveDy * jr;
      ctx.beginPath();
      ctx.arc(thumbX, thumbY, 20, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Boost button on opposite side (only visible when joystick is active)
      const bp = input.getBoostPos();
      if (bp) {
        const br = input.BOOST_RADIUS;

        ctx.beginPath();
        ctx.arc(bp.x, bp.y, br, 0, Math.PI * 2);
        ctx.fillStyle = input.boostActive
          ? 'rgba(0, 255, 204, 0.4)'
          : 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
        ctx.strokeStyle = input.boostActive
          ? 'rgba(0, 255, 204, 0.8)'
          : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = input.boostActive ? '#00ffcc' : 'rgba(255,255,255,0.5)';
        ctx.fillText('BOOST', bp.x, bp.y + 5);
      }
    }
  }
}
