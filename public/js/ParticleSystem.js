class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  emit(type, x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const p = { x, y, color, life: 1, maxLife: 1 };

      switch (type) {
        case 'death':
          p.vx = (Math.random() - 0.5) * 8;
          p.vy = (Math.random() - 0.5) * 8;
          p.radius = 3 + Math.random() * 5;
          p.maxLife = 0.8 + Math.random() * 0.4;
          p.life = p.maxLife;
          break;
        case 'hit':
          p.vx = (Math.random() - 0.5) * 4;
          p.vy = (Math.random() - 0.5) * 4;
          p.radius = 2 + Math.random() * 2;
          p.maxLife = 0.3 + Math.random() * 0.2;
          p.life = p.maxLife;
          break;
        case 'eat':
          p.vx = (Math.random() - 0.5) * 2;
          p.vy = -1 - Math.random() * 2;
          p.radius = 2 + Math.random() * 2;
          p.maxLife = 0.4 + Math.random() * 0.2;
          p.life = p.maxLife;
          break;
        case 'trail':
          p.vx = (Math.random() - 0.5) * 0.5;
          p.vy = (Math.random() - 0.5) * 0.5;
          p.radius = 2 + Math.random() * 3;
          p.maxLife = 0.5 + Math.random() * 0.3;
          p.life = p.maxLife;
          break;
      }

      this.particles.push(p);
    }
  }

  emitText(text, x, y, color, size) {
    this.particles.push({
      x,
      y,
      color,
      text,
      fontSize: size || 16,
      isText: true,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -1.5 - Math.random() * 0.5,
      life: 1.2,
      maxLife: 1.2,
    });
  }

  emitCatchphrase(text, x, y, color) {
    this.particles.push({
      x,
      y,
      color,
      text,
      fontSize: 32,
      isText: true,
      vx: 0,
      vy: -0.6,
      life: 3.5,
      maxLife: 3.5,
    });
  }

  emitTierUp(x, y, color) {
    // Big radial burst
    for (let i = 0; i < 50; i++) {
      const angle = (i / 50) * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      this.particles.push({
        x,
        y,
        color,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 4 + Math.random() * 6,
        life: 1.2 + Math.random() * 0.5,
        maxLife: 1.5,
      });
    }
    // Inner ring of white sparkles
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      this.particles.push({
        x,
        y,
        color: '#ffffff',
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 3,
        life: 0.8 + Math.random() * 0.4,
        maxLife: 1.0,
      });
    }
  }

  emitExplosion(x, y, radius) {
    // Big fiery explosion for mines
    const colors = ['#ff4400', '#ff6600', '#ff8800', '#ffaa00', '#ffcc00', '#ffffff'];

    // Shockwave ring particles
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2;
      const speed = 6 + Math.random() * 8;
      this.particles.push({
        x,
        y,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 5 + Math.random() * 8,
        life: 0.8 + Math.random() * 0.4,
        maxLife: 1.2,
      });
    }

    // Inner dense burst
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 5;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        color: colors[Math.floor(Math.random() * 3)], // hotter colors
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 6 + Math.random() * 10,
        life: 0.6 + Math.random() * 0.5,
        maxLife: 1.0,
      });
    }

    // Smoke puffs (darker, slower, longer-lived)
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        color: '#553322',
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        radius: 8 + Math.random() * 12,
        life: 1.0 + Math.random() * 0.8,
        maxLife: 1.8,
      });
    }

    // Add expanding ring effect
    this.particles.push({
      x,
      y,
      color: '#ff6600',
      vx: 0,
      vy: 0,
      radius: radius,
      life: 0.6,
      maxLife: 0.6,
      isRing: true,
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx, camera) {
    for (const p of this.particles) {
      const screen = camera.worldToScreen(p.x, p.y);
      const alpha = Math.max(0, p.life / p.maxLife);

      if (p.isText) {
        const scale = 0.5 + alpha * 0.5;
        const size = Math.round(p.fontSize * scale * camera.zoom);
        if (size < 4) continue;
        ctx.font = `bold ${size}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = alpha;
        // Shadow for readability
        ctx.fillStyle = '#000';
        ctx.fillText(p.text, screen.x + 1, screen.y + 1);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, screen.x, screen.y);
      } else if (p.isRing) {
        // Expanding explosion ring
        const progress = 1 - alpha;
        const r = p.radius * (0.3 + progress * 2.5) * camera.zoom;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, (6 - progress * 5) * camera.zoom);
        ctx.globalAlpha = alpha * 0.7;
        ctx.stroke();
      } else {
        const r = p.radius * camera.zoom * alpha;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.8;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;
  }
}
