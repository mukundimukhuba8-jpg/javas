import { WORLD_LINKS, WORLD_NODES } from "./data.js";

const GROUP_COLOR = {
  core: "#22d3ee",
  data: "#60a5fa",
  flow: "#a855f7",
  project: "#f0abfc",
  agent: "#38bdf8",
  doc: "#93c5fd",
  integration: "#c084fc",
  automation: "#67e8f9",
};

/**
 * Floating neural world graph with gentle 3D projection.
 */
export function createWorld(canvas, { onSelect }) {
  const ctx = canvas.getContext("2d");
  let w = 0;
  let h = 0;
  let rotY = 0.4;
  let rotX = 0.25;
  let auto = true;
  let hover = null;
  let selected = null;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const nodes = WORLD_NODES.map((node, i) => {
    const a = (i / WORLD_NODES.length) * Math.PI * 2;
    const r = 140 + (i % 5) * 28;
    return {
      ...node,
      x: Math.cos(a) * r,
      y: Math.sin(a * 1.4) * 50,
      z: Math.sin(a) * r,
      phase: Math.random() * Math.PI * 2,
    };
  });

  const idIndex = Object.fromEntries(nodes.map((n, i) => [n.id, i]));
  const links = WORLD_LINKS.map(([a, b]) => [idIndex[a], idIndex[b]]).filter(
    ([a, b]) => a !== undefined && b !== undefined,
  );

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = Math.max(1, Math.floor(w * devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(h * devicePixelRatio));
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function project(node, t) {
    const yWave = Math.sin(t / 900 + node.phase) * 10;
    let x = node.x;
    let y = node.y + yWave;
    let z = node.z;

    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);

    const xz = x * cosY - z * sinY;
    const zz = z * cosY + x * sinY;
    const yz = y * cosX - zz * sinX;
    const z2 = zz * cosX + y * sinX;

    const perspective = 520 / (520 + z2);
    return {
      x: w / 2 + xz * perspective,
      y: h / 2 + yz * perspective,
      s: perspective,
      z: z2,
    };
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, Math.max(w, h) * 0.45);
    glow.addColorStop(0, "rgba(59,130,255,0.12)");
    glow.addColorStop(0.5, "rgba(168,85,247,0.06)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    const projected = nodes.map((n) => ({ node: n, p: project(n, t) }));

    for (const [a, b] of links) {
      const pa = projected[a]?.p;
      const pb = projected[b]?.p;
      if (!pa || !pb) continue;
      const alpha = 0.15 + ((pa.s + pb.s) / 2) * 0.25;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = `rgba(34,211,238,${alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const sorted = [...projected].sort((a, b) => a.p.z - b.p.z);
    for (const { node, p } of sorted) {
      const color = GROUP_COLOR[node.group] || "#22d3ee";
      const radius = 4 + p.s * 7;
      const isHot = hover === node.id || selected === node.id;

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * (isHot ? 1.35 : 1), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = isHot ? 24 : 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.font = `${isHot ? 14 : 12}px Rajdhani, sans-serif`;
      ctx.fillStyle = isHot ? "#fff" : "rgba(248,251,255,0.75)";
      ctx.textAlign = "center";
      ctx.fillText(node.label, p.x, p.y - radius - 8);
    }
  }

  function pick(x, y) {
    let best = null;
    let bestDist = 22;
    const t = performance.now();
    for (const node of nodes) {
      const p = project(node, t);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) {
        best = node;
        bestDist = d;
      }
    }
    return best;
  }

  function frame(t) {
    if (auto) rotY += 0.0035;
    draw(t);
    requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    auto = false;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointerup", () => {
    dragging = false;
  });
  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const node = pick(x, y);
    hover = node?.id ?? null;
    canvas.style.cursor = node ? "pointer" : dragging ? "grabbing" : "grab";
    if (dragging) {
      rotY += (e.clientX - lastX) * 0.005;
      rotX += (e.clientY - lastY) * 0.004;
      rotX = Math.max(-0.9, Math.min(0.9, rotX));
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const node = pick(e.clientX - rect.left, e.clientY - rect.top);
    if (!node) return;
    selected = node.id;
    onSelect?.(node);
  });

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);

  return {
    select(id) {
      selected = id;
      const node = nodes.find((n) => n.id === id);
      if (node) onSelect?.(node);
    },
  };
}
