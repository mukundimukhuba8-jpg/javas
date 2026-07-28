/** Subtle premium UI sounds via Web Audio (no assets required). */
export function createSoundscape() {
  /** @type {AudioContext | null} */
  let ctx = null;

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
    unlock: () => void ensure(),
    startup: () => {
      tone({ freq: 320, dur: 0.18, gain: 0.03 });
      tone({ freq: 480, dur: 0.22, gain: 0.025, slide: 120 });
    },
    click: () => tone({ freq: 660, dur: 0.05, gain: 0.015, type: "triangle" }),
    listen: () => tone({ freq: 240, dur: 0.1, gain: 0.02, slide: 80 }),
    think: () => tone({ freq: 180, dur: 0.14, gain: 0.012 }),
    done: () => {
      tone({ freq: 520, dur: 0.1, gain: 0.02 });
      tone({ freq: 780, dur: 0.14, gain: 0.016, slide: 40 });
    },
  };
}
