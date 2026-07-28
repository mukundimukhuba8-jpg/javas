/** Subtle premium UI sounds + low ambient hum. */
export function createSoundscape() {
  /** @type {AudioContext | null} */
  let ctx = null;
  /** @type {OscillatorNode | null} */
  let humOsc = null;
  /** @type {GainNode | null} */
  let humGain = null;

  async function ensure() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx;
  }

  function tone({ freq = 440, dur = 0.12, type = "sine", gain = 0.03, slide = 0 } = {}) {
    void ensure().then((audio) => {
      const now = audio.currentTime;
      const osc = audio.createOscillator();
      const g = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), now + dur);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(gain, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g);
      g.connect(audio.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    });
  }

  return {
    unlock: () => ensure(),
    startup: () => {
      tone({ freq: 280, dur: 0.2, gain: 0.028 });
      tone({ freq: 420, dur: 0.26, gain: 0.022, slide: 160 });
    },
    click: () => tone({ freq: 700, dur: 0.045, gain: 0.012, type: "triangle" }),
    listen: () => tone({ freq: 220, dur: 0.09, gain: 0.018, slide: 90 }),
    think: () => tone({ freq: 170, dur: 0.12, gain: 0.01 }),
    done: () => {
      tone({ freq: 520, dur: 0.09, gain: 0.018 });
      tone({ freq: 760, dur: 0.12, gain: 0.014, slide: 40 });
    },
    async humStart() {
      const audio = await ensure();
      if (humOsc) return;
      humOsc = audio.createOscillator();
      humGain = audio.createGain();
      humOsc.type = "sine";
      humOsc.frequency.value = 92;
      humGain.gain.value = 0.0001;
      humOsc.connect(humGain);
      humGain.connect(audio.destination);
      humOsc.start();
      humGain.gain.exponentialRampToValueAtTime(0.006, audio.currentTime + 0.8);
    },
    humStop() {
      if (!ctx || !humOsc || !humGain) return;
      const now = ctx.currentTime;
      humGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      const osc = humOsc;
      humOsc = null;
      humGain = null;
      window.setTimeout(() => {
        try {
          osc.stop();
        } catch {
          /* ignore */
        }
      }, 500);
    },
  };
}
