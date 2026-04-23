import { trackUiEvent } from './telemetry.js';

export const CONFETTI_SCORE_THRESHOLD = 80;

const PARTICLE_COUNT = 120;
const DURATION_MS = 2500;
const FADE_MS = 500;
const GRAVITY = 0.15;
const BRAND_VAR_NAMES = ['--green', '--amber', '--red', '--topbar-accent', '--topbar-link'];
const FALLBACK_COLORS = ['#1a7a2e', '#8a6000', '#b0291a', '#1a7a2e', '#314735'];
const CANVAS_ID = 'confetti-canvas';

function readBrandColors() {
  try {
    const styles = window.getComputedStyle(document.documentElement);
    const colors = BRAND_VAR_NAMES
      .map((name) => styles.getPropertyValue(name).trim())
      .filter(Boolean);
    return colors.length > 0 ? colors : FALLBACK_COLORS;
  } catch {
    return FALLBACK_COLORS;
  }
}

function removeExistingCanvas() {
  const existing = document.getElementById(CANVAS_ID);
  if (existing) {
    if (existing._confettiRaf) {
      cancelAnimationFrame(existing._confettiRaf);
    }
    existing.remove();
  }
}

function createCanvas() {
  const canvas = document.createElement('canvas');
  canvas.id = CANVAS_ID;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:100vw',
    'height:100vh',
    'pointer-events:none',
    'z-index:50',
  ].join(';');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  return canvas;
}

function makeParticle(width, colors) {
  return {
    x: width / 2 + (Math.random() - 0.5) * width * 0.3,
    y: -10 - Math.random() * 40,
    vx: (Math.random() - 0.5) * 12,
    vy: 6 + Math.random() * 8,
    size: 4 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.2,
    drift: (Math.random() - 0.5) * 0.05,
  };
}

export function fireConfetti({ verdict, assistantId, score } = {}) {
  if (
    typeof document === 'undefined' ||
    typeof document.createElement !== 'function' ||
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return;
  }

  const baseProps = {
    verdict: verdict || '',
    assistant_id: assistantId || 'overall',
  };
  const measurements = Number.isFinite(score) ? { score } : {};

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    trackUiEvent(
      'confetti_fired_client',
      { ...baseProps, skipped_reason: 'reduced_motion' },
      measurements
    );
    return;
  }

  removeExistingCanvas();

  const canvas = createCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  document.body.appendChild(canvas);

  const colors = readBrandColors();
  const particles = Array.from({ length: PARTICLE_COUNT }, () =>
    makeParticle(canvas.width, colors)
  );

  const startTime = performance.now();

  function frame(now) {
    const elapsed = now - startTime;
    if (elapsed >= DURATION_MS) {
      canvas.remove();
      return;
    }

    const fadeStart = DURATION_MS - FADE_MS;
    const alpha = elapsed < fadeStart ? 1 : 1 - (elapsed - fadeStart) / FADE_MS;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = Math.max(0, alpha);

    for (const p of particles) {
      p.vy += GRAVITY;
      p.vx += p.drift;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    canvas._confettiRaf = requestAnimationFrame(frame);
  }

  canvas._confettiRaf = requestAnimationFrame(frame);

  trackUiEvent('confetti_fired_client', baseProps, measurements);
}
