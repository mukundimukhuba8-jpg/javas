/**
 * Cloudy — wake word + clap activation system (browser preview)
 * States: boot → idle → waking → listening ⇄ speaking
 */

const WAKE_PHRASES = ["hey cloudy", "hello cloudy", "hi cloudy", "okay cloudy"];
const WAKE_DURATION_MS = 1800;

/** @typedef {'boot'|'idle'|'waking'|'listening'|'speaking'} AppState */

const els = {
  body: document.body,
  gate: /** @type {HTMLElement} */ (document.getElementById("gate")),
  gateNote: /** @type {HTMLElement} */ (document.getElementById("gateNote")),
  enableBtn: /** @type {HTMLButtonElement} */ (document.getElementById("enableBtn")),
  stage: /** @type {HTMLElement} */ (document.getElementById("stage")),
  orb: /** @type {HTMLElement} */ (document.getElementById("orb")),
  modeChip: /** @type {HTMLElement} */ (document.getElementById("modeChip")),
  micLevelLabel: /** @type {HTMLElement} */ (document.getElementById("micLevelLabel")),
  activityLog: /** @type {HTMLElement} */ (document.getElementById("activityLog")),
  transcript: /** @type {HTMLElement} */ (document.getElementById("transcript")),
  fx: /** @type {HTMLCanvasElement} */ (document.getElementById("fx")),
  wave: /** @type {HTMLCanvasElement} */ (document.getElementById("wave")),
  neural: /** @type {SVGSVGElement} */ (document.getElementById("neural")),
  bloom: /** @type {HTMLElement} */ (document.getElementById("bloom")),
};

const fxCtx = els.fx.getContext("2d");
const waveCtx = els.wave.getContext("2d");

/** @type {AppState} */
let state = "boot";
let audioCtx = /** @type {AudioContext | null} */ (null);
let analyser = /** @type {AnalyserNode | null} */ (null);
let micStream = /** @type {MediaStream | null} */ (null);
let freqData = /** @type {Uint8Array | null} */ (null);
let timeData = /** @type {Uint8Array | null} */ (null);
let micLevel = 0;
let recognition = /** @type {SpeechRecognition | null} */ (null);
let wakeLock = false;
let lastClapAt = 0;
let clapCount = 0;
let particleBurst = 0;
let energyWave = 0;

/** @type {{x:number,y:number,vx:number,vy:number,life:number,hue:number,size:number}[]} */
let particles = [];
/** @type {{x:number,y:number,phase:number}[]} */
let idleSparks = [];

const nodes = /** @type {{id:number,x:number,y:number,r:number,pulse:number}[]} */ ([]);
const links = /** @type {{a:number,b:number,t:number}[]} */ ([]);

function setState(next) {
  state = next;
  els.body.dataset.state = next;
  const labels = {
    boot: "BOOT",
    idle: "SLEEP",
    waking: "WAKE",
    listening: "LISTEN",
    speaking: "SPEAK",
  };
  els.modeChip.textContent = labels[next];
}

function logActivity(text) {
  const li = document.createElement("li");
  li.textContent = text;
  els.activityLog.prepend(li);
  while (els.activityLog.children.length > 6) {
    els.activityLog.lastElementChild?.remove();
  }
}

function resize() {
  els.fx.width = window.innerWidth * devicePixelRatio;
  els.fx.height = window.innerHeight * devicePixelRatio;
  els.fx.style.width = `${window.innerWidth}px`;
  els.fx.style.height = `${window.innerHeight}px`;
  fxCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

function buildNeuralGraph() {
  nodes.length = 0;
  links.length = 0;
  const cx = 500;
  const cy = 300;
  nodes.push({ id: 0, x: cx, y: cy, r: 5, pulse: 0 });

  let id = 1;
  for (let ring = 1; ring <= 4; ring += 1) {
    const count = 6 + ring * 4;
    const radius = 55 + ring * 58;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + ring * 0.35;
      const x = cx + Math.cos(angle) * radius * (0.85 + Math.random() * 0.3);
      const y = cy + Math.sin(angle) * radius * 0.62 * (0.85 + Math.random() * 0.3);
      nodes.push({ id, x, y, r: 2 + Math.random() * 2.5, pulse: Math.random() });
      const parent = Math.max(0, id - Math.floor(count / 2) - 1);
      links.push({ a: parent % id, b: id, t: 0 });
      if (Math.random() > 0.55 && id > 2) {
        links.push({ a: id - 1, b: id, t: 0 });
      }
      id += 1;
    }
  }

  const ns = "http://www.w3.org/2000/svg";
  els.neural.innerHTML = "";
  const defs = document.createElementNS(ns, "defs");
  defs.innerHTML = `
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>`;
  els.neural.appendChild(defs);

  for (const link of links) {
    const line = document.createElementNS(ns, "path");
    const a = nodes[link.a];
    const b = nodes[link.b];
    if (!a || !b) continue;
    line.setAttribute("class", "link");
    line.setAttribute("d", `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 20} ${b.x} ${b.y}`);
    line.dataset.length = String(line.getTotalLength?.() ?? 120);
    els.neural.appendChild(line);
  }
  for (const node of nodes) {
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("class", "node");
    circle.setAttribute("cx", String(node.x));
    circle.setAttribute("cy", String(node.y));
    circle.setAttribute("r", String(node.r));
    els.neural.appendChild(circle);
  }
}

