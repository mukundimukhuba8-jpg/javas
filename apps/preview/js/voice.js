/**
 * Instant mic / clap reactivity using time-domain RMS (much more responsive).
 */
export function createVoiceSensor({ onLevel, onClap }) {
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
  let raf = 0;

  function sample() {
    if (!active || !analyser || !timeData) return;
    analyser.getByteTimeDomainData(timeData);

    let sum = 0;
    for (let i = 0; i < timeData.length; i += 1) {
      const v = ((timeData[i] ?? 128) - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / timeData.length);
    // Amplify quiet laptop mics; clamp to 0..1
    const energy = Math.min(1, rms * 6.5);
    const transient = Math.max(0, energy - prev) * 5.5;
    prev = energy * 0.45 + prev * 0.55;
    onLevel?.(energy);

    const now = performance.now();
    // Clap = sharp transient; voice = sustained energy
    if (transient > 0.18 && energy > 0.12 && now - lastClap > 220) {
      lastClap = now;
      onClap?.(Math.max(energy, 0.85));
    }

    raf = requestAnimationFrame(sample);
  }

  return {
    async start() {
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
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.15;
      source.connect(analyser);
      timeData = new Uint8Array(analyser.fftSize);
      active = true;
      raf = requestAnimationFrame(sample);
    },
    stop() {
      active = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void audioCtx?.close();
      audioCtx = null;
      onLevel?.(0);
    },
    get active() {
      return active;
    },
  };
}
