import {
  GOALS,
  SIDE_LINKS,
  MODE_ACTIONS,
  FORECAST,
  SUGGESTIONS,
  detectExperience,
} from "./js/data.js";
import { createBackground, createWeatherScene } from "./js/background.js";
import { createIntelligenceCore } from "./js/core.js";
import { createSoundscape } from "./js/sound.js";
import { createVoiceSensor, drawVoiceWave, drawMiniMap, drawBrain } from "./js/voice.js";
import {
  createStatusStack,
  createSpeechController,
  runConversation,
} from "./js/experiences.js";

const $ = (id) => document.getElementById(id);

const els = {
  hud: $("hud"),
  boot: $("boot"),
  bootSteps: $("bootSteps"),
  bootNote: $("bootNote"),
  enableMic: $("enableMic"),
  onboarding: $("onboarding"),
  goalGrid: $("goalGrid"),
  startBtn: $("startBtn"),
  sideNav: $("sideNav"),
  modeRow: $("modeRow"),
  coreCanvas: $("coreCanvas"),
  bgCanvas: $("bgCanvas"),
  weatherCanvas: $("weatherCanvas"),
  voiceWave: $("voiceWave"),
  mapCanvas: $("mapCanvas"),
  brainCanvas: $("brainCanvas"),
  coreState: $("coreState"),
  coreHint: $("coreHint"),
  liveStack: $("liveStack"),
  streamPanel: $("streamPanel"),
  crmBoard: $("crmBoard"),
  crmStages: $("crmStages"),
  activityLog: $("activityLog"),
  weatherDock: $("weatherDock"),
  forecast: $("forecast"),
  composer: $("composer"),
  prompt: $("prompt"),
  sendBtn: $("sendBtn"),
  micBtn: $("micBtn"),
  voiceToggle: $("voiceToggle"),
  voiceLive: $("voiceLive"),
  noiseFill: $("noiseFill"),
  noisePct: $("noisePct"),
  clock: $("clock"),
  sysMode: $("sysMode"),
  stageModal: $("stageModal"),
  stageTitle: $("stageTitle"),
  stageBody: $("stageBody"),
  closeStage: $("closeStage"),
  mCpu: $("mCpu"),
  mMem: $("mMem"),
  mNet: $("mNet"),
  mNeu: $("mNeu"),
  mCpuFill: $("mCpuFill"),
  mMemFill: $("mMemFill"),
  mNetFill: $("mNetFill"),
  mNeuFill: $("mNeuFill"),
};

const state = {
  goals: new Set(),
  busy: false,
  ai: "idle",
  history: [],
  session: 0,
};

const bg = createBackground(els.bgCanvas);
const weatherScene = createWeatherScene(els.weatherCanvas);
const core = createIntelligenceCore(els.coreCanvas);
const sound = createSoundscape();
const stack = createStatusStack(els.liveStack);
const speech = createSpeechController();

let latestTimeData = null;
let latestEnergy = 0;
let abortController = null;
let bargeInHold = 0;
let ignoreMicUntil = 0;

function interruptCloudy(reason = "barge-in") {
  if (!state.busy && !speech.speaking) return false;
  speech.stop();
  abortController?.abort();
  abortController = null;
  log(reason === "barge-in" ? "Listening to you" : reason, "ok");
  setAiState("listening");
  return true;
}

