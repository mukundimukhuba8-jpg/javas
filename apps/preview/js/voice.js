/**
 * Continuous mic analysis + optional SpeechRecognition transcript.
 * Every sample updates level with no artificial delay.
 */
export function createVoiceSensor({ onLevel, onClap, onTranscript, onSpeechEnd }) {
  /** @type {AudioContext | null} */
  let audioCtx = null;
  /** @type {AnalyserNode | null} */
  let analyser = null;
  /** @type {MediaStream | null} */
  let stream = null;
  let active = false;
  let prev = 0;
  let lastClap = 0;
  /** @type {Uint8Array | null} */
  let timeData = null;
  /** @type {Uint8Array | null} */
  let freqData = null;
  let raf = 0;
  /** @type {SpeechRecognition | null} */
  let recognition = null;
  let listeningSpeech = false;
  let interim = "";

  function sample() {
    if (!active || !analyser || !timeData || !freqData) return;
    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);

    let sum = 0;
    for (let i = 0; i < timeData.length; i += 1) {
      const v = ((timeData[i] ?? 128) - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / timeData.length);
    const energy = Math.min(1, rms * 7.2);
    const transient = Math.max(0, energy - prev) * 6;
    prev = energy * 0.4 + prev * 0.6;
    onLevel?.(energy, { timeData, freqData });

    const now = performance.now();
    if (transient > 0.2 && energy > 0.14 && now - lastClap > 200) {
      lastClap = now;
      onClap?.(Math.max(energy, 0.9));
    }

    raf = requestAnimationFrame(sample);
  }

  function ensureRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    if (recognition) return recognition;
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-GB";
    recognition.onresult = (event) => {
      let finalText = "";
      interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        const text = res[0]?.transcript || "";
        if (res.isFinal) finalText += text;
        else interim += text;
      }
      if (interim) onTranscript?.(interim, false);
      if (finalText.trim()) {
        onTranscript?.(finalText.trim(), true);
        onSpeechEnd?.(finalText.trim());
      }
    };
    recognition.onerror = () => {
      /* keep mic visual path alive even if STT fails */
    };
    recognition.onend = () => {
      if (listeningSpeech && active) {
        try {
          recognition.start();
        } catch {
          /* ignore restart races */
        }
      }
    };
    return recognition;
  }

  return {
    async start({ speech = true } = {}) {
      audioCtx = new AudioContext();
      if (audioCtx.state === "suspended") await audioCtx.resume();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.12;
      source.connect(analyser);
      timeData = new Uint8Array(analyser.fftSize);
      freqData = new Uint8Array(analyser.frequencyBinCount);
      active = true;
      raf = requestAnimationFrame(sample);

      if (speech) {
        const rec = ensureRecognition();
        if (rec) {
          listeningSpeech = true;
          try {
            rec.start();
          } catch {
            /* already started */
          }
        }
      }
    },
    stopSpeech() {
      listeningSpeech = false;
      try {
        recognition?.stop();
      } catch {
        /* ignore */
      }
    },
    startSpeech() {
      const rec = ensureRecognition();
      if (!rec) return false;
      listeningSpeech = true;
      try {
        rec.start();
        return true;
      } catch {
        return true;
      }
    },
    stop() {
      active = false;
      listeningSpeech = false;
      cancelAnimationFrame(raf);
      try {
        recognition?.stop();
      } catch {
        /* ignore */
      }
      stream?.getTracks().forEach((t) => t.stop());
      void audioCtx?.close();
      audioCtx = null;
      onLevel?.(0, null);
    },
    getTimeData() {
      return timeData;
    },
    getFreqData() {
      return freqData;
    },
    get active() {
      return active;
    },
    get supportsSpeech() {
      return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    },
  };
}

export function drawVoiceWave(canvas, timeData, energy = 0) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1);
  const cssW = canvas.clientWidth || 220;
  const cssH = canvas.clientHeight || 72;
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = "rgba(0,209,255,0.04)";
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.beginPath();
  const mid = cssH / 2;
  if (!timeData || !timeData.length) {
    ctx.strokeStyle = "rgba(0,209,255,0.35)";
    ctx.moveTo(0, mid);
    for (let x = 0; x < cssW; x += 4) {
      ctx.lineTo(x, mid + Math.sin(x / 18 + performance.now() / 400) * 3);
    }
    ctx.stroke();
    return;
  }

  ctx.strokeStyle = `rgba(0,209,255,${0.45 + energy * 0.5})`;
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(0,209,255,0.7)";
  ctx.shadowBlur = 8;
  const step = Math.max(1, Math.floor(timeData.length / cssW));
  for (let x = 0; x < cssW; x += 1) {
    const v = ((timeData[x * step] ?? 128) - 128) / 128;
    const y = mid + v * mid * (0.9 + energy);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

export function drawMiniMap(canvas, t = performance.now()) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1);
  const cssW = canvas.clientWidth || 220;
  const cssH = canvas.clientHeight || 110;
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.strokeStyle = "rgba(0,209,255,0.25)";
  ctx.lineWidth = 1;
  // simple wire continents
  const nodes = [
    [0.22, 0.35],
    [0.48, 0.28],
    [0.62, 0.42],
    [0.78, 0.5],
    [0.55, 0.68],
    [0.35, 0.62],
    [0.18, 0.55],
  ];
  ctx.beginPath();
  nodes.forEach(([x, y], i) => {
    const px = x * cssW;
    const py = y * cssH;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.stroke();

  const pips = [
    [0.52, 0.72], // Pretoria-ish
    [0.25, 0.38],
    [0.7, 0.4],
    [0.8, 0.55],
    [0.4, 0.3],
  ];
  for (let i = 0; i < pips.length; i += 1) {
    const [x, y] = pips[i];
    const pulse = 0.5 + Math.sin(t / 300 + i) * 0.5;
    ctx.fillStyle = i === 0 ? "rgba(255,138,61,0.95)" : `rgba(0,209,255,${0.55 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(x * cssW, y * cssH, 2.5 + pulse, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawBrain(canvas, energy = 0, thinking = false) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1);
  const cssW = canvas.clientWidth || 240;
  const cssH = canvas.clientHeight || 108;
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  ctx.clearRect(0, 0, cssW, cssH);
  const cx = cssW / 2;
  const cy = cssH / 2 + 4;
  const now = performance.now();

  ctx.strokeStyle = `rgba(0,209,255,${0.45 + energy * 0.4})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 48, 34, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - 34);
  ctx.quadraticCurveTo(cx + 8, cy, cx, cy + 34);
  ctx.stroke();

  const syn = 12;
  for (let i = 0; i < syn; i += 1) {
    const a = (i / syn) * Math.PI * 2 + now / (thinking ? 600 : 1800);
    const r = 18 + (i % 4) * 6;
    const x = cx + Math.cos(a) * r * 1.4;
    const y = cy + Math.sin(a) * r * 0.95;
    const x2 = cx + Math.cos(a + 1.2) * (r + 10) * 1.2;
    const y2 = cy + Math.sin(a + 1.2) * (r + 10) * 0.9;
    ctx.strokeStyle = `rgba(0,209,255,${0.15 + energy * 0.35})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.5 + energy * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // neural activity bars
  for (let i = 0; i < 16; i += 1) {
    const h =
      4 +
      Math.abs(Math.sin(now / 180 + i)) * (10 + energy * 18) * (thinking ? 1.4 : 1);
    ctx.fillStyle = `rgba(0,209,255,${0.35 + energy * 0.4})`;
    ctx.fillRect(12 + i * ((cssW - 24) / 16), cssH - 8 - h, 3, h);
  }
}
