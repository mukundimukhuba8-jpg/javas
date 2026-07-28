/** Animated neural field, dust, light rays, parallax depth. */
export function createBackground(canvas) {
  const ctx = canvas.getContext("2d");
  let energy = 0;
  let weather = 0;
  let mx = 0.5;
  let my = 0.35;

  const stars = Array.from({ length: 110 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.random(),
    s: 0.00012 + Math.random() * 0.0004,
  }));

  const dust = Array.from({ length: 48 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.random(),
    s: 0.00008 + Math.random() * 0.0002,
  }));

  const nodes = Array.from({ length: 34 }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.00014,
    vy: (Math.random() - 0.5) * 0.00014,
  }));

  const rays = Array.from({ length: 6 }, (_, i) => ({
    a: (i / 6) * Math.PI * 2,
    w: 0.08 + Math.random() * 0.06,
  }));

  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setEnergy(v) {
    energy += (Math.max(0, Math.min(1, v)) - energy) * 0.35;
  }

  function setWeather(v) {
    weather += (Math.max(0, Math.min(1, v)) - weather) * 0.08;
  }

  function setParallax(x, y) {
    mx = x;
    my = y;
  }

  function frame(now) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const px = (mx - 0.5) * 24;
    const py = (my - 0.5) * 18;
    ctx.clearRect(0, 0, w, h);

    // Atmosphere
    const sky = ctx.createRadialGradient(
      w * 0.5 + px,
      h * 0.28 + py,
      20,
      w * 0.5,
      h * 0.4,
      w * 0.75,
    );
    sky.addColorStop(0, `rgba(0,209,255,${0.07 + energy * 0.08 + weather * 0.1})`);
    sky.addColorStop(0.45, `rgba(30,64,120,${0.12 + weather * 0.1})`);
    sky.addColorStop(1, "rgba(2,6,23,0)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Soft grid
    ctx.save();
    ctx.translate(px * 0.3, py * 0.3);
    ctx.strokeStyle = `rgba(0,209,255,${0.04 + energy * 0.04})`;
    ctx.lineWidth = 1;
    const step = 48;
    for (let x = -step; x < w + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h * 0.15, h);
      ctx.stroke();
    }
    for (let y = h * 0.45; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + 8);
      ctx.stroke();
    }
    ctx.restore();

    // Light rays
    ctx.save();
    ctx.translate(w * 0.5 + px * 0.5, h * 0.22 + py * 0.5);
    for (const ray of rays) {
      ray.a += 0.0004 + energy * 0.001;
      ctx.save();
      ctx.rotate(ray.a + now / 18000);
      const grad = ctx.createLinearGradient(0, 0, 0, h * 0.7);
      grad.addColorStop(0, `rgba(0,209,255,${0.05 + energy * 0.06})`);
      grad.addColorStop(1, "rgba(0,209,255,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-w * ray.w, h * 0.7);
      ctx.lineTo(w * ray.w, h * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    for (const star of stars) {
      star.y += star.s * (1 + energy);
      if (star.y > 1) star.y = 0;
      const x = star.x * w + px * star.z * 0.4;
      const y = star.y * h + py * star.z * 0.4;
      ctx.fillStyle = `rgba(255,255,255,${0.2 + star.z * 0.5 + energy * 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.6 + star.z * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const d of dust) {
      d.x += d.s * 0.4;
      d.y += d.s;
      if (d.y > 1) d.y = 0;
      if (d.x > 1) d.x = 0;
      ctx.fillStyle = `rgba(0,209,255,${0.08 + d.z * 0.2})`;
      ctx.beginPath();
      ctx.arc(d.x * w + px * 0.2, d.y * h, 1 + d.z, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const n of nodes) {
      n.x += n.vx * (1 + energy * 3);
      n.y += n.vy * (1 + energy * 3);
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
        if (dist < 150) {
          ctx.strokeStyle = `rgba(0,209,255,${(0.1 + energy * 0.12) * (1 - dist / 150)})`;
          ctx.beginPath();
          ctx.moveTo(a.x * w + px * 0.15, a.y * h + py * 0.15);
          ctx.lineTo(b.x * w + px * 0.15, b.y * h + py * 0.15);
          ctx.stroke();
        }
      }
    }

    for (const n of nodes) {
      ctx.fillStyle = `rgba(0,209,255,${0.45 + energy * 0.4})`;
      ctx.beginPath();
      ctx.arc(n.x * w + px * 0.15, n.y * h + py * 0.15, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  window.addEventListener(
    "pointermove",
    (e) => {
      setParallax(e.clientX / window.innerWidth, e.clientY / window.innerHeight);
    },
    { passive: true },
  );
  resize();
  requestAnimationFrame(frame);
  return { setEnergy, setWeather, setParallax };
}

/** Full-scene weather transform: atmosphere, earth, wind, rain cells. */
export function createWeatherScene(canvas) {
  const ctx = canvas.getContext("2d");
  let active = false;
  let zoom = 0;
  let t0 = 0;

  const clouds = Array.from({ length: 10 }, () => ({
    x: Math.random(),
    y: 0.2 + Math.random() * 0.35,
    s: 0.0003 + Math.random() * 0.0005,
    w: 0.12 + Math.random() * 0.18,
  }));

  const winds = Array.from({ length: 28 }, () => ({
    x: Math.random(),
    y: Math.random(),
    l: 0.04 + Math.random() * 0.08,
    s: 0.002 + Math.random() * 0.003,
  }));

  const rain = Array.from({ length: 40 }, () => ({
    x: Math.random(),
    y: Math.random(),
    s: 0.004 + Math.random() * 0.01,
  }));

  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function start() {
    active = true;
    zoom = 0;
    t0 = performance.now();
  }

  function stop() {
    active = false;
  }

  function frame(now) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    if (!active) {
      requestAnimationFrame(frame);
      return;
    }

    zoom = Math.min(1, (now - t0) / 2200);

    // Atmosphere wash
    const atm = ctx.createLinearGradient(0, 0, 0, h);
    atm.addColorStop(0, `rgba(8,40,80,${0.55 * zoom})`);
    atm.addColorStop(0.5, `rgba(12,70,110,${0.35 * zoom})`);
    atm.addColorStop(1, `rgba(2,10,24,${0.65 * zoom})`);
    ctx.fillStyle = atm;
    ctx.fillRect(0, 0, w, h);

    // Earth
    const ex = w * 0.5;
    const ey = h * (0.72 - zoom * 0.18);
    const er = (Math.min(w, h) * (0.22 + zoom * 0.28));
    const earth = ctx.createRadialGradient(ex - er * 0.2, ey - er * 0.25, er * 0.1, ex, ey, er);
    earth.addColorStop(0, "rgba(80,180,255,0.85)");
    earth.addColorStop(0.45, "rgba(20,90,140,0.8)");
    earth.addColorStop(0.75, "rgba(10,40,70,0.75)");
    earth.addColorStop(1, "rgba(2,8,20,0)");
    ctx.fillStyle = earth;
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();

    // Continents hint
    ctx.strokeStyle = `rgba(0,209,255,${0.25 * zoom})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.ellipse(
        ex + Math.cos(i + now / 4000) * er * 0.25,
        ey + Math.sin(i) * er * 0.2,
        er * (0.18 + i * 0.03),
        er * 0.1,
        i,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }

    // Target pip (user)
    const tx = ex + er * 0.18;
    const ty = ey - er * 0.12;
    ctx.fillStyle = "rgba(255,138,61,0.95)";
    ctx.shadowColor = "rgba(255,138,61,0.8)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(tx, ty, 4 + Math.sin(now / 200) * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255,138,61,${0.5 * (0.5 + Math.sin(now / 300) * 0.5)})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 12 + ((now / 400) % 20), 0, Math.PI * 2);
    ctx.stroke();

    // Clouds
    for (const c of clouds) {
      c.x += c.s;
      if (c.x > 1.2) c.x = -0.2;
      const cx = c.x * w;
      const cy = c.y * h * (1 - zoom * 0.15);
      ctx.fillStyle = `rgba(180,210,240,${0.12 * zoom})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * c.w, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Wind lines
    for (const wind of winds) {
      wind.x += wind.s;
      if (wind.x > 1.1) wind.x = -0.1;
      ctx.strokeStyle = `rgba(0,209,255,${0.2 * zoom})`;
      ctx.beginPath();
      ctx.moveTo(wind.x * w, wind.y * h);
      ctx.lineTo(wind.x * w + wind.l * w, wind.y * h + 4);
      ctx.stroke();
    }

    // Rain cells
    for (const r of rain) {
      r.y += r.s;
      if (r.y > 1) r.y = 0;
      ctx.strokeStyle = `rgba(140,200,255,${0.25 * zoom})`;
      ctx.beginPath();
      ctx.moveTo(r.x * w, r.y * h);
      ctx.lineTo(r.x * w - 2, r.y * h + 10);
      ctx.stroke();
    }

    // Temp overlay
    ctx.fillStyle = `rgba(248,251,255,${0.55 * zoom})`;
    ctx.font = "600 14px Rajdhani, sans-serif";
    ctx.fillText("18°C · Pretoria node", tx + 16, ty - 8);

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
  return { start, stop };
}
