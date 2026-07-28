/** Ambient neural field + star dust — slow, premium, never noisy. */
export function createBackground(canvas) {
  const ctx = canvas.getContext("2d");
  const stars = Array.from({ length: 70 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.random(),
    s: 0.00015 + Math.random() * 0.00035,
  }));
  const nodes = Array.from({ length: 26 }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.00012,
    vy: (Math.random() - 0.5) * 0.00012,
  }));
  let energy = 0;

  function resize() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function setEnergy(v) {
    energy = Math.max(0, Math.min(1, v));
  }

  function frame() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    const wash = ctx.createRadialGradient(w * 0.5, h * 0.2, 20, w * 0.5, h * 0.35, w * 0.7);
    wash.addColorStop(0, `rgba(59,130,246,${0.05 + energy * 0.04})`);
    wash.addColorStop(1, "rgba(11,15,20,0)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    for (const star of stars) {
      star.y += star.s;
      if (star.y > 1) star.y = 0;
      ctx.fillStyle = `rgba(255,255,255,${0.15 + star.z * 0.35})`;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, 0.6 + star.z * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const n of nodes) {
      n.x += n.vx * (1 + energy * 2);
      n.y += n.vy * (1 + energy * 2);
      if (n.x < 0 || n.x > 1) n.vx *= -1;
      if (n.y < 0 || n.y > 1) n.vy *= -1;
    }

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = (a.x - b.x) * w;
        const dy = (a.y - b.y) * h;
        const dist = Math.hypot(dx, dy);
        if (dist < 140) {
          ctx.strokeStyle = `rgba(59,130,246,${(0.08 + energy * 0.08) * (1 - dist / 140)})`;
          ctx.beginPath();
          ctx.moveTo(a.x * w, a.y * h);
          ctx.lineTo(b.x * w, b.y * h);
          ctx.stroke();
        }
      }
    }

    for (const n of nodes) {
      ctx.fillStyle = `rgba(148,163,184,${0.35 + energy * 0.25})`;
      ctx.beginPath();
      ctx.arc(n.x * w, n.y * h, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
  return { setEnergy };
}