function animateNeural(progress, speaking) {
  const linkEls = [...els.neural.querySelectorAll(".link")];
  const nodeEls = [...els.neural.querySelectorAll(".node")];
  linkEls.forEach((el, i) => {
    const len = Number(el.getAttribute("data-length") || 140);
    const local = Math.max(0, Math.min(1, progress * 1.4 - i * 0.01));
    el.style.opacity = String(0.15 + local * (speaking ? 0.8 : 0.45));
    el.style.stroke =
      speaking && i % 3 === 0 ? "rgba(168,85,247,0.85)" : "rgba(34,211,238,0.55)";
    el.style.strokeDasharray = `${len * local} ${len}`;
    if (speaking) {
      el.style.strokeWidth = String(1.2 + Math.sin(performance.now() / 180 + i) * 0.8);
    }
  });
  nodeEls.forEach((el, i) => {
    const node = nodes[i];
    if (!node) return;
    const local = Math.max(0, Math.min(1, progress * 1.5 - i * 0.008));
    el.style.opacity = String(local);
    const pulse = speaking ? 1 + Math.sin(performance.now() / 140 + node.pulse * 8) * 0.55 : 1;
    el.setAttribute("r", String(node.r * pulse * (0.6 + local * 0.6)));
    el.setAttribute("fill", speaking && i % 4 === 0 ? "#c084fc" : i === 0 ? "#fff" : "#22d3ee");
  });
}

function seedIdleSparks() {
  idleSparks = Array.from({ length: 48 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    phase: Math.random() * Math.PI * 2,
  }));
}

function spawnBurst(count = 900) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * 7.5;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.6 + Math.random() * 1.2,
      hue: Math.random() > 0.5 ? 200 + Math.random() * 40 : 270 + Math.random() * 40,
      size: 0.6 + Math.random() * 2.2,
    });
  }
  particleBurst = 1;
  energyWave = 1;
}

function playStartupSound() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const master = audioCtx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.22, now + 0.05);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
  master.connect(audioCtx.destination);

  const freqs = [180, 360, 540, 920, 1400];
  freqs.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = i % 2 === 0 ? "sine" : "triangle";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.8, now + 0.35 + i * 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2 / (i + 1), now + 0.04 + i * 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1 + i * 0.08);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 1.6);
  });

  const noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.35, audioCtx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const noise = audioCtx.createBufferSource();
  const noiseGain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1800;
  noise.buffer = noiseBuf;
  noiseGain.gain.value = 0.08;
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(now + 0.05);
}

function stopSpeechRecognition() {
  if (!recognition) return;
  try {
    recognition.onend = null;
    recognition.stop();
  } catch {
    /* ignore */
  }
}

function speakGreeting() {
  const text = "Hello. Cloudy online. How can I help you today?";
  els.transcript.textContent = text;
  logActivity("Greeting · TTS");
  setState("speaking");
  stopSpeechRecognition();

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.95;
  utter.pitch = 1;
  utter.volume = 1;
  const voices = speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => /en(-|_)GB/i.test(v.lang) && /female|samantha|google/i.test(v.name)) ||
    voices.find((v) => /en(-|_)GB/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang));
  if (preferred) utter.voice = preferred;

  utter.onend = () => {
    setState("listening");
    els.transcript.textContent = "Listening…";
    startSpeechRecognition();
  };
  utter.onerror = () => {
    setState("listening");
    els.transcript.textContent = "Listening…";
    startSpeechRecognition();
  };

  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

