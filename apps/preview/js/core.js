/**
 * Live intelligence core — subtle state-driven animation (no neon spectacle).
 */
export function createIntelligenceCore(canvas) {
  const ctx = canvas.getContext("2d");
  let state = "idle";
  let t0 = performance.now();
  const particles = Array.from({ length: 28 }, (_, i) => ({
    a: (i / 28) * Math.PI * 2,
    r: 48 + (i % 5) * 8,
    s: 0.004 + (i % 4) * 0.0015,
  }));

  const nodes = Array.from({ length: 12 }, (_, i) => ({
    a: (i / 12) * Math.PI * 2,
    r: 70,
  }));

  function setState(next) {
    state = String(next || "idle").toLowerCase();
    t0 = performance.now();
  }

  function frame(now) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);

    // Soft glass disc
    const g = ctx.createRadialGradient(cx, cy - 10, 10, cx, cy, 140);
    g.addColorStop(0, "rgba(59,130,246,0.10)");
    g.addColorStop(1, "rgba(18,24,34,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 132, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(148,163,184,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 108, 0, Math.PI * 2);
    ctx.stroke();

    if (state === "idle" || state === "finished") {
      for (const p of particles) {
        p.a += p.s * (state === "finished" ? 0.6 : 1);
        const x = cx + Math.cos(p.a) * p.r;
        const y = cy + Math.sin(p.a) * p.r * 0.92;
        ctx.fillStyle = "rgba(148,163,184,0.55)";
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (state === "thinking" || state === "learning" || state === "reasoning") {
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        n.a += 0.003;
        const x = cx + Math.cos(n.a + t * 0.2) * n.r;
        const y = cy + Math.sin(n.a + t * 0.2) * n.r * 0.9;
        const n2 = nodes[(i + 3) % nodes.length];
        const x2 = cx + Math.cos(n2.a + t * 0.2) * n2.r;
        const y2 = cy + Math.sin(n2.a + t * 0.2) * n2.r * 0.9;
        ctx.strokeStyle = "rgba(59,130,246,0.22)";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.fillStyle = "rgba(59,130,246,0.7)";
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (state === "searching" || state === "researching" || state === "planning") {
      for (let i = 0; i < 3; i += 1) {
        const pulse = ((t * 0.7 + i * 0.33) % 1);
        ctx.strokeStyle = `rgba(59,130,246,${0.28 - pulse * 0.28})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 40 + pulse * 80, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (state === "planning") {
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2 + t * 0.3;
          const r = 50 + (i % 3) * 16 + Math.sin(t + i) * 4;
          ctx.fillStyle = "rgba(148,163,184,0.5)";
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (state === "writing" || state === "generating") {
      const words = ["plan", "schema", "route", "view", "memory"];
      const word = words[Math.floor(t * 1.3) % words.length];
      ctx.fillStyle = `rgba(255,255,255,${0.25 + Math.sin(t * 4) * 0.15})`;
      ctx.font = "500 14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(word, cx, cy - 8);
    }

    if (state === "coding") {
      const symbols = ["{}", "=>", "[]", "fn", "<>"];
      for (let i = 0; i < symbols.length; i += 1) {
        const a = t * 0.8 + i;
        ctx.fillStyle = "rgba(148,163,184,0.55)";
        ctx.font = "500 12px ui-monospace, monospace";
        ctx.fillText(
          symbols[i],
          cx + Math.cos(a) * 62,
          cy + Math.sin(a) * 50,
        );
      }
    }

    if (state === "listening") {
      for (let i = 0; i < 18; i += 1) {
        const x = cx - 70 + i * 8;
        const amp = 8 + Math.sin(t * 6 + i) * 10 + Math.sin(t * 3 + i * 0.4) * 6;
        ctx.strokeStyle = "rgba(59,130,246,0.55)";
        ctx.beginPath();
        ctx.moveTo(x, cy - amp);
        ctx.lineTo(x, cy + amp);
        ctx.stroke();
      }
    }

    if (state === "speaking") {
      for (let i = 0; i < 3; i += 1) {
        const pulse = ((t * 1.1 + i * 0.25) % 1);
        ctx.strokeStyle = `rgba(16,185,129,${0.3 - pulse * 0.3})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 36 + pulse * 70, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (state === "executing") {
      ctx.strokeStyle = "rgba(59,130,246,0.45)";
      ctx.beginPath();
      ctx.arc(cx, cy, 56, -Math.PI / 2, -Math.PI / 2 + (t % 1) * Math.PI * 2);
      ctx.stroke();
    }

    // Center point
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  return { setState };
}