const voice = createVoiceSensor({
  onLevel: (energy, data) => {
    latestEnergy = energy;
    latestTimeData = data?.timeData || null;
    core.setLevel(energy);
    bg.setEnergy(energy);

    els.noiseFill.style.width = `${Math.round(energy * 100)}%`;
    els.noisePct.textContent = `${Math.round(energy * 100)}%`;

    const hearing = energy > 0.045;
    if (hearing) {
      els.voiceLive.textContent = "LIVE";
      els.micBtn.classList.add("live");
    } else if (!state.busy) {
      els.voiceLive.textContent = voice.active ? "READY" : "STANDBY";
      els.micBtn.classList.remove("live");
    }

    // Barge-in: if Cloudy is speaking and the user starts talking, stop immediately
    const now = performance.now();
    if (
      (speech.speaking || state.ai === "speaking") &&
      now > ignoreMicUntil &&
      energy > 0.12
    ) {
      bargeInHold += 1;
      if (bargeInHold >= 4) {
        bargeInHold = 0;
        interruptCloudy("barge-in");
      }
    } else {
      bargeInHold = Math.max(0, bargeInHold - 1);
    }

    if (hearing && !state.busy) {
      setAiState("listening");
      bumpMeters(energy);
    } else if (!hearing && !state.busy && state.ai === "listening") {
      setAiState("idle");
    } else if (hearing && state.busy) {
      core.setLevel(Math.max(energy, 0.2));
    }
  },
  onClap: (energy) => {
    sound.listen();
    core.burst(1.2);
    core.setLevel(Math.max(energy, 0.95));
    bg.setEnergy(1);
    if (speech.speaking) interruptCloudy("barge-in");
    else if (!state.busy) setAiState("listening");
  },
  onTranscript: (text, isFinal) => {
    if (!text) return;
    els.prompt.value = text;
    // Any transcript while Cloudy is talking = user is interrupting
    if (!isFinal && (speech.speaking || state.ai === "speaking" || state.busy)) {
      interruptCloudy("barge-in");
    }
    if (!isFinal && !state.busy) setAiState("listening");
  },
  onSpeechEnd: (text) => {
    const cleaned = text.trim();
    if (cleaned.length < 2) return;
    if (speech.speaking || state.ai === "speaking") interruptCloudy("barge-in");
    // Small delay so abort settles, then answer
    window.setTimeout(() => {
      void handlePrompt(cleaned);
    }, 60);
  },
});

function setAiState(label) {
  const key = String(label || "idle").toLowerCase();
  state.ai = key;
  const pretty = key.charAt(0).toUpperCase() + key.slice(1);
  els.coreState.textContent = pretty.toUpperCase();
  els.sysMode.textContent = pretty.toUpperCase();
  core.setState(key);

  const hints = {
    idle: "Ready when you are",
    listening: "I'm listening",
    thinking: "One moment",
    searching: "Looking that up",
    planning: "Putting a plan together",
    writing: "Typing",
    speaking: "Talking with you",
    weather: "Checking conditions",
  };
  els.coreHint.textContent = hints[key] || "With you";
}

function bumpMeters(energy = 0.2) {
  setMeter("cpu", 22 + energy * 50 + Math.random() * 10);
  setMeter("mem", 40 + energy * 20 + Math.random() * 8);
  setMeter("net", 50 + energy * 35 + Math.random() * 10);
  setMeter("neu", 55 + energy * 40 + Math.random() * 10);
}

function setMeter(which, value) {
  const v = Math.max(5, Math.min(98, Math.round(value)));
  const map = {
    cpu: [els.mCpu, els.mCpuFill],
    mem: [els.mMem, els.mMemFill],
    net: [els.mNet, els.mNetFill],
    neu: [els.mNeu, els.mNeuFill],
  };
  const pair = map[which];
  if (!pair) return;
  pair[0].textContent = `${v}%`;
  pair[1].style.width = `${v}%`;
}

function log(message, level = "ok") {
  // Keep the side log quiet and human — no pipeline spam
  if (/intent|pipeline|analyzing|generating response|tool execution/i.test(message)) return;
  const item = document.createElement("div");
  item.className = `log-item ${level}`;
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  item.innerHTML = `<time>${ts}</time><span>${message}</span><span class="tag">${level}</span>`;
  els.activityLog.prepend(item);
  while (els.activityLog.children.length > 18) els.activityLog.lastChild?.remove();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tickClock() {
  const d = new Date();
  els.clock.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function renderNav() {
  els.sideNav.innerHTML = "";
  for (const label of SIDE_LINKS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-item" + (label === "Home" ? " active" : "");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      sound.click();
      els.sideNav.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      core.burst(0.4);
      if (label === "Projects") {
        els.prompt.value = "Build me a CRM";
        els.prompt.focus();
      }
      if (label === "Voice") void toggleVoice();
    });
    els.sideNav.appendChild(btn);
  }
}

function renderModes() {
  els.modeRow.innerHTML = "";
  for (const mode of MODE_ACTIONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "qa";
    btn.title = mode.title;
    btn.textContent = mode.icon;
    btn.addEventListener("click", () => {
      sound.click();
      core.burst(0.6);
      if (mode.id === "pulse") els.prompt.value = SUGGESTIONS[0];
    });
    els.modeRow.appendChild(btn);
  }
}