async function wake(reason) {
  if (state !== "idle" || wakeLock) return;
  wakeLock = true;
  logActivity(`Wake · ${reason}`);
  setState("waking");
  playStartupSound();
  spawnBurst(1200);
  els.transcript.textContent = "";

  const start = performance.now();
  const tick = () => {
    const t = (performance.now() - start) / WAKE_DURATION_MS;
    animateNeural(Math.min(1, t), false);
    if (t < 1) {
      requestAnimationFrame(tick);
      return;
    }
    wakeLock = false;
    speakGreeting();
  };
  requestAnimationFrame(tick);
}

function normalizeTranscript(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsWakePhrase(text) {
  const n = normalizeTranscript(text);
  return WAKE_PHRASES.some((p) => n.includes(p));
}

function startSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    logActivity("SpeechRecognition unavailable · clap still works");
    return;
  }
  if (recognition) {
    try {
      recognition.stop();
    } catch {
      /* ignore */
    }
  }
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    let interim = "";
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) finalText += result[0]?.transcript ?? "";
      else interim += result[0]?.transcript ?? "";
    }
    const heard = finalText || interim;
    if (heard) els.transcript.textContent = heard;

    if (state === "idle" && containsWakePhrase(heard)) {
      void wake("Hey Cloudy");
      return;
    }

    if (state === "listening" && finalText) {
      logActivity(`Heard · ${finalText.trim()}`);
    }
  };

  recognition.onerror = () => {
    // Restart lightly; common on no-speech
    if (state === "idle" || state === "listening") {
      setTimeout(() => {
        try {
          recognition?.start();
        } catch {
          /* already started */
        }
      }, 400);
    }
  };

  recognition.onend = () => {
    if (state === "idle" || state === "listening") {
      try {
        recognition?.start();
      } catch {
        /* ignore */
      }
    }
  };

  try {
    recognition.start();
  } catch {
    /* ignore */
  }
}

function detectClap(energy, transient) {
  if (state !== "idle") return;
  const now = performance.now();
  // Clap = sharp transient + decent broadband energy
  if (transient > 0.42 && energy > 0.28) {
    if (now - lastClapAt < 450) {
      clapCount += 1;
    } else {
      clapCount = 1;
    }
    lastClapAt = now;
    if (clapCount >= 1) {
      const kind = clapCount >= 2 ? "Double clap" : "Clap";
      // Debounce wake a touch so double registers cleanly
      window.setTimeout(() => {
        if (state === "idle" && performance.now() - lastClapAt < 500) {
          void wake(kind);
        }
      }, clapCount >= 2 ? 0 : 280);
    }
  }
}

async function enableAudio() {
  els.gateNote.textContent = "";
  try {
    audioCtx = new AudioContext();
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    const source = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);

    els.gate.hidden = true;
    els.stage.hidden = false;
    setState("idle");
    seedIdleSparks();
    buildNeuralGraph();
    startSpeechRecognition();
    logActivity("Idle · sensors armed");
    requestAnimationFrame(frame);
  } catch (error) {
    els.gateNote.textContent =
      error instanceof Error ? error.message : "Microphone permission is required.";
  }
}

let prevEnergy = 0;

function sampleMic() {
  if (!analyser || !freqData || !timeData) return { energy: 0, transient: 0 };
  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  let sum = 0;
  let high = 0;
  const midStart = Math.floor(freqData.length * 0.08);
  const midEnd = Math.floor(freqData.length * 0.45);
  for (let i = midStart; i < midEnd; i += 1) {
    sum += freqData[i] ?? 0;
    if ((freqData[i] ?? 0) > 180) high += 1;
  }
  const energy = Math.min(1, sum / ((midEnd - midStart) * 255) * 3.2);
  const transient = Math.max(0, energy - prevEnergy) * 8 + high / (midEnd - midStart);
  prevEnergy = energy * 0.65 + prevEnergy * 0.35;
  micLevel = energy;
  return { energy, transient: Math.min(1, transient) };
}

function drawWaveform() {
  const w = els.wave.width;
  const h = els.wave.height;
  waveCtx.clearRect(0, 0, w, h);
  if (state === "idle") return;

  waveCtx.beginPath();
  const amp = state === "speaking" ? 0.55 : 0.2 + micLevel * 0.8;
  for (let x = 0; x < w; x += 1) {
    const y =
      h / 2 +
      Math.sin(x * 0.045 + performance.now() / 160) * 10 * amp +
      Math.sin(x * 0.12 + performance.now() / 90) * 6 * amp;
    if (x === 0) waveCtx.moveTo(x, y);
    else waveCtx.lineTo(x, y);
  }
  const grad = waveCtx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "rgba(59,130,255,0.1)");
  grad.addColorStop(0.5, "rgba(34,211,238,0.95)");
  grad.addColorStop(1, "rgba(168,85,247,0.2)");
  waveCtx.strokeStyle = grad;
  waveCtx.lineWidth = 2;
  waveCtx.stroke();
}

