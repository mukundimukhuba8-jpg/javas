/**
 * Instant mic reactivity + clap detection for the living core.
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
  let freq = null;

  function sample() {
    if (!active || !analyser || !freq) return;
    analyser.getByteFrequencyData(freq);
    let sum = 0;
    const start = Math.floor(freq.length * 0.08);
    const end = Math.floor(freq.length * 0.45);
    for (let i = start; i < end; i += 1) sum += freq[i] ?? 0;
    const energy = Math.min(1, (sum / ((end - start) * 255)) * 3.1);
    const transient = Math.max(0, energy - prev) * 7;
    prev = energy * 0.6 + prev * 0.4;
    onLevel?.(energy);

    const now = performance.now();
    if (transient > 0.4 && energy > 0.28 && now - lastClap > 280) {
      lastClap = now;
      onClap?.(energy);
    }
    requestAnimationFrame(sample);
  }

  return {
    async start() {
      audioCtx = new AudioContext();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);
      freq = new Uint8Array(analyser.frequencyBinCount);
      active = true;
      requestAnimationFrame(sample);
    },
    stop() {
      active = false;
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
