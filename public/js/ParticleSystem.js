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
      const r = p.radius * camera.zoom * alpha;

      ctx.beginPath();
      ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha * 0.8;
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }
}