function drawFx() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  fxCtx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;

  // Soft bloom discs (post-process stand-in)
  if (state !== "idle") {
    const g = fxCtx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(w, h) * 0.55);
    g.addColorStop(0, `rgba(255,255,255,${0.08 + micLevel * 0.08})`);
    g.addColorStop(0.2, `rgba(34,211,238,${0.12 + energyWave * 0.15})`);
    g.addColorStop(0.45, `rgba(59,130,255,${0.1 + energyWave * 0.12})`);
    g.addColorStop(0.7, `rgba(168,85,247,${0.08 + energyWave * 0.1})`);
    g.addColorStop(1, "rgba(2,4,10,0)");
    fxCtx.fillStyle = g;
    fxCtx.fillRect(0, 0, w, h);
  }

  if (energyWave > 0.01) {
    for (let i = 0; i < 4; i += 1) {
      const r = (1 - energyWave) * 40 + i * 70 + energyWave * Math.min(w, h) * 0.45;
      fxCtx.beginPath();
      fxCtx.arc(cx, cy, r, 0, Math.PI * 2);
      fxCtx.strokeStyle = `rgba(${i % 2 ? "168,85,247" : "59,130,255"},${energyWave * 0.35})`;
      fxCtx.lineWidth = 2;
      fxCtx.stroke();
    }
    energyWave *= 0.965;
  }

  if (state === "idle") {
    for (const spark of idleSparks) {
      spark.phase += 0.01;
      const x = spark.x + Math.sin(spark.phase) * 8;
      const y = spark.y + Math.cos(spark.phase * 0.8) * 6;
      fxCtx.fillStyle = `rgba(34,211,238,${0.12 + Math.sin(spark.phase) * 0.08})`;
      fxCtx.beginPath();
      fxCtx.arc(x, y, 1.2, 0, Math.PI * 2);
      fxCtx.fill();
    }
  }

  // Attract particles toward center while listening
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    if (!p) continue;
    if (state === "listening") {
      p.vx += (cx - p.x) * 0.0008;
      p.vy += (cy - p.y) * 0.0008;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.99;
    p.vy *= 0.99;
    p.life -= 0.01;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    fxCtx.fillStyle = `hsla(${p.hue}, 95%, 70%, ${Math.min(1, p.life)})`;
    fxCtx.beginPath();
    fxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    fxCtx.fill();
  }

  if (state === "listening" && micLevel > 0.04) {
    // Continuous soft sparks near orb
    if (Math.random() < micLevel) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 90;
      particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: Math.cos(angle + Math.PI) * (0.4 + micLevel),
        vy: Math.sin(angle + Math.PI) * (0.4 + micLevel),
        life: 0.5,
        hue: 190 + Math.random() * 40,
        size: 1,
      });
    }
  }

  particleBurst *= 0.98;
}

function updateOrbFromMic() {
  if (state !== "listening") return;
  const scale = 1.7 + micLevel * 0.9;
  els.orb.style.transform = `scale(${scale})`;
  els.bloom.style.opacity = String(0.75 + micLevel * 0.35);
  els.micLevelLabel.textContent = `Mic energy · ${Math.round(micLevel * 100)}%`;
}

function frame() {
  const { energy, transient } = sampleMic();
  detectClap(energy, transient);
  updateOrbFromMic();
  drawFx();
  drawWaveform();

  if (state === "speaking") {
    animateNeural(1, true);
  } else if (state === "listening") {
    animateNeural(1, false);
  }

  requestAnimationFrame(frame);
}

els.enableBtn.addEventListener("click", () => {
  void enableAudio();
});

window.addEventListener("resize", () => {
  resize();
  seedIdleSparks();
});

window.addEventListener("keydown", (event) => {
  // Dev helpers
  if (event.key === "w" && state === "idle") void wake("Manual");
  if (event.key === "c" && state === "idle") void wake("Clap");
});

// Some browsers populate voices async
speechSynthesis?.addEventListener?.("voiceschanged", () => {
  /* voices ready */
});

resize();
setState("boot");
