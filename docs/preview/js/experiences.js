import {
  CRM_STAGES,
  THINKING_STAGES,
  WEATHER_STEPS,
  answerFor,
} from "./data.js";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export async function streamText(el, text, onToken) {
  el.classList.add("show");
  const chunks = text.match(/\s+|\S+/g) || [text];
  let out = "";
  let tokens = 0;
  const started = performance.now();
  for (const chunk of chunks) {
    out += chunk;
    tokens += 1;
    el.innerHTML = renderMarkdown(out);
    onToken?.(tokens, Math.round(performance.now() - started));
    await wait(chunk.trim().length > 10 ? 22 : 10);
  }
  return { tokens, latency: Math.round(performance.now() - started) };
}

export function speak(text, { onStart, onEnd, onBoundary } = {}) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      onEnd?.();
      resolve();
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.98;
    utter.pitch = 1;
    const voices = speechSynthesis.getVoices();
    utter.voice =
      voices.find((v) => /en(-|_)GB/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      null;
    utter.onstart = () => onStart?.();
    utter.onboundary = (e) => onBoundary?.(e);
    utter.onend = () => {
      onEnd?.();
      resolve();
    };
    utter.onerror = () => {
      onEnd?.();
      resolve();
    };
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  });
}

/** Animated execution card stack */
export function createCardStack(root) {
  const cards = [];

  function clear() {
    root.innerHTML = "";
    cards.length = 0;
  }

  async function push({ title, detail = "Running...", icon = "◎" }) {
    // Shrink / slide completed cards
    for (const prev of cards) {
      if (prev.el.classList.contains("active")) {
        prev.el.classList.remove("active");
        prev.el.classList.add("done");
        prev.el.querySelector(".status").textContent = "Complete";
        const bar = prev.el.querySelector(".bar > i");
        if (bar) bar.style.width = "100%";
      }
    }

    const el = document.createElement("div");
    el.className = "exec-card active";
    el.innerHTML = `
      <div class="row">
        <div class="title">${icon} ${title}</div>
        <div class="status">Running</div>
      </div>
      <div style="margin-top:4px;color:var(--muted);font-size:13px">${detail}</div>
      <div class="bar"><i></i></div>
    `;
    root.prepend(el);
    // Keep only a few visible
    while (root.children.length > 4) root.lastElementChild?.remove();

    const fill = el.querySelector(".bar > i");
    const card = { el, fill, progress: 0 };
    cards.push(card);
    return card;
  }

  async function progress(card, to = 100, ms = 500) {
    if (!card) return;
    const from = card.progress;
    const steps = 10;
    for (let i = 1; i <= steps; i += 1) {
      card.progress = from + ((to - from) * i) / steps;
      card.fill.style.width = `${card.progress}%`;
      await wait(ms / steps);
    }
  }

  async function complete(card) {
    if (!card) return;
    await progress(card, 100, 280);
    card.el.classList.remove("active");
    card.el.classList.add("done");
    card.el.querySelector(".status").textContent = "Complete";
  }

  return { clear, push, progress, complete };
}

export async function runExecutionStages(stack, stages, { onStage, sound } = {}) {
  for (const stage of stages) {
    onStage?.(stage);
    const card = await stack.push({
      title: stage.label,
      detail: stage.detail || "Executing...",
      icon: stage.icon || "◎",
    });
    sound?.think?.();
    await stack.progress(card, 70, stage.ms || 450);
    await wait(120);
    await stack.complete(card);
    sound?.click?.();
  }
}

export async function runThinkingPipeline(stack, { onPipeline, onState, sound } = {}) {
  onState?.("thinking");
  for (const stage of THINKING_STAGES) {
    onPipeline?.(stage.label);
    const card = await stack.push({
      title: stage.label,
      detail: "Live execution...",
      icon: stage.icon,
    });
    sound?.think?.();
    await stack.progress(card, 100, 380);
    await stack.complete(card);
    sound?.click?.();
  }
}

