/* SolitaireRealm - Theme Manager + Ambient Canvas */
'use strict';

class ThemeManager {
  constructor() {
    this._currentTheme = 'cyberpunk';
    this._canvas = null;
    this._ctx = null;
    this._particles = [];
    this._animFrame = null;
    this._ambientType = 'none';
    this._resizeObserver = null;

    this.themes = [
      { id: 'cyberpunk',  name: 'Cyberpunk',  emoji: '🌆', description: 'Neon lights & dark alleys',    ambientType: 'rain' },
      { id: 'medieval',   name: 'Medieval',   emoji: '🏰', description: 'Ancient castles & parchment',  ambientType: 'none' },
      { id: 'zen',        name: 'Zen',         emoji: '🌸', description: 'Peaceful & minimal',            ambientType: 'sakura' },
      { id: 'space',      name: 'Space',       emoji: '🚀', description: 'Among the stars',              ambientType: 'stars' },
      { id: 'coffee',     name: 'Coffee',      emoji: '☕', description: 'Warm & cozy café vibes',       ambientType: 'none' },
      { id: 'egypt',      name: 'Egypt',       emoji: '🏺', description: 'Ancient sands & gold',         ambientType: 'none' },
      { id: 'pirate',     name: 'Pirate',      emoji: '🏴‍☠️', description: 'Sail the seven seas',        ambientType: 'none' },
      { id: 'cabin',      name: 'Cabin',       emoji: '🪵', description: 'Rustic warmth by the fire',   ambientType: 'embers' },
      { id: 'neon',       name: 'Neon',        emoji: '💡', description: 'Electric hot pink & lime',     ambientType: 'none' },
      { id: 'ocean',      name: 'Ocean',       emoji: '🌊', description: 'Deep sea & seafoam',           ambientType: 'bubbles' },
    ];
  }

  init(canvasId) {
    this._canvas = document.getElementById(canvasId);
    if (this._canvas) {
      this._ctx = this._canvas.getContext('2d');
      this._resizeCanvas();

      this._resizeObserver = new ResizeObserver(() => this._resizeCanvas());
      this._resizeObserver.observe(document.body);

      window.addEventListener('resize', () => this._resizeCanvas());
    }
  }

  _resizeCanvas() {
    if (!this._canvas) return;
    this._canvas.width = window.innerWidth;
    this._canvas.height = window.innerHeight;
    // Re-init particles after resize
    if (this._ambientType !== 'none') {
      this._initParticles(this._ambientType);
    }
  }

  setTheme(themeId) {
    const theme = this.themes.find(t => t.id === themeId);
    if (!theme) return;

    // Remove old theme class
    document.body.classList.forEach(cls => {
      if (cls.startsWith('theme-')) document.body.classList.remove(cls);
    });

    document.body.classList.add(`theme-${themeId}`);
    this._currentTheme = themeId;

    // Start ambient for theme
    this.startAmbient(theme.ambientType);

    return theme;
  }

  getCurrentTheme() {
    return this._currentTheme;
  }

  getThemeIndex() {
    return this.themes.findIndex(t => t.id === this._currentTheme);
  }

  nextTheme() {
    const idx = (this.getThemeIndex() + 1) % this.themes.length;
    this.setTheme(this.themes[idx].id);
    return this.themes[idx];
  }

  getAvailableThemes() {
    return this.themes;
  }

  // ==========================================
  // Ambient Particle System
  // ==========================================
  startAmbient(type) {
    this.stopAmbient();
    this._ambientType = type;
    if (type === 'none' || !this._canvas || !this._ctx) return;

    this._initParticles(type);
    this._animateParticles();
  }

  stopAmbient() {
    this._ambientType = 'none';
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
    this._particles = [];
    if (this._ctx) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
  }

  _initParticles(type) {
    this._particles = [];
    const w = this._canvas ? this._canvas.width : window.innerWidth;
    const h = this._canvas ? this._canvas.height : window.innerHeight;
    const count = this._getParticleCount(type);

    for (let i = 0; i < count; i++) {
      this._particles.push(this._createParticle(type, w, h, true));
    }
  }

  _getParticleCount(type) {
    const counts = {
      rain: 120,
      snow: 80,
      embers: 50,
      stars: 100,
      sakura: 40,
      bubbles: 35,
      fireflies: 25,
    };
    return counts[type] || 60;
  }

