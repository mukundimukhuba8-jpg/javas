const WAKE_PHRASES = ["hey cloudy", "hello cloudy", "hi cloudy"];

export function createWakeController({
  onAwake,
  orb,
  transcriptEl,
  setWakeState,
}) {
  let audioCtx = null;
  let analyser = null;
  let freqData = null;
  let recognition = null;
  let active = false;
  let waking = false;
  let prevEnergy = 0;
  let lastClapAt = 0;

  function normalize(text) {
    return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  function playStartupSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const master = audioCtx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.2, now + 0.04);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    master.connect(audioCtx.destination);
    [220, 440, 660, 990].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.7, now + 0.4);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18 / (i + 1), now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 1.4);
    });
  }

  function speakGreeting() {
    const text = "Hello. Cloudy online. How can I help you today?";
    if (transcriptEl) transcriptEl.textContent = text;
    setWakeState("speaking");
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    const voices = speechSynthesis.getVoices();
    utter.voice =
      voices.find((v) => /en(-|_)GB/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      null;
    utter.onend = () => onAwake?.();
    utter.onerror = () => onAwake?.();
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  }

  function wake(reason) {
    if (!active || waking) return;
    waking = true;
    setWakeState("waking");
    playStartupSound();
    if (transcriptEl) transcriptEl.textContent = `Wake · ${reason}`;
    if (orb) orb.style.transform = "scale(1.85)";
    window.setTimeout(() => {
      speakGreeting();
    }, 1700);
  }

  function sample() {
    if (!analyser || !freqData || !active) return;
    analyser.getByteFrequencyData(freqData);
    let sum = 0;
    const start = Math.floor(freqData.length * 0.1);
    const end = Math.floor(freqData.length * 0.4);
    for (let i = start; i < end; i += 1) sum += freqData[i] ?? 0;
    const energy = Math.min(1, (sum / ((end - start) * 255)) * 3);
    const transient = Math.max(0, energy - prevEnergy) * 8;
    prevEnergy = energy * 0.7 + prevEnergy * 0.3;

    if (transient > 0.45 && energy > 0.3) {
      const now = performance.now();
      if (now - lastClapAt > 250) {
        lastClapAt = now;
        wake(now - lastClapAt < 500 ? "Clap" : "Clap");
      }
    }

    if (orb && document.body.dataset.wake === "listening") {
      orb.style.transform = `scale(${1.65 + energy * 0.8})`;
    }
    requestAnimationFrame(sample);
  }

  function startRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        text += event.results[i]?.[0]?.transcript ?? "";
      }
      if (transcriptEl && text) transcriptEl.textContent = text;
      if (WAKE_PHRASES.some((p) => normalize(text).includes(p))) wake("Hey Cloudy");
    };
    recognition.onend = () => {
      if (active && !waking) {
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

  return {
    async enable() {
      audioCtx = new AudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      freqData = new Uint8Array(analyser.frequencyBinCount);
      active = true;
      waking = false;
      setWakeState("idle");
      startRecognition();
      requestAnimationFrame(sample);
    },
    wakeManual() {
      active = true;
      wake("Manual");
    },
    stop() {
      active = false;
      try {
        recognition?.stop();
      } catch {
        /* ignore */
      }
    },
  };
}
