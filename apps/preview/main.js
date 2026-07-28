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
  createCardStack,
  runCrmMission,
  runWeatherExperience,
  runSearchExperience,
  runGeneralExperience,
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
  lastSpeechAt: 0,
  pendingTranscript: "",
};

const bg = createBackground(els.bgCanvas);
const weatherScene = createWeatherScene(els.weatherCanvas);
const core = createIntelligenceCore(els.coreCanvas);
const sound = createSoundscape();
const stack = createCardStack(els.liveStack);

let latestTimeData = null;
let latestEnergy = 0;

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
    log("Clap / pulse detected", "warn");
    if (!state.busy) setAiState("listening");
  },
  onTranscript: (text, isFinal) => {
    if (!text) return;
    els.prompt.value = text;
    state.pendingTranscript = text;
    state.lastSpeechAt = performance.now();
    if (!isFinal && !state.busy) setAiState("listening");
  },
  onSpeechEnd: (text) => {
    if (state.busy) return;
    const cleaned = text.trim();
    if (cleaned.length < 2) return;
    // Avoid double-fire: small debounce via busy flag in handlePrompt
    void handlePrompt(cleaned);
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
    idle: "Ready",
    listening: "Hearing you",
    thinking: "Neural surge",
    searching: "Scanning layers",
    planning: "Structuring",
    writing: "Streaming",
    speaking: "Voicing reply",
    weather: "Atmosphere live",
  };
  els.coreHint.textContent = hints[key] || "In progress";
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
  const item = document.createElement("div");
  item.className = `log-item ${level}`;
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  item.innerHTML = `<time>${ts}</time><span>${message}</span><span class="tag">${level}</span>`;
  els.activityLog.prepend(item);
  while (els.activityLog.children.length > 24) els.activityLog.lastChild?.remove();
}

function setPipeline(label) {
  if (!label) return;
  log(label, "ok");
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
      log(`Nav · ${label}`, "ok");
      if (label === "Projects") els.prompt.value = "Build me a CRM";
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
      setAiState("thinking");
      log(`Mode · ${mode.title}`, "ok");
      window.setTimeout(() => {
        if (!state.busy) setAiState(voice.active ? "listening" : "idle");
      }, 700);
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
  const steps = [
    "Initializing Core",
    "Loading Memory",
    "Calibrating Sensors",
    "Connecting Intelligence Engine",
  ];
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
    await wait(420);
    row.classList.remove("on");
    row.classList.add("done");
    row.querySelector("b").textContent = "OK";
    sound.click();
  }
  await wait(350);
}

async function enableVoice() {
  await sound.unlock();
  await voice.start({ speech: true });
  els.micBtn.setAttribute("aria-pressed", "true");
  els.micBtn.classList.add("live");
  els.voiceLive.textContent = "READY";
  sound.listen();
  setAiState("listening");
  log("Live sensors online", "ok");
  window.setTimeout(() => {
    if (!state.busy) setAiState("idle");
  }, 800);
}

async function toggleVoice() {
  try {
    if (voice.active) {
      voice.stop();
      sound.humStop();
      els.micBtn.setAttribute("aria-pressed", "false");
      els.micBtn.classList.remove("live");
      els.voiceLive.textContent = "STANDBY";
      setAiState("idle");
      log("Voice offline", "warn");
      return;
    }
    await enableVoice();
    await sound.humStart();
  } catch (error) {
    log(error instanceof Error ? error.message : "Mic blocked", "err");
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
    log("Welcome back, Mukundi", "ok");
  }
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
  if (!text || state.busy) return;
  state.busy = true;
  els.sendBtn.disabled = true;
  voice.stopSpeech();
  els.crmBoard.classList.remove("show");
  els.crmBoard.hidden = true;

  const kind = detectExperience(text);
  log(`Query · ${text.slice(0, 48)}`, "ok");
  setPipeline("Intent Recognised");
  setAiState("thinking");
  core.burst(0.8);
  bumpMeters(0.5);

  const hooks = {
    stack,
    crmBoard: els.crmBoard,
    crmStages: els.crmStages,
    streamPanel: els.streamPanel,
    weatherDock: els.weatherDock,
    weatherScene,
    bg,
    prompt: text,
    onState: setAiState,
    onPipeline: setPipeline,
    onLog: log,
    onOpenStage: openStage,
    onMeters: (m) => {
      if (m.cpu != null) setMeter("cpu", m.cpu);
      if (m.mem != null) setMeter("mem", m.mem);
      if (m.net != null) setMeter("net", m.net);
      if (m.neu != null) setMeter("neu", m.neu);
    },
    onTokens: () => bumpMeters(0.4 + Math.random() * 0.3),
    onSpeechLevel: (v) => {
      core.setLevel(v);
      core.setSpeech(v);
      bg.setEnergy(v);
    },
    sound,
  };

  try {
    if (kind === "crm") await runCrmMission(hooks);
    else if (kind === "weather") await runWeatherExperience(hooks);
    else if (kind === "search") await runSearchExperience(hooks);
    else await runGeneralExperience(hooks);
  } catch (error) {
    log(error instanceof Error ? error.message : "Response failed", "err");
    els.streamPanel.classList.add("show");
    els.streamPanel.textContent =
      "Something failed while generating a response. Sensors are still live — try again.";
    setAiState("idle");
  } finally {
    state.busy = false;
    els.sendBtn.disabled = false;
    els.prompt.value = "";
    if (voice.active) voice.startSpeech();
    bumpMeters(0.15);
  }
}

// Ambient UI loops
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
  log("Workspace configured", "ok");
  setAiState("idle");
});

$("globalSearch")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const q = e.target.value.trim();
    if (q) void handlePrompt(q);
  }
});

// Suggestion chips via placeholder cycling / quick demos on first load
window.addEventListener("load", () => {
  // Prefill nothing; expose suggestions in log
  SUGGESTIONS.forEach((s) => log(`Try · ${s}`, "ok"));
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
      "Allow the microphone so the AI Core reacts to voice, claps, and ambient sound.";
  }
})();