  _createParticle(type, w, h, random) {
    const p = {};
    switch (type) {
      case 'rain':
        p.x = Math.random() * w;
        p.y = random ? Math.random() * h : -10;
        p.length = 10 + Math.random() * 20;
        p.speed = 8 + Math.random() * 8;
        p.opacity = 0.1 + Math.random() * 0.4;
        p.angle = 0.2 + Math.random() * 0.1; // slight angle
        break;
      case 'snow':
        p.x = Math.random() * w;
        p.y = random ? Math.random() * h : -10;
        p.r = 1.5 + Math.random() * 3;
        p.speed = 0.5 + Math.random() * 1.5;
        p.drift = (Math.random() - 0.5) * 0.5;
        p.opacity = 0.4 + Math.random() * 0.6;
        p.wobble = Math.random() * Math.PI * 2;
        p.wobbleSpeed = 0.01 + Math.random() * 0.02;
        break;
      case 'embers':
        p.x = w * 0.3 + Math.random() * w * 0.4;
        p.y = random ? Math.random() * h : h + 5;
        p.r = 1 + Math.random() * 3;
        p.speed = 0.4 + Math.random() * 1;
        p.drift = (Math.random() - 0.5) * 0.8;
        p.opacity = 0.5 + Math.random() * 0.5;
        p.life = Math.random();
        p.hue = 10 + Math.random() * 20; // orange-red
        break;
      case 'stars':
        p.x = Math.random() * w;
        p.y = Math.random() * h;
        p.r = 0.5 + Math.random() * 2;
        p.opacity = 0.2 + Math.random() * 0.8;
        p.baseOpacity = p.opacity;
        p.twinkleSpeed = 0.005 + Math.random() * 0.02;
        p.twinkleOffset = Math.random() * Math.PI * 2;
        p.speed = 0; // static
        break;
      case 'sakura':
        p.x = Math.random() * w;
        p.y = random ? Math.random() * h : -10;
        p.r = 3 + Math.random() * 5;
        p.speedX = (Math.random() - 0.5) * 1.5;
        p.speedY = 0.5 + Math.random() * 1.5;
        p.rotation = Math.random() * Math.PI * 2;
        p.rotSpeed = (Math.random() - 0.5) * 0.05;
        p.opacity = 0.5 + Math.random() * 0.5;
        p.sway = Math.random() * Math.PI * 2;
        p.swaySpeed = 0.01 + Math.random() * 0.02;
        break;
      case 'bubbles':
        p.x = Math.random() * w;
        p.y = random ? Math.random() * h : h + 10;
        p.r = 4 + Math.random() * 14;
        p.speed = 0.3 + Math.random() * 0.8;
        p.drift = (Math.random() - 0.5) * 0.3;
        p.opacity = 0.05 + Math.random() * 0.15;
        p.wobble = Math.random() * Math.PI * 2;
        p.wobbleSpeed = 0.01 + Math.random() * 0.02;
        break;
      case 'fireflies':
        p.x = Math.random() * w;
        p.y = Math.random() * h;
        p.r = 1.5 + Math.random() * 2;
        p.vx = (Math.random() - 0.5) * 0.5;
        p.vy = (Math.random() - 0.5) * 0.5;
        p.opacity = Math.random();
        p.glowPhase = Math.random() * Math.PI * 2;
        p.glowSpeed = 0.02 + Math.random() * 0.03;
        break;
    }
    p.type = type;
    return p;
  }

  _animateParticles() {
    if (this._ambientType === 'none') return;

    const draw = () => {
      if (this._ambientType === 'none') return;
      this._updateParticles();
      this._animFrame = requestAnimationFrame(draw);
    };

    this._animFrame = requestAnimationFrame(draw);
  }

  _updateParticles() {
    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;

    ctx.clearRect(0, 0, w, h);

    const type = this._ambientType;

    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];

      switch (type) {
        case 'rain': {
          const dx = Math.sin(p.angle) * p.length;
          const dy = Math.cos(p.angle) * p.length;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + dx, p.y + dy);
          ctx.strokeStyle = `rgba(150, 200, 255, ${p.opacity})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          p.y += p.speed;
          p.x += Math.sin(p.angle) * p.speed * 0.3;
          if (p.y > h + p.length) {
            Object.assign(p, this._createParticle(type, w, h, false));
            p.x = Math.random() * w;
          }
          break;
        }
        case 'snow': {
          p.wobble += p.wobbleSpeed;
          p.x += Math.sin(p.wobble) * 0.5 + p.drift;
          p.y += p.speed;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
          ctx.fill();
          if (p.y > h + p.r) {
            Object.assign(p, this._createParticle(type, w, h, false));
          }
          break;
        }
        case 'embers': {
          p.life += 0.005;
          p.x += p.drift + Math.sin(p.life * 2) * 0.5;
          p.y -= p.speed;
          const opacity = p.opacity * Math.sin(p.life * Math.PI);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 100%, 60%, ${Math.max(0, opacity)})`;
          ctx.fill();
          if (p.y < -10 || opacity <= 0 || p.life > 1) {
            Object.assign(p, this._createParticle(type, w, h, false));
          }
          break;
        }
        case 'stars': {
          p.twinkleOffset += p.twinkleSpeed;
          p.opacity = p.baseOpacity * (0.6 + 0.4 * Math.sin(p.twinkleOffset));
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
          ctx.fill();
          break;
        }
        case 'sakura': {
          p.sway += p.swaySpeed;
          p.rotation += p.rotSpeed;
          p.x += p.speedX + Math.sin(p.sway) * 0.8;
          p.y += p.speedY;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.globalAlpha = p.opacity;
          // Draw simple petal shape
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r * 2, p.r, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 180, 200, 0.8)';
          ctx.fill();
          ctx.restore();
          if (p.y > h + p.r || p.x < -p.r || p.x > w + p.r) {
            Object.assign(p, this._createParticle(type, w, h, false));
          }
          break;
        }
        case 'bubbles': {
          p.wobble += p.wobbleSpeed;
          p.x += Math.sin(p.wobble) * 0.5 + p.drift;
          p.y -= p.speed;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(150, 220, 255, ${p.opacity * 2})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          // Highlight
          ctx.beginPath();
          ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
          ctx.fill();
          if (p.y < -p.r) {
            Object.assign(p, this._createParticle(type, w, h, false));
          }
          break;
        }
        case 'fireflies': {
          p.glowPhase += p.glowSpeed;
          p.x += p.vx + (Math.random() - 0.5) * 0.2;
          p.y += p.vy + (Math.random() - 0.5) * 0.2;
          p.opacity = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(p.glowPhase));

          // Wrap around
          if (p.x < 0) p.x = w;
          if (p.x > w) p.x = 0;
          if (p.y < 0) p.y = h;
          if (p.y > h) p.y = 0;

          // Glow
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
          gradient.addColorStop(0, `rgba(200, 255, 100, ${p.opacity})`);
          gradient.addColorStop(1, 'rgba(200, 255, 100, 0)');
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
          break;
        }
      }
    }
  }
}

window.ThemeManager = ThemeManager;
