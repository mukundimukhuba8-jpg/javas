import { CRM_STAGES, answerFor } from "./data.js";
import {
  createStatusStack,
  createSpeechController,
  streamAndSpeak,
  generateWithModel,
  FAILURE_LINES,
  renderMarkdown,
} from "./conversation.js";

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

export function createCardStack(root) {
  return createStatusStack(root);
}

async function sayOpener(el, opener, { signal, speech, onState, onSpeechLevel }) {
  if (!opener) return;
  el.classList.add("show");
  el.innerHTML = renderMarkdown(opener);
  onState?.("speaking");
  await speech.speak(opener, {
    signal,
    onBoundary: () => onSpeechLevel?.(0.3 + Math.random() * 0.35),
  });
}

async function runSoftStatus(stack, messages, { signal, onState }) {
  if (!messages?.length) return;
  onState?.("thinking");
  for (const message of messages) {
    if (signal?.aborted) return;
    await stack.show(message, { ms: 700, signal });
  }
}

async function deliverAnswer(hooks, answer, { withModelFallback = true } = {}) {
  const {
    stack,
    streamPanel,
    history,
    prompt,
    signal,
    speech,
    onState,
    onSpeechLevel,
    onTokens,
    sound,
  } = hooks;

  stack.clear();
  streamPanel.classList.remove("show");
  streamPanel.innerHTML = "";

  // 1) Natural opener first — conversation before chrome
  if (answer.opener) {
    await sayOpener(streamPanel, answer.opener, {
      signal,
      speech,
      onState,
      onSpeechLevel,
    });
    if (signal?.aborted) return { aborted: true };
    await wait(180, signal);
  }

  // 2) Soft human status (never "Analyzing request...")
  await runSoftStatus(stack, answer.status, { signal, onState });
  if (signal?.aborted) return { aborted: true };

  // 3) Prefer remote model when configured; recover gracefully
  let body = answer.text;
  let speakBody = answer.speak || answer.text;
  if (withModelFallback) {
    onState?.("thinking");
    const remote = await generateWithModel(prompt, history || [], { signal });
    if (remote.ok && remote.text) {
      body = remote.text;
      speakBody = remote.text;
    } else if (remote.reason === "error") {
      const note = FAILURE_LINES[0];
      streamPanel.classList.add("show");
      streamPanel.innerHTML = renderMarkdown(note);
      await speech.speak(note, { signal, onBoundary: () => onSpeechLevel?.(0.3) });
      // continue with local answer
    }
  }

  if (signal?.aborted) return { aborted: true };

  // 4) Stream + speak in parallel (keep opener on screen if present)
  sound?.listen?.();
  const prior = answer.opener ? `${answer.opener}\n\n` : "";
  const result = await streamAndSpeak(streamPanel, body, {
    signal,
    speech,
    speakText: speakBody,
    onToken: onTokens,
    onState,
    onSpeechLevel,
    startSpeakingAt: 4,
    prefixMarkdown: prior,
  });

  if (!result.aborted) {
    if (answer.opener && body === answer.text) {
      streamPanel.innerHTML = renderMarkdown([answer.opener, body].filter(Boolean).join("\n\n"));
    }
    onState?.("idle");
    sound?.done?.();
  }
  return result;
}

export async function runGreeting(hooks) {
  const answer = answerFor(hooks.prompt, hooks.history);
  return deliverAnswer(hooks, answer, { withModelFallback: false });
}

export async function runHelp(hooks) {
  const answer = answerFor(hooks.prompt, hooks.history);
  return deliverAnswer(hooks, answer, { withModelFallback: false });
}

