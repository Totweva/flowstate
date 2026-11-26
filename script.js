// script.js — Complete, working particle simulation
// Volumetric fog, gravity + collisions, shape morphing, adaptive perf

/* ─────────────────────────────
   Utilities
───────────────────────────── */
const isMobile = () =>
  window.matchMedia('(max-width: 768px)').matches ||
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const lerp = (a, b, t) => a + (b - a) * t;

/* ─────────────────────────────
   Particle
───────────────────────────── */
class Particle {
  constructor(system) {
    this.system = system;
    this.reset();
  }

  reset() {
    const w = this.system.logicalWidth || window.innerWidth;
    const h = this.system.logicalHeight || window.innerHeight;
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.vx = (Math.random() - 0.5) * 0.6;
    this.vy = (Math.random() - 0.5) * 0.6;
    this.radius = Math.random() * 1.8 + 0.7;
    this.baseAlpha = Math.random() * 0.55 + 0.25;
    this.alpha = this.baseAlpha;
    this.phase = Math.random() * Math.PI * 2;
  }

  update(mouseX, mouseY, mode, speedMult, gravity, shape) {
    const sys = this.system;
    const w = sys.logicalWidth;
    const h = sys.logicalHeight;

    // Mouse attraction / repulsion
    if (mouseX !== null && mouseY !== null) {
      const dx = mouseX - this.x;
      const dy = mouseY - this.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);

      if (dist < 240 && dist > 0.5) {
        const falloff = (240 - dist) / 240;
        const strength = (mode === 'attract' ? 0.05 : -0.05) * falloff;
        this.vx += (dx / dist) * strength * speedMult;
        this.vy += (dy / dist) * strength * speedMult;
      }
    }

    // Gravity
    this.vy += gravity * 0.12;

    // Shape attraction
    if (shape !== 'free') {
      const target = sys.getShapeTarget(this);
      if (target) {
        const bx = target.x - this.x;
        const by = target.y - this.y;
        const blend = 0.035 * speedMult;
        this.vx = lerp(this.vx, bx * blend, 0.12);
        this.vy = lerp(this.vy, by * blend, 0.12);
      }
    }

    // Damping
    this.vx *= 0.985;
    this.vy *= 0.985;

    // Integrate
    this.x += this.vx * speedMult;
    this.y += this.vy * speedMult;

    // Boundary collision with soft bounce
    const r = this.radius;
    if (this.x < r) { this.x = r; this.vx = Math.abs(this.vx) * 0.55; }
    if (this.x > w - r) { this.x = w - r; this.vx = -Math.abs(this.vx) * 0.55; }
    if (this.y < r) { this.y = r; this.vy = Math.abs(this.vy) * 0.55; }
    if (this.y > h - r) { this.y = h - r; this.vy = -Math.abs(this.vy) * 0.55; }