export async function runCrmMission(hooks) {
  const {
    stack,
    crmBoard,
    crmStages,
    streamPanel,
    onState,
    onPipeline,
    onLog,
    onOpenStage,
    onMeters,
    sound,
  } = hooks;

  stack.clear();
  streamPanel.classList.remove("show");
  streamPanel.innerHTML = "";
  crmBoard.hidden = false;
  crmBoard.classList.add("show");
  crmStages.innerHTML = "";

  const refs = [];
  for (const stage of CRM_STAGES) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "stage-card";
    el.innerHTML = `<div class="dot"></div>${stage.name}`;
    el.addEventListener("click", () => onOpenStage?.(stage));
    crmStages.appendChild(el);
    refs.push({ stage, el });
  }

  onPipeline?.("Intent Recognised");
  onLog?.("CRM mission accepted", "ok");
  onState?.("planning");
  sound?.think?.();

  for (const { stage, el } of refs) {
    el.classList.add("active");
    onPipeline?.("Tool Execution");
    onState?.(stage.id === "frontend" || stage.id === "backend" ? "thinking" : "planning");
    onMeters?.({ cpu: 40 + Math.random() * 40, neu: 60 + Math.random() * 30 });
    const card = await stack.push({
      title: stage.name,
      detail: "Building workspace slice...",
      icon: "⬡",
    });
    await stack.progress(card, 100, 520);
    await stack.complete(card);
    el.classList.remove("active");
    el.classList.add("done");
    onLog?.(`${stage.name} complete`, "ok");
    sound?.click?.();
  }

  const answer = answerFor("Build me a CRM");
  onState?.("writing");
  onPipeline?.("Response Generation");
  await streamText(streamPanel, answer.text, hooks.onTokens);
  onState?.("speaking");
  onPipeline?.("Speaking");
  sound?.listen?.();
  await speak(answer.speak, {
    onBoundary: () => {
      onState?.("speaking");
      hooks.onSpeechLevel?.(0.35 + Math.random() * 0.4);
    },
  });
  onState?.("idle");
  onPipeline?.(null);
  sound?.done?.();
  onLog?.("CRM board ready", "ok");
}

export async function runWeatherExperience(hooks) {
  const {
    stack,
    streamPanel,
    weatherDock,
    weatherScene,
    bg,
    onState,
    onPipeline,
    onLog,
    onMeters,
    sound,
  } = hooks;

  stack.clear();
  streamPanel.classList.remove("show");
  streamPanel.innerHTML = "";
  document.getElementById("weatherScene")?.classList.add("active");
  weatherScene?.start();
  bg?.setWeather?.(1);
  weatherDock.classList.add("rise");
  onState?.("weather");
  onLog?.("Atmosphere transform", "ok");

  for (const step of WEATHER_STEPS) {
    onPipeline?.(
      step.id === "loc" || step.id === "gps"
        ? "Tool Execution"
        : step.id === "forecast"
          ? "Response Generation"
          : "Knowledge Retrieval",
    );
    onState?.(step.id === "forecast" ? "thinking" : "searching");
    onMeters?.({ net: 50 + Math.random() * 40, neu: 55 + Math.random() * 35 });
    const card = await stack.push({
      title: step.label,
      detail: step.detail,
      icon: step.icon,
    });
    await stack.progress(card, 100, 480);
    await stack.complete(card);
    onLog?.(step.label, "ok");
    sound?.click?.();
  }

  const answer = answerFor("What's the weather?");
  onState?.("writing");
  onPipeline?.("Response Generation");
  await streamText(streamPanel, answer.text, hooks.onTokens);
  onState?.("speaking");
  onPipeline?.("Speaking");
  sound?.listen?.();
  await speak(answer.speak, {
    onBoundary: () => {
      onState?.("speaking");
      hooks.onSpeechLevel?.(0.4 + Math.random() * 0.45);
    },
  });

  onState?.("idle");
  onPipeline?.(null);
  sound?.done?.();
  // Keep weather scene briefly then fade
  await wait(1200);
  document.getElementById("weatherScene")?.classList.remove("active");
  weatherScene?.stop();
  bg?.setWeather?.(0);
}

export async function runSearchExperience(hooks) {
  const { stack, streamPanel, onState, onPipeline, onLog, sound, prompt } = hooks;
  stack.clear();
  streamPanel.classList.remove("show");
  streamPanel.innerHTML = "";
  onState?.("thinking");
  await runThinkingPipeline(stack, { onPipeline, onState, sound });
  onPipeline?.("Knowledge Retrieval");
  onLog?.("Sources validated", "ok");
  const answer = answerFor(prompt);
  onState?.("writing");
  onPipeline?.("Response Generation");
  await streamText(streamPanel, answer.text, hooks.onTokens);
  onState?.("speaking");
  await speak(answer.speak, {
    onBoundary: () => hooks.onSpeechLevel?.(0.3 + Math.random() * 0.4),
  });
  onState?.("idle");
  onPipeline?.(null);
  sound?.done?.();
}

export async function runGeneralExperience(hooks) {
  const { stack, streamPanel, onState, onPipeline, onLog, sound, prompt } = hooks;
  stack.clear();
  streamPanel.classList.remove("show");
  streamPanel.innerHTML = "";
  onLog?.("Intent recognised", "ok");
  await runThinkingPipeline(stack, { onPipeline, onState, sound });
  const answer = answerFor(prompt);
  onState?.("writing");
  onPipeline?.("Response Generation");
  const stats = await streamText(streamPanel, answer.text, hooks.onTokens);
  onState?.("speaking");
  onPipeline?.("Speaking");
  await speak(answer.speak, {
    onBoundary: () => hooks.onSpeechLevel?.(0.3 + Math.random() * 0.4),
  });
  onState?.("idle");
  onPipeline?.(null);
  sound?.done?.();
  return stats;
}
