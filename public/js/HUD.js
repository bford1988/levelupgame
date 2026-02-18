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

  draw(ctx, state, me, canvas, mapWidth, mapHeight, instanceId) {
    if (!state) return;
    this.drawDamageVignette(ctx, canvas);
    this.drawLeaderboard(ctx, state.lb || state.p, me, canvas);
    this.drawMinimap(ctx, state, me, canvas, mapWidth, mapHeight);
    this.drawTierProgress(ctx, me, canvas);
    this.drawScore(ctx, me, canvas);
    this.drawKillFeed(ctx, canvas);
    this.drawTierUpNotification(ctx, canvas);
    this.drawWarpDeniedNotification(ctx, canvas);
    this.drawInstanceId(ctx, canvas, instanceId);
  }

  drawLeaderboard(ctx, players, me, canvas) {
    if (!players || players.length === 0) return;

    const sorted = [...players]
      .sort((a, b) => b.s - a.s)
      .slice(0, 10);

    const w = 270;
    const x = canvas.width - w - 10;
    const y = 10;
    const rowH = 30;
    const h = 38 + sorted.length * rowH;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, w, h);

    // Title
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#00e5ff';
    ctx.textAlign = 'center';
    ctx.fillText('LEADERBOARD', x + w / 2, y + 26);

    // Rows
    ctx.font = '16px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const ry = y + 38 + i * rowH;
      const isMe = me && p.i === me.i;

      if (isMe) {
        ctx.fillStyle = 'rgba(0,229,255,0.15)';
        ctx.fillRect(x, ry, w, rowH);
      }

      // Rank
      ctx.fillStyle = '#888';
      ctx.fillText(`${i + 1}.`, x + 10, ry + 20);

      // Color dot
      ctx.beginPath();
      ctx.arc(x + 36, ry + 15, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.c;
      ctx.fill();

      // Name
      ctx.fillStyle = isMe ? '#00e5ff' : '#ddd';
      const name = (p.n || '???').substring(0, 12);
      ctx.fillText(name, x + 50, ry + 20);

      // Score + kills
      ctx.fillStyle = '#999';
      ctx.textAlign = 'right';
      ctx.fillText(`${this.formatScore(p.s)} | ${p.k} kills`, x + w - 10, ry + 20);
      ctx.textAlign = 'left';
    }
  }

  drawMinimap(ctx, state, me, canvas, mapWidth, mapHeight) {
    const size = 160;
    const padding = 10;
    const x = canvas.width - size - padding;
    const y = canvas.height - size - padding;
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
      // Approximate viewport in world coords
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

  drawTierProgress(ctx, me, canvas) {
    if (!me) return;

    const tier = me.ti || 1;
    const score = me.s || 0;
    const currentThreshold = this.tierThresholds[tier - 1] || 0;
    const nextThreshold = this.tierThresholds[tier] || null;

    // Don't show if at max tier
    if (!nextThreshold) return;

    let progress = (score - currentThreshold) / (nextThreshold - currentThreshold);
    progress = Math.max(0, Math.min(1, progress));

    const barW = 300;
    const barH = 18;
    const barX = canvas.width / 2 - barW / 2;
    const barY = canvas.height - 110;

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
    ctx.font = '15px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = nearLevelUp ? '#ffab00' : '#8899aa';
    const tierName = this.tierNames[tier] || `Tier ${tier}`;
    const nextName = this.tierNames[tier + 1] || `Tier ${tier + 1}`;
    ctx.fillText(`${tierName}  \u2192  ${nextName}`, canvas.width / 2, barY - 6);

    // Percentage
    ctx.font = '13px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText(`${Math.floor(progress * 100)}%`, canvas.width / 2, barY + barH - 2);
  }

  drawScore(ctx, me, canvas) {
    if (!me) return;

    const tier = me.ti || 1;

    ctx.textAlign = 'center';

    // Score with flash effect
    ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
    if (this.scoreFlash > 0) {
      const flash = this.scoreFlash;
      ctx.save();
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 15 * flash;
      ctx.fillStyle = `rgb(${Math.round(255)}, ${Math.round(255)}, ${Math.round(255)})`;
      ctx.fillText(`Score: ${(me.s || 0).toLocaleString()}`, canvas.width / 2, canvas.height - 62);
      ctx.restore();
      this.scoreFlash = Math.max(0, this.scoreFlash - 0.03);
    } else {
      ctx.fillStyle = '#fff';
      ctx.fillText(`Score: ${(me.s || 0).toLocaleString()}`, canvas.width / 2, canvas.height - 62);
    }

    // Tier + kills
    ctx.font = '20px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`${this.tierNames[tier]} | Kills: ${me.k || 0}`, canvas.width / 2, canvas.height - 38);

    // Boost fuel gauge
    const fuelMax = me.bfm || 180;
    const fuel = me.bf != null ? me.bf : fuelMax;
    const fuelRatio = fuel / fuelMax;
    const isBoosting = me.boosting;
    const barW = 160;
    const barH = 10;
    const barX = canvas.width / 2 - barW / 2;
    const barY = canvas.height - 20;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    // Empty bar
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(barX, barY, barW, barH);

    // Fuel fill
    const fuelColor = fuelRatio < 0.2 ? '#ff4444' : (isBoosting ? '#00ffcc' : '#00e5ff');
    ctx.fillStyle = fuelColor;
    ctx.fillRect(barX, barY, barW * fuelRatio, barH);

    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = isBoosting ? '#00ffcc' : (fuelRatio > 0.99 ? '#00e5ff' : '#667');
    const label = isBoosting ? 'BOOSTING' : (fuelRatio > 0.99 ? 'BOOST [Hold Click]' : 'BOOST');
    ctx.fillText(label, canvas.width / 2, barY - 4);
  }

  drawTierUpNotification(ctx, canvas) {
    if (!this.tierUpNotification) return;

    const elapsed = Date.now() - this.tierUpNotification.time;
    if (elapsed > this.tierUpNotification.duration) {
      this.tierUpNotification = null;
      return;
    }

    const progress = elapsed / this.tierUpNotification.duration;
    // Fade in fast, hold, fade out
    let alpha;
    if (progress < 0.15) {
      alpha = progress / 0.15;
    } else if (progress < 0.6) {
      alpha = 1;
    } else {
      alpha = 1 - (progress - 0.6) / 0.4;
    }

    // Scale punch effect
    let scale = 1;
    if (progress < 0.15) {
      scale = 0.5 + progress / 0.15 * 0.7; // Scale up to 1.2
    } else if (progress < 0.3) {
      scale = 1.2 - (progress - 0.15) / 0.15 * 0.2; // Settle to 1.0
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);

    // "TIER UP!" text
    ctx.font = `bold ${Math.round(42 * scale)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#00e5ff';
    ctx.fillText(this.tierUpNotification.text, canvas.width / 2, canvas.height / 3);

    // Tier name below
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
}