export async function runCrmMission(hooks) {
  const {
    stack,
    crmBoard,
    crmStages,
    streamPanel,
    onState,
    onOpenStage,
    onMeters,
    sound,
    signal,
    speech,
    onSpeechLevel,
  } = hooks;

  const answer = answerFor("Build me a CRM", hooks.history);

  stack.clear();
  streamPanel.classList.remove("show");
  streamPanel.innerHTML = "";

  await sayOpener(streamPanel, answer.opener, {
    signal,
    speech,
    onState,
    onSpeechLevel,
  });
  if (signal?.aborted) return { aborted: true };

  await runSoftStatus(stack, answer.status, { signal, onState });
  if (signal?.aborted) return { aborted: true };

  // Show project board as supporting UI — not instead of the answer
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

  onState?.("planning");
  sound?.think?.();
  for (const { el } of refs) {
    if (signal?.aborted) return { aborted: true };
    el.classList.add("active");
    onMeters?.({ cpu: 35 + Math.random() * 30, neu: 55 + Math.random() * 25 });
    await wait(220, signal);
    el.classList.remove("active");
    el.classList.add("done");
  }

  // Keep opener visible; stream the follow-through answer beneath it
  const prior = answer.opener ? `${answer.opener}\n\n` : "";
  streamPanel.classList.add("show");
  streamPanel.innerHTML = renderMarkdown(prior);

  const result = await streamAndSpeak(streamPanel, answer.text, {
    signal,
    speech,
    speakText: answer.speak,
    onToken: hooks.onTokens,
    onState,
    onSpeechLevel,
    prefixMarkdown: prior,
  });

  if (!result.aborted) {
    streamPanel.innerHTML = renderMarkdown(
      [answer.opener, answer.text].filter(Boolean).join("\n\n"),
    );
    onState?.("idle");
    sound?.done?.();
  }
  return result;
}

export async function runWeatherExperience(hooks) {
  const {
    stack,
    streamPanel,
    weatherDock,
    weatherScene,
    bg,
    onState,
    sound,
    signal,
    speech,
    onSpeechLevel,
  } = hooks;

  const answer = answerFor("What's the weather?", hooks.history);

  stack.clear();
  streamPanel.classList.remove("show");
  streamPanel.innerHTML = "";

  await sayOpener(streamPanel, answer.opener, {
    signal,
    speech,
    onState,
    onSpeechLevel,
  });
  if (signal?.aborted) return { aborted: true };

  document.getElementById("weatherScene")?.classList.add("active");
  weatherScene?.start();
  bg?.setWeather?.(1);
  weatherDock.classList.add("rise");
  onState?.("weather");

  await runSoftStatus(stack, answer.status, { signal, onState });
  if (signal?.aborted) return { aborted: true };

  const prior = answer.opener ? `${answer.opener}\n\n` : "";
  streamPanel.classList.add("show");
  streamPanel.innerHTML = renderMarkdown(prior);

  const result = await streamAndSpeak(streamPanel, answer.text, {
    signal,
    speech,
    speakText: answer.speak,
    onToken: hooks.onTokens,
    onState,
    onSpeechLevel,
    prefixMarkdown: prior,
  });

  if (!result.aborted) {
    streamPanel.innerHTML = renderMarkdown(
      [answer.opener, answer.text].filter(Boolean).join("\n\n"),
    );
    onState?.("idle");
    sound?.done?.();
  }

  try {
    await wait(900, signal);
  } catch {
    /* aborted */
  }
  document.getElementById("weatherScene")?.classList.remove("active");
  weatherScene?.stop();
  bg?.setWeather?.(0);
  return result;
}

export async function runSearchExperience(hooks) {
  const answer = answerFor(hooks.prompt, hooks.history);
  return deliverAnswer(hooks, answer);
}

export async function runGeneralExperience(hooks) {
  const answer = answerFor(hooks.prompt, hooks.history);
  return deliverAnswer(hooks, answer);
}

/** Unified entry used by main.js */
export async function runConversation(kind, hooks) {
  try {
    if (kind === "greeting") return await runGreeting(hooks);
    if (kind === "help") return await runHelp(hooks);
    if (kind === "crm") return await runCrmMission(hooks);
    if (kind === "weather") return await runWeatherExperience(hooks);
    if (kind === "search") return await runSearchExperience(hooks);
    return await runGeneralExperience(hooks);
  } catch (err) {
    if (err?.name === "AbortError") return { aborted: true };
    const { streamPanel, speech, signal, onState, onSpeechLevel } = hooks;
    const msg =
      "I couldn't complete that request because my AI service is unavailable. Please try again in a moment.";
    streamPanel.classList.add("show");
    streamPanel.innerHTML = renderMarkdown(msg);
    onState?.("speaking");
    try {
      await speech.speak(msg, {
        signal,
        onBoundary: () => onSpeechLevel?.(0.3),
      });
    } catch {
      /* ignore */
    }
    onState?.("idle");
    return { aborted: false, error: true };
  }
}

export { createSpeechController, createStatusStack };
