/**
 * Intelligence core — always alive, state-driven, premium (soft, not neon).
 */
export function createIntelligenceCore(canvas) {
  const ctx = canvas.getContext("2d");
  let state = "idle";
  let level = 0; // mic / speech energy 0..1
  let t0 = performance.now();

  const particles = Array.from({ length: 42 }, (_, i) => ({
    a: (i / 42) * Math.PI * 2,
    r: 52 + (i % 6) * 7,
    s: 0.003 + (i % 5) * 0.0012,
    size: 1 + (i % 3) * 0.4,
  }));

  const nodes = Array.from({ length: 14 }, (_, i) => ({
    a: (i / 14) * Math.PI * 2,
    r: 78,
  }));

  function setState(next) {
    state = String(next || "idle").toLowerCase();
    t0 = performance.now();
  }

  function setLevel(v) {
    level += (Math.max(0, Math.min(1, v)) - level) * 0.35;
  }

  function frame(now) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);

    const breath = 0.5 + Math.sin(now / 1400) * 0.5;
    const radius = 118 + (state === "listening" || state === "speaking" ? level * 18 : breath * 4);

    const glow = ctx.createRadialGradient(cx, cy - 8, 8, cx, cy, radius + 36);
    const glowAlpha =
      state === "idle"
        ? 0.08 + breath * 0.04
        : 0.1 + level * 0.14 + (state === "thinking" ? 0.04 : 0);
    glow.addColorStop(0, `rgba(59,130,246,${glowAlpha})`);
    glow.addColorStop(1, "rgba(18,24,34,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(148,163,184,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Tiny floating stars (idle)
    if (state === "idle" || state === "finished") {
      for (const p of particles) {
        p.a += p.s;
        const x = cx + Math.cos(p.a) * p.r;
        const y = cy + Math.sin(p.a * 1.05) * p.r * 0.9;
        ctx.fillStyle = `rgba(255,255,255,${0.2 + breath * 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (state === "listening") {
      // Real-time waveform ring
      ctx.beginPath();
      for (let i = 0; i <= 64; i += 1) {
        const a = (i / 64) * Math.PI * 2;
        const amp = 8 + level * 28 + Math.sin(now / 80 + i) * (3 + level * 8);
        const rr = radius + 6 + amp;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(59,130,246,${0.35 + level * 0.4})`;
      ctx.stroke();
    }

    if (state === "thinking") {
      for (const p of particles) {
        p.a += p.s * (2.8 + level);
        const x = cx + Math.cos(p.a) * (p.r * 0.9);
        const y = cy + Math.sin(p.a) * (p.r * 0.85);
        ctx.fillStyle = "rgba(96,165,250,0.7)";
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        const n2 = nodes[(i + 4) % nodes.length];
        const x = cx + Math.cos(n.a + t * 0.7) * n.r;
        const y = cy + Math.sin(n.a + t * 0.7) * n.r * 0.9;
        const x2 = cx + Math.cos(n2.a + t * 0.7) * n2.r;
        const y2 = cy + Math.sin(n2.a + t * 0.7) * n2.r * 0.9;
        ctx.strokeStyle = "rgba(59,130,246,0.22)";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(59,130,246,0.35)";
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 18, t, t + Math.PI * 1.2);
      ctx.stroke();
    }

    if (state === "searching" || state === "researching") {
      for (let i = 0; i < 4; i += 1) {
        const pulse = (t * 0.65 + i * 0.22) % 1;
        ctx.strokeStyle = `rgba(59,130,246,${0.28 - pulse * 0.28})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 40 + pulse * 95, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < nodes.length; i += 1) {
        const on = Math.sin(t * 3 + i) > 0.2;
        if (!on) continue;
        const a = nodes[i].a + t * 0.2;
        ctx.fillStyle = "rgba(96,165,250,0.8)";
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 72, cy + Math.sin(a) * 66, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (state === "writing" || state === "generating") {
      for (let i = 0; i < 18; i += 1) {
        const a = t * 1.4 + i * 0.35;
        const r0 = 20;
        const r1 = 100 + (i % 5) * 8;
        ctx.strokeStyle = "rgba(148,163,184,0.28)";
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.stroke();
      }
    }

    if (state === "speaking") {
      for (let i = 0; i < 3; i += 1) {
        const pulse = (t * 1.15 + i * 0.24) % 1;
        ctx.strokeStyle = `rgba(16,185,129,${0.28 - pulse * 0.28})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 34 + pulse * (70 + level * 20), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (state === "planning" || state === "executing") {
      ctx.strokeStyle = "rgba(59,130,246,0.4)";
      ctx.beginPath();
      ctx.arc(cx, cy, 58, -Math.PI / 2, -Math.PI / 2 + ((t * 0.8) % 1) * Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5 + level * 1.5, 0, Math.PI * 2);
    ctx.fill();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  return { setState, setLevel };
}
