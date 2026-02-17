class HUD {
  constructor() {
    this.killFeed = [];
  }

  formatScore(n) {
    if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return '' + n;
  }

  addKill(killerName, victimName) {
    this.killFeed.unshift({
      killer: killerName,
      victim: victimName,
      time: Date.now(),
    });
    if (this.killFeed.length > 5) this.killFeed.pop();
  }

  draw(ctx, state, me, canvas, mapWidth, mapHeight) {
    if (!state) return;
    this.drawLeaderboard(ctx, state.lb || state.p, me, canvas);
    this.drawMinimap(ctx, state, me, canvas, mapWidth, mapHeight);
    this.drawScore(ctx, me, canvas);
    this.drawKillFeed(ctx, canvas);
  }

  drawLeaderboard(ctx, players, me, canvas) {
    if (!players || players.length === 0) return;

    const sorted = [...players]
      .sort((a, b) => b.s - a.s)
      .slice(0, 10);

    const x = canvas.width - 210;
    const y = 10;
    const rowH = 24;
    const w = 200;
    const h = 30 + sorted.length * rowH;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, w, h);

    // Title
    ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#00e5ff';
    ctx.textAlign = 'center';
    ctx.fillText('LEADERBOARD', x + w / 2, y + 20);

    // Rows
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const ry = y + 30 + i * rowH;
      const isMe = me && p.i === me.i;

      if (isMe) {
        ctx.fillStyle = 'rgba(0,229,255,0.15)';
        ctx.fillRect(x, ry, w, rowH);
      }

      // Rank
      ctx.fillStyle = '#888';
      ctx.fillText(`${i + 1}.`, x + 8, ry + 16);

      // Color dot
      ctx.beginPath();
      ctx.arc(x + 30, ry + 12, 5, 0, Math.PI * 2);
      ctx.fillStyle = p.c;
      ctx.fill();

      // Name
      ctx.fillStyle = isMe ? '#00e5ff' : '#ddd';
      const name = (p.n || '???').substring(0, 12);
      ctx.fillText(name, x + 42, ry + 16);

      // Score + kills
      ctx.fillStyle = '#999';
      ctx.textAlign = 'right';
      ctx.fillText(`${this.formatScore(p.s)} | ${p.k}K`, x + w - 8, ry + 16);
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

  drawScore(ctx, me, canvas) {
    if (!me) return;

    const tierNames = [
      '', 'Recruit', 'Soldier', 'Veteran', 'Fighter', 'Warrior',
      'Guardian', 'Knight', 'Champion', 'Destroyer', 'Warlord',
      'Titan', 'Conqueror', 'Overlord', 'Dominator', 'Annihilator',
      'Behemoth', 'Leviathan', 'Colossus', 'Harbinger', 'Juggernaut',
      'Sovereign', 'Apex Predator', 'World Eater', 'God King', 'Eternal',
    ];
    const tier = me.ti || 1;

    ctx.textAlign = 'center';

    // Score
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Score: ${this.formatScore(me.s || 0)}`, canvas.width / 2, canvas.height - 50);

    // Tier + kills
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`${tierNames[tier]} | Kills: ${me.k || 0}`, canvas.width / 2, canvas.height - 30);

    // Boost cooldown indicator
    const boostMax = me.bm || 150;
    const boostCd = me.bc || 0;
    const boostReady = boostCd <= 0;
    const barW = 100;
    const barH = 8;
    const barX = canvas.width / 2 - barW / 2;
    const barY = canvas.height - 18;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    if (boostReady) {
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(barX, barY, barW, barH);
    } else {
      const ratio = 1 - boostCd / boostMax;
      ctx.fillStyle = '#335';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(barX, barY, barW * ratio, barH);
    }

    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = boostReady ? '#00e5ff' : '#667';
    ctx.fillText(boostReady ? 'BOOST READY [Click]' : 'BOOST', canvas.width / 2, barY - 3);
  }

  drawKillFeed(ctx, canvas) {
    const now = Date.now();
    ctx.font = '13px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';

    let y = 14;
    for (let i = 0; i < this.killFeed.length; i++) {
      const entry = this.killFeed[i];
      const age = (now - entry.time) / 1000;
      if (age > 5) continue;

      const alpha = Math.max(0, 1 - age / 5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ff8a80';
      ctx.fillText(`${entry.killer} killed ${entry.victim}`, 10, y);
      y += 18;
    }
    ctx.globalAlpha = 1.0;

    // Clean old entries
    this.killFeed = this.killFeed.filter(e => (now - e.time) < 5000);
  }
}