    // Pulsing alpha
    this.phase += 0.02;
    this.alpha = this.baseAlpha + Math.sin(this.phase) * 0.15;
    this.alpha = Math.max(0.08, Math.min(0.95, this.alpha));
  }

  draw(ctx, color) {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* ─────────────────────────────
   Volumetric Fog
───────────────────────────── */
class VolumetricFog {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.blobs = [];
    this.intensity = 0.7;
    this.t = 0;
    this.w = 0;
    this.h = 0;
  }

  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
    this.build();
  }

  build() {
    const count = isMobile() ? 4 : 7;
    this.blobs = [];
    for (let i = 0; i < count; i++) {
      this.blobs.push({
        x: Math.random() * (this.w || 800),
        y: Math.random() * (this.h || 600),
        r: 160 + Math.random() * 260,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        hue: 220 + Math.random() * 60,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  update(dt) {
    this.t += dt * 0.001;
    for (const b of this.blobs) {
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < -b.r) b.x = this.w + b.r;
      if (b.x > this.w + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = this.h + b.r;
      if (b.y > this.h + b.r) b.y = -b.r;
    }
  }

  draw() {
    const { ctx, w, h } = this;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    for (const b of this.blobs) {
      const pulse = 1 + Math.sin(this.t + b.phase) * 0.12;
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * pulse);
      const alpha = 0.05 * this.intensity;
      g.addColorStop(0, `hsla(${b.hue}, 70%, 60%, ${alpha})`);
      g.addColorStop(0.5, `hsla(${b.hue}, 60%, 40%, ${alpha * 0.4})`);
      g.addColorStop(1, `hsla(${b.hue}, 50%, 20%, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(
        b.x - b.r * pulse,
        b.y - b.r * pulse,
        b.r * pulse * 2,
        b.r * pulse * 2
      );
    }

    ctx.globalCompositeOperation = 'source-over';
  }
}

/* ─────────────────────────────
   Particle System
───────────────────────────── */
class ParticleSystem {
  constructor() {
    this.canvas = document.getElementById('particle-canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.fog = new VolumetricFog(document.getElementById('fog-canvas'));

    this.particles = [];
    this.count = isMobile() ? 700 : 1200;
    this.speed = 1.0;
    this.gravity = 0.0;
    this.mode = 'attract';
    this.color = '#7aa2f7';
    this.shape = 'free';
    this.isPaused = false;

    this.mouseX = null;
    this.mouseY = null;

    this.logicalWidth = window.innerWidth;
    this.logicalHeight = window.innerHeight;

    this.lastTime = 0;
    this.animTime = 0;

    this.init();
    this.bindEvents();

    requestAnimationFrame((t) => this.loop(t));
  }

  init() {
    this.resize();
    this.createParticles();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.logicalWidth = w;
    this.logicalHeight = h;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.fog.resize(w, h);

    if (this.particles.length) {
      for (const p of this.particles) {
        if (p.x > w) p.x = Math.random() * w;
        if (p.y > h) p.y = Math.random() * h;
      }
    }
  }

  createParticles() {
    this.particles = [];
    for (let i = 0; i < this.count; i++) {
      this.particles.push(new Particle(this));
    }
  }

  getShapeTarget(p) {
    const cx = this.logicalWidth / 2;
    const cy = this.logicalHeight / 2;
    const R = Math.min(cx, cy) * 0.55;
    const idx = this.particles.indexOf(p);
    const total = this.particles.length || 1;
    const t = idx / total;

    switch (this.shape) {
      case 'sphere': {
        const phi = Math.acos(1 - 2 * ((idx + 0.5) / total));
        const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
        const r3 = R * (0.85 + Math.sin(idx * 0.13) * 0.05);
        const x3 = r3 * Math.sin(phi) * Math.cos(theta);
        const y3 = r3 * Math.sin(phi) * Math.sin(theta);
        const z3 = r3 * Math.cos(phi);
        const persp = 1 + z3 / (R * 3);
        return { x: cx + x3 * persp, y: cy + y3 * persp };
      }
      case 'cube': {
        const edge = Math.floor(idx / (total / 12));
        const seg = (idx % (total / 12)) / (total / 12);
        const angle = this.animTime * 0.0003;
        const half = R * 0.9;
        const verts = [
          [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
          [-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],
        ];
        const edges = [
          [0,1],[1,2],[2,3],[3,0],
          [4,5],[5,6],[6,7],[7,4],
          [0,4],[1,5],[2,6],[3,7],
        ];
        const [a, b] = edges[edge % edges.length];
        const va = verts[a], vb = verts[b];
        const x3 = lerp(va[0], vb[0], seg) * half;
        const y3 = lerp(va[1], vb[1], seg) * half;
        const z3 = lerp(va[2], vb[2], seg) * half;
        const ca = Math.cos(angle), sa = Math.sin(angle);
        const rx = x3 * ca - z3 * sa;
        const rz = x3 * sa + z3 * ca;
        const persp = 1 + rz / (R * 4);
        return { x: cx + rx * persp, y: cy + y3 * persp };
      }
      case 'ring': {
        const angle = t * Math.PI * 2;
        const r = R * (1 + Math.sin(idx * 0.21) * 0.06);
        return {
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
        };
      }
      case 'helix': {
        const turns = 4;
        const angle = t * Math.PI * 2 * turns + this.animTime * 0.0005;
        const r = R * 0.4;
        const yOff = (t - 0.5) * R * 2;
        return {
          x: cx + Math.cos(angle) * r,
          y: cy + yOff + Math.sin(angle) * r * 0.3,
        };
      }
      default:
        return null;
    }
  }

  bindEvents() {
    // Pointer events
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    window.addEventListener('mouseleave', () => {
      this.mouseX = null;
      this.mouseY = null;
    });

    window.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      this.mouseX = t.clientX;
      this.mouseY = t.clientY;
    }, { passive: false });

    window.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      this.mouseX = t.clientX;
      this.mouseY = t.clientY;
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.mouseX = null;
      this.mouseY = null;
    });

    // Resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.resize();
        this.createParticles();
      }, 200);
    });

    // Panel collapse
    const panel = document.getElementById('ui-panel');
    const panelToggle = document.getElementById('panel-toggle');
    panelToggle.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      panelToggle.textContent = panel.classList.contains('collapsed') ? '+' : '—';
    });

    // Sliders
    document.getElementById('count').addEventListener('input', (e) => {
      this.count = parseInt(e.target.value);
      document.getElementById('count-value').textContent = this.count;
      this.createParticles();
    });

    document.getElementById('speed').addEventListener('input', (e) => {
      this.speed = parseFloat(e.target.value);
      document.getElementById('speed-value').textContent = this.speed.toFixed(1);
    });

    document.getElementById('gravity').addEventListener('input', (e) => {
      this.gravity = parseFloat(e.target.value);
      document.getElementById('gravity-value').textContent = this.gravity.toFixed(1);
    });

    document.getElementById('fog').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      this.fog.intensity = v;
      document.getElementById('fog-value').textContent = v.toFixed(1);
    });

    // Mode switching
    const attractBtn = document.getElementById('mode-attract');
    const repelBtn = document.getElementById('mode-repel');

    attractBtn.addEventListener('click', () => {
      this.mode = 'attract';
      attractBtn.classList.add('active');
      attractBtn.setAttribute('aria-pressed', 'true');
      repelBtn.classList.remove('active');
      repelBtn.setAttribute('aria-pressed', 'false');
    });

    repelBtn.addEventListener('click', () => {
      this.mode = 'repel';
      repelBtn.classList.add('active');
      repelBtn.setAttribute('aria-pressed', 'true');
      attractBtn.classList.remove('active');
      attractBtn.setAttribute('aria-pressed', 'false');
    });

    // Color swatches
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach((swatch) => {
      swatch.addEventListener('click', (e) => {
        swatches.forEach((s) => s.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.color = e.currentTarget.dataset.color;
      });
    });

    // Shape buttons
    const shapeBtns = document.querySelectorAll('.shape-btn');
    shapeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        shapeBtns.forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        this.shape = btn.dataset.shape;
      });
    });

    // Pause / Play
    const pauseBtn = document.getElementById('pause-play');
    pauseBtn.addEventListener('click', () => {
      this.isPaused = !this.isPaused;
      pauseBtn.textContent = this.isPaused ? '▶' : '⏸';
      pauseBtn.setAttribute('aria-label', this.isPaused ? 'Play simulation' : 'Pause simulation');
    });

    // Reset
    document.getElementById('reset').addEventListener('click', () => {
      this.createParticles();
      this.isPaused = false;
      pauseBtn.textContent = '⏸';
      pauseBtn.setAttribute('aria-label', 'Pause simulation');
    });

    // Fullscreen
    document.getElementById('fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn('Fullscreen request failed:', err);
        });
      } else {
        document.exitFullscreen();
      }
    });
  }

  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min(timestamp - this.lastTime, 50);
    this.lastTime = timestamp;

    if (!this.isPaused) {
      this.animTime += dt;

      // Update fog
      this.fog.update(dt);
      this.fog.draw();

      // Clear particle canvas
      this.ctx.fillStyle = '#05050a';
      this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

      // Update & draw particles
      const w = this.logicalWidth;
      const h = this.logicalHeight;
      const particles = this.particles;
      const len = particles.length;

      for (let i = 0; i < len; i++) {
        const p = particles[i];
        p.update(this.mouseX, this.mouseY, this.mode, this.speed, this.gravity, this.shape);
        p.draw(this.ctx, this.color);
      }
    }

    requestAnimationFrame((t) => this.loop(t));
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ParticleSystem());
} else {
  new ParticleSystem();
}