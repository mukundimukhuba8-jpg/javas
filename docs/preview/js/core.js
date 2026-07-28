/**
 * Holographic AI Core — cyan singularity, rings, particles, state-reactive.
 */
export function createIntelligenceCore(canvas) {
  const ctx = canvas.getContext("2d");
  let state = "idle";
  let level = 0;
  let pulse = 0;
  let t0 = performance.now();
  let speechPhase = 0;

  const particles = Array.from({ length: 64 }, (_, i) => ({
    a: (i / 64) * Math.PI * 2,
    r: 70 + (i % 8) * 10,
    s: 0.004 + (i % 5) * 0.0015,
    size: 1 + (i % 4) * 0.45,
    z: Math.random(),
  }));

  const nodes = Array.from({ length: 18 }, (_, i) => ({
    a: (i / 18) * Math.PI * 2,
    r: 110 + (i % 3) * 8,
  }));

  const sparks = [];

  function setState(next) {
    state = String(next || "idle").toLowerCase();
    t0 = performance.now();
  }

  function setLevel(v) {
    const target = Math.max(0, Math.min(1, v));
    level += (target - level) * 0.45;
  }

  function burst(intensity = 1) {
    pulse = Math.min(1.5, pulse + intensity);
    for (let i = 0; i < 12; i += 1) {
      sparks.push({
        a: Math.random() * Math.PI * 2,
        r: 40,
        v: 2 + Math.random() * 4,
        life: 1,
      });
    }
  }

  function setSpeech(phase) {
    speechPhase = phase;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const size = Math.max(320, Math.floor(rect.width || 420));
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(now) {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 420;
    const h = rect.height || 420;
    const cx = w / 2;
    const cy = h / 2 - h * 0.02;
    const t = (now - t0) / 1000;
    pulse *= 0.92;

    ctx.clearRect(0, 0, w, h);

    const breath = 0.5 + Math.sin(now / 1200) * 0.5;
    const listening = state === "listening";
    const thinking = state === "thinking" || state === "planning" || state === "searching";
    const speaking = state === "speaking";
    const weather = state === "weather";

    const baseR =
      Math.min(w, h) * 0.22 +
      (listening || speaking ? level * 22 : breath * 6) +
      pulse * 18;

    // Depth glow
    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, baseR + 90);
    const gA =
      0.18 +
      breath * 0.08 +
      level * 0.35 +
      pulse * 0.25 +
      (thinking ? 0.1 : 0);
    glow.addColorStop(0, `rgba(255,255,255,${0.55 + level * 0.3})`);
    glow.addColorStop(0.15, `rgba(0,209,255,${gA})`);
    glow.addColorStop(0.55, `rgba(59,130,246,${gA * 0.35})`);
    glow.addColorStop(1, "rgba(2,6,23,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR + 90, 0, Math.PI * 2);
    ctx.fill();

    // Orbit rings
    for (let i = 0; i < 4; i += 1) {
      const rr = baseR + 18 + i * 16;
      const spin = t * (0.4 + i * 0.15) * (thinking ? 2.4 : 1);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spin + i);
      ctx.scale(1, 0.42 + i * 0.04);
      ctx.strokeStyle = `rgba(0,209,255,${0.18 + i * 0.05 + level * 0.15})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.stroke();
      // arc highlights
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + level * 0.3})`;
      ctx.beginPath();
      ctx.arc(0, 0, rr, spin, spin + 1.1);
      ctx.stroke();
      ctx.restore();
    }

    // Core sphere
    const sphere = ctx.createRadialGradient(cx - 10, cy - 14, 4, cx, cy, baseR);
    if (weather) {
      sphere.addColorStop(0, "rgba(255,247,194,0.95)");
      sphere.addColorStop(0.35, "rgba(0,209,255,0.55)");
      sphere.addColorStop(1, "rgba(2,20,40,0.2)");
    } else {
      sphere.addColorStop(0, "rgba(255,255,255,0.95)");
      sphere.addColorStop(0.2, `rgba(0,209,255,${0.75 + level * 0.2})`);
      sphere.addColorStop(0.65, "rgba(14,60,120,0.55)");
      sphere.addColorStop(1, "rgba(2,10,24,0.15)");
    }
    ctx.fillStyle = sphere;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(0,209,255,${0.45 + level * 0.4})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Particles
    const speed = thinking ? 3.2 : listening ? 1.6 + level * 2 : speaking ? 1.8 : 1;
    for (const p of particles) {
      p.a += p.s * speed;
      const wobble = Math.sin(now / 400 + p.a) * (listening ? 8 + level * 20 : 3);
      const x = cx + Math.cos(p.a) * (p.r + wobble);
      const y = cy + Math.sin(p.a * 1.05) * (p.r * 0.72 + wobble * 0.4);
      ctx.fillStyle = `rgba(0,209,255,${0.25 + p.z * 0.55 + level * 0.3})`;
      ctx.beginPath();
      ctx.arc(x, y, p.size * (0.8 + level * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }

    // Listening waveform wrap
    if (listening) {
      ctx.beginPath();
      for (let i = 0; i <= 96; i += 1) {
        const a = (i / 96) * Math.PI * 2;
        const amp = 6 + level * 34 + Math.sin(now / 60 + i * 0.45) * (4 + level * 10);
        const rr = baseR + 10 + amp;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr * 0.92;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(0,209,255,${0.4 + level * 0.5})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(0,209,255,0.8)";
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Neural connections + sparks while thinking
    if (thinking) {
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        const n2 = nodes[(i + 5) % nodes.length];
        const a1 = n.a + t * 0.9;
        const a2 = n2.a + t * 0.9;
        const x = cx + Math.cos(a1) * n.r;
        const y = cy + Math.sin(a1) * n.r * 0.78;
        const x2 = cx + Math.cos(a2) * n2.r;
        const y2 = cy + Math.sin(a2) * n2.r * 0.78;
        ctx.strokeStyle = `rgba(0,209,255,${0.15 + (Math.sin(t * 4 + i) * 0.5 + 0.5) * 0.25})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (Math.random() < 0.04) {
          sparks.push({
            a: a1,
            r: n.r * 0.5,
            v: 1.5,
            life: 1,
            x,
            y,
            tx: x2,
            ty: y2,
          });
        }
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      // energy pulses
      for (let i = 0; i < 3; i += 1) {
        const pulseR = ((t * 0.8 + i * 0.33) % 1) * (baseR + 70);
        ctx.strokeStyle = `rgba(0,209,255,${0.35 * (1 - pulseR / (baseR + 70))})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 20 + pulseR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (speaking) {
      const phase = speechPhase || level;
      for (let i = 0; i < 4; i += 1) {
        const p = (t * 1.2 + i * 0.22 + phase * 0.2) % 1;
        ctx.strokeStyle = `rgba(0,209,255,${0.4 - p * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, baseR + 8 + p * (50 + phase * 30), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      for (let i = 0; i <= 64; i += 1) {
        const a = (i / 64) * Math.PI * 2;
        const amp = 4 + phase * 18 + Math.sin(now / 50 + i) * 6;
        const rr = baseR + amp;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + phase * 0.4})`;
      ctx.stroke();
    }

    // Sparks
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i];
      s.life -= 0.03;
      if (s.tx != null) {
        const k = 1 - s.life;
        const x = s.x + (s.tx - s.x) * k;
        const y = s.y + (s.ty - s.y) * k;
        ctx.fillStyle = `rgba(255,180,80,${s.life})`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        s.r += s.v;
        const x = cx + Math.cos(s.a) * s.r;
        const y = cy + Math.sin(s.a) * s.r * 0.75;
        ctx.fillStyle = `rgba(0,209,255,${s.life})`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (s.life <= 0) sparks.splice(i, 1);
    }

    // Singularity
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,209,255,0.9)";
    ctx.shadowBlur = 18 + level * 20;
    ctx.beginPath();
    ctx.arc(cx, cy, 4 + level * 3 + pulse * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
  return { setState, setLevel, burst, setSpeech, resize };
}
