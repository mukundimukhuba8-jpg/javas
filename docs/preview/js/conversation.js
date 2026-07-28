/**
 * Natural conversation engine for Cloudy.
 * Priority: answer the user. Animations are secondary.
 */

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderMarkdown(md) {
  let html = escapeHtml(md);
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/^(?!<[hptu]|<pre)(.+)$/gm, "<p>$1</p>");
  return html;
}

function splitSentences(text) {
  const parts = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  return (parts || [text]).map((s) => s.trim()).filter(Boolean);
}

/** Controllable speech — can be cancelled instantly for barge-in. */
export function createSpeechController() {
  let speaking = false;
  let current = null;

  function stop() {
    speaking = false;
    current = null;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }

  function speak(text, { signal, onStart, onBoundary, onEnd } = {}) {
    return new Promise((resolve) => {
      if (!text?.trim() || !("speechSynthesis" in window)) {
        onEnd?.();
        resolve({ spoken: false });
        return;
      }
      if (signal?.aborted) {
        resolve({ spoken: false, aborted: true });
        return;
      }

      stop();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.02;
      utter.pitch = 1;
      const voices = speechSynthesis.getVoices();
      utter.voice =
        voices.find((v) => /en(-|_)GB/i.test(v.lang) && /natural|enhanced|premium/i.test(v.name)) ||
        voices.find((v) => /en(-|_)GB/i.test(v.lang)) ||
        voices.find((v) => /^en/i.test(v.lang)) ||
        null;

      current = utter;
      speaking = true;

      const onAbort = () => {
        stop();
        onEnd?.();
        resolve({ spoken: false, aborted: true });
      };
      signal?.addEventListener("abort", onAbort, { once: true });

      utter.onstart = () => onStart?.();
      utter.onboundary = (e) => {
        if (!speaking) return;
        onBoundary?.(e);
      };
      utter.onend = () => {
        speaking = false;
        current = null;
        signal?.removeEventListener("abort", onAbort);
        onEnd?.();
        resolve({ spoken: true });
      };
      utter.onerror = () => {
        speaking = false;
        current = null;
        signal?.removeEventListener("abort", onAbort);
        onEnd?.();
        resolve({ spoken: false });
      };
      speechSynthesis.speak(utter);
    });
  }

  return {
    speak,
    stop,
    get speaking() {
      return speaking;
    },
  };
}

/**
 * Stream word-by-word into an element while optionally speaking sentences
 * as soon as they complete — not after the full answer.
 */
export async function streamAndSpeak(el, text, {
  signal,
  speech,
  speakText,
  onToken,
  onState,
  onSpeechLevel,
  startSpeakingAt = 4,
  prefixMarkdown = "",
} = {}) {
  el.classList.add("show");
  const words = text.match(/\S+\s*/g) || [text];
  let out = "";
  let tokens = 0;
  const started = performance.now();
  const spokenPlan = speakText || text;
  const sentences = splitSentences(spokenPlan);
  let nextSpeak = 0;
  let speakChain = Promise.resolve();
  let startedSpeech = false;
  let speechStartedEarly = false;

  const queueSpeech = (sentence) => {
    if (!speech || !sentence) return;
    speakChain = speakChain.then(async () => {
      if (signal?.aborted) return;
      if (!startedSpeech) {
        startedSpeech = true;
        onState?.("speaking");
      }
      await speech.speak(sentence, {
        signal,
        onBoundary: () => onSpeechLevel?.(0.35 + Math.random() * 0.4),
      });
    });
  };

  try {
    onState?.("writing");

    for (const word of words) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      out += word;
      tokens += 1;
      el.innerHTML = renderMarkdown(prefixMarkdown + out);
      onToken?.(tokens, Math.round(performance.now() - started));

      // Start speaking as soon as a few words are on screen
      if (!speechStartedEarly && tokens >= startSpeakingAt && sentences[0]) {
        speechStartedEarly = true;
        queueSpeech(sentences[0]);
        nextSpeak = 1;
      }

      // As later sentences finish typing, queue them for speech
      if (/[.!?]/.test(word) && nextSpeak > 0 && nextSpeak < sentences.length) {
        const typedSentences = splitSentences(out).length;
        while (nextSpeak < typedSentences && nextSpeak < sentences.length) {
          queueSpeech(sentences[nextSpeak]);
          nextSpeak += 1;
        }
      }

      const delay = /[,;:]$/.test(word.trim())
        ? 70
        : /[.!?]$/.test(word.trim())
          ? 100
          : 26 + Math.min(36, word.trim().length * 2);
      await wait(delay, signal);
    }

    while (nextSpeak < sentences.length && !signal?.aborted) {
      queueSpeech(sentences[nextSpeak]);
      nextSpeak += 1;
    }
    await speakChain;
  } catch (err) {
    if (err?.name === "AbortError") {
      speech?.stop();
      return { tokens, latency: Math.round(performance.now() - started), aborted: true };
    }
    throw err;
  }

  return { tokens, latency: Math.round(performance.now() - started), aborted: false };
}

/** Soft status chip — human language, not system telemetry. */
export function createStatusStack(root) {
  function clear() {
    root.innerHTML = "";
  }

  async function show(message, { ms = 900, signal } = {}) {
    const el = document.createElement("div");
    el.className = "exec-card active soft-status";
    el.innerHTML = `
      <div class="row">
        <div class="title">${escapeHtml(message)}</div>
        <div class="status">…</div>
      </div>
    `;
    root.prepend(el);
    while (root.children.length > 3) root.lastElementChild?.remove();
    try {
      await wait(ms, signal);
      if (signal?.aborted) return;
      el.classList.remove("active");
      el.classList.add("done");
      el.querySelector(".status").textContent = "✓";
    } catch {
      /* aborted */
    }
  }

  return { clear, show };
}

/**
 * Optional remote model. Falls back locally on any failure.
 * Set localStorage cloudy_api_url + cloudy_api_key to enable.
 */
export async function generateWithModel(prompt, history, { signal } = {}) {
  const apiUrl = localStorage.getItem("cloudy_api_url");
  const apiKey = localStorage.getItem("cloudy_api_key");
  if (!apiUrl || !apiKey) {
    return { ok: false, reason: "local", text: null };
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: localStorage.getItem("cloudy_model") || "gpt-4o-mini",
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You are Cloudy, a calm, intelligent AI assistant. Speak like a helpful human — professional, friendly, confident, patient. Never narrate system steps like 'analyzing' or 'searching memory'. Answer clearly, ask a follow-up when useful, keep responses concise unless the user asks for depth.",
          },
          ...history.slice(-8),
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI service ${res.status}`);
    const data = await res.json();
    const text =
      data.choices?.[0]?.message?.content ||
      data.content?.[0]?.text ||
      data.output_text ||
      data.text;
    if (!text) throw new Error("Empty model response");
    return { ok: true, text: String(text).trim() };
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    return { ok: false, reason: "error", error: err, text: null };
  }
}

export const FAILURE_LINES = [
  "I'm having trouble connecting to my AI engine. Let me try again with what I know locally.",
  "I couldn't complete that with the remote AI service, so I'll answer from what I have here.",
];