function renderForecast() {
  els.forecast.innerHTML = FORECAST.map(
    (d) => `<div class="day"><b>${d.d}</b><div>${d.icon}</div><div class="t">${d.t}</div></div>`,
  ).join("");
}

function renderGoals() {
  els.goalGrid.innerHTML = "";
  for (const goal of GOALS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "goal";
    btn.textContent = goal.label;
    btn.addEventListener("click", () => {
      sound.click();
      if (state.goals.has(goal.id)) state.goals.delete(goal.id);
      else state.goals.add(goal.id);
      btn.classList.toggle("on", state.goals.has(goal.id));
      els.startBtn.disabled = state.goals.size === 0;
    });
    els.goalGrid.appendChild(btn);
  }
}

async function runBoot() {
  const steps = ["Starting Cloudy", "Warming up voice", "Ready for you"];
  els.bootSteps.innerHTML = "";
  const rows = steps.map((label) => {
    const row = document.createElement("div");
    row.className = "boot-step";
    row.innerHTML = `<span>${label}</span><b>…</b>`;
    els.bootSteps.appendChild(row);
    return row;
  });
  sound.startup();
  await sound.humStart();
  for (const row of rows) {
    row.classList.add("on");
    await wait(320);
    row.classList.remove("on");
    row.classList.add("done");
    row.querySelector("b").textContent = "OK";
    sound.click();
  }
  await wait(250);
}

async function enableVoice() {
  await sound.unlock();
  await voice.start({ speech: true });
  els.micBtn.setAttribute("aria-pressed", "true");
  els.micBtn.classList.add("live");
  els.voiceLive.textContent = "READY";
  sound.listen();
  setAiState("listening");
  log("Voice is ready", "ok");
  window.setTimeout(() => {
    if (!state.busy) setAiState("idle");
  }, 700);
}

async function toggleVoice() {
  try {
    if (voice.active) {
      interruptCloudy("voice-off");
      voice.stop();
      sound.humStop();
      els.micBtn.setAttribute("aria-pressed", "false");
      els.micBtn.classList.remove("live");
      els.voiceLive.textContent = "STANDBY";
      setAiState("idle");
      return;
    }
    await enableVoice();
    await sound.humStart();
  } catch (error) {
    log(error instanceof Error ? error.message : "Mic blocked", "err");
    els.streamPanel.classList.add("show");
    els.streamPanel.textContent =
      "I couldn't access the microphone. You can still type, and we can talk that way.";
  }
}

function showHud() {
  els.boot.hidden = true;
  const seen = localStorage.getItem("cloudy_onboarded") === "1";
  if (!seen) {
    els.onboarding.hidden = false;
    els.hud.hidden = true;
  } else {
    els.onboarding.hidden = true;
    els.hud.hidden = false;
    document.body.dataset.mode = "live";
    setAiState("idle");
    core.resize();
    greetQuietly();
  }
}

function greetQuietly() {
  els.streamPanel.classList.add("show");
  els.streamPanel.innerHTML = "<p>Hi Mukundi — I'm here when you need me.</p>";
  log("Welcome back", "ok");
}

function openStage(stage) {
  els.stageTitle.textContent = stage.name;
  els.stageBody.innerHTML = `<ul>${stage.detail.map((d) => `<li>${d}</li>`).join("")}</ul>`;
  els.stageModal.hidden = false;
  sound.click();
  core.burst(0.5);
}

async function handlePrompt(prompt) {
  const text = prompt.trim();
  if (!text) return;

  // If a turn is in flight, interrupt it and take the new message
  if (state.busy) interruptCloudy("new-message");

  state.session += 1;
  const session = state.session;
  state.busy = true;
  els.sendBtn.disabled = true;
  voice.stopSpeech();

  abortController = new AbortController();
  const { signal } = abortController;

  // Avoid TTS echoing into barge-in for a brief moment after we start speaking
  ignoreMicUntil = performance.now() + 450;

  els.crmBoard.classList.remove("show");
  els.crmBoard.hidden = true;

  const kind = detectExperience(text);
  state.history.push({ role: "user", content: text });
  setAiState(kind === "greeting" || kind === "help" ? "writing" : "thinking");
  core.burst(0.5);
  bumpMeters(0.4);

  const hooks = {
    stack,
    crmBoard: els.crmBoard,
    crmStages: els.crmStages,
    streamPanel: els.streamPanel,
    weatherDock: els.weatherDock,
    weatherScene,
    bg,
    prompt: text,
    history: state.history,
    signal,
    speech,
    onState: (s) => {
      if (session !== state.session) return;
      setAiState(s);
      if (s === "speaking") ignoreMicUntil = performance.now() + 350;
    },
    onLog: log,
    onOpenStage: openStage,
    onMeters: (m) => {
      if (m.cpu != null) setMeter("cpu", m.cpu);
      if (m.mem != null) setMeter("mem", m.mem);
      if (m.net != null) setMeter("net", m.net);
      if (m.neu != null) setMeter("neu", m.neu);
    },
    onTokens: () => bumpMeters(0.35 + Math.random() * 0.25),
    onSpeechLevel: (v) => {
      core.setLevel(v);
      core.setSpeech(v);
      bg.setEnergy(v);
    },
    sound,
  };

  try {
    const result = await runConversation(kind, hooks);
    if (session !== state.session) return;
    if (!result?.aborted) {
      const reply = els.streamPanel.innerText?.trim();
      if (reply) state.history.push({ role: "assistant", content: reply });
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
    els.streamPanel.classList.add("show");
    els.streamPanel.textContent =
      "I'm having trouble connecting to my AI engine. Let me try again — or tell me another way I can help.";
    setAiState("speaking");
    await speech.speak(
      "I'm having trouble connecting to my AI engine. Let me try again, or tell me another way I can help.",
    );
    setAiState("idle");
    log("Recovered from a failed reply", "warn");
  } finally {
    if (session === state.session) {
      state.busy = false;
      els.sendBtn.disabled = false;
      els.prompt.value = "";
      if (voice.active) voice.startSpeech();
      bumpMeters(0.12);
      if (state.ai === "writing" || state.ai === "thinking" || state.ai === "speaking") {
        setAiState("idle");
      }
    }
  }
}

function uiLoop(now) {
  drawVoiceWave(els.voiceWave, latestTimeData, latestEnergy);
  drawMiniMap(els.mapCanvas, now);
  drawBrain(
    els.brainCanvas,
    latestEnergy,
    state.ai === "thinking" || state.ai === "searching" || state.ai === "planning",
  );
  requestAnimationFrame(uiLoop);
}

els.composer.addEventListener("submit", (e) => {
  e.preventDefault();
  void handlePrompt(els.prompt.value);
});

els.micBtn.addEventListener("click", () => void toggleVoice());
els.voiceToggle.addEventListener("click", () => void toggleVoice());
els.closeStage.addEventListener("click", () => {
  els.stageModal.hidden = true;
});
els.enableMic.addEventListener("click", async () => {
  try {
    els.bootNote.textContent = "";
    await enableVoice();
    showHud();
  } catch (error) {
    els.bootNote.textContent =
      error instanceof Error ? error.message : "Microphone permission required.";
  }
});
els.startBtn.addEventListener("click", () => {
  const labels = [...state.goals]
    .map((id) => GOALS.find((g) => g.id === id)?.label)
    .filter(Boolean);
  localStorage.setItem("cloudy_onboarded", "1");
  localStorage.setItem("cloudy_goals", labels.join(" · "));
  els.onboarding.hidden = true;
  els.hud.hidden = false;
  document.body.dataset.mode = "live";
  sound.done();
  core.resize();
  void handlePrompt("Hi");
});

$("globalSearch")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const q = e.target.value.trim();
    if (q) void handlePrompt(q);
  }
});

renderNav();
renderModes();
renderForecast();
renderGoals();
tickClock();
setInterval(tickClock, 1000);
requestAnimationFrame(uiLoop);
setMeter("cpu", 28);
setMeter("mem", 46);
setMeter("net", 62);
setMeter("neu", 71);

void (async () => {
  els.hud.hidden = true;
  els.onboarding.hidden = true;
  await runBoot();
  try {
    await enableVoice();
    showHud();
  } catch {
    els.enableMic.hidden = false;
    els.bootNote.textContent =
      "Allow the microphone for voice conversation — or continue by typing.";
    // Still enter the UI so typing works even without mic
    window.setTimeout(() => {
      if (!els.enableMic.hidden) {
        els.boot.hidden = true;
        const seen = localStorage.getItem("cloudy_onboarded") === "1";
        if (seen) {
          els.hud.hidden = false;
          greetQuietly();
        } else {
          els.onboarding.hidden = false;
        }
      }
    }, 10);
  }
})();
