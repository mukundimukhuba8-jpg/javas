import {
  GOALS,
  MEMORY_SEED,
  PIPELINE,
  SIDE_LINKS,
  SUGGESTIONS,
  detectExperience,
} from "./js/data.js";
import { createBackground } from "./js/background.js";
import { createIntelligenceCore } from "./js/core.js";
import { createSoundscape } from "./js/sound.js";
import { createVoiceSensor } from "./js/voice.js";
import {
  runCrmMission,
  runGeneralExperience,
  runSearchExperience,
  runWeatherExperience,
} from "./js/experiences.js";

const els = {
  boot: document.getElementById("boot"),
  bootLines: document.getElementById("bootLines"),
  bootWelcome: document.getElementById("bootWelcome"),
  enableAudioBtn: document.getElementById("enableAudioBtn"),
  bootNote: document.getElementById("bootNote"),
  onboarding: document.getElementById("onboarding"),
  app: document.getElementById("app"),
  goalGrid: document.getElementById("goalGrid"),
  goalCount: document.getElementById("goalCount"),
  startBtn: document.getElementById("startBtn"),
  confirmLine: document.getElementById("confirmLine"),
  sideNav: document.getElementById("sideNav"),
  coreCanvas: document.getElementById("coreCanvas"),
  bgCanvas: document.getElementById("bgCanvas"),
  coreState: document.getElementById("coreState"),
  coreHint: document.getElementById("coreHint"),
  thinkLine: document.getElementById("thinkLine"),
  intelCore: document.getElementById("intelCore"),
  micBadge: document.getElementById("micBadge"),
  coreSection: document.getElementById("coreSection"),
  chatSection: document.getElementById("chatSection"),
  chatStream: document.getElementById("chatStream"),
  panelView: document.getElementById("panelView"),
  composer: document.getElementById("composer"),
  prompt: document.getElementById("prompt"),
  sendBtn: document.getElementById("sendBtn"),
  statusPill: document.getElementById("statusPill"),
  suggestions: document.getElementById("suggestions"),
  currentTask: document.getElementById("currentTask"),
  pipeline: document.getElementById("pipeline"),
  memoryPanel: document.getElementById("memoryPanel"),
  voiceBtn: document.getElementById("voiceBtn"),
  micEnergy: document.getElementById("micEnergy"),
  aThink: document.getElementById("aThink"),
  aMemory: document.getElementById("aMemory"),
  aSearch: document.getElementById("aSearch"),
  aTools: document.getElementById("aTools"),
  aGen: document.getElementById("aGen"),
  sysCpu: document.getElementById("sysCpu"),
  sysTokens: document.getElementById("sysTokens"),
  sysLatency: document.getElementById("sysLatency"),
  stageModal: document.getElementById("stageModal"),
  stageEyebrow: document.getElementById("stageEyebrow"),
  stageTitle: document.getElementById("stageTitle"),
  stageBody: document.getElementById("stageBody"),
  closeStage: document.getElementById("closeStage"),
};

const state = {
  goals: new Set(),
  busy: false,
  ai: "Idle",
};

const bg = createBackground(els.bgCanvas);
const core = createIntelligenceCore(els.coreCanvas);
const sound = createSoundscape();

const voice = createVoiceSensor({
  onLevel: (energy) => {
    els.micEnergy.textContent = `${Math.round(energy * 100)}%`;
    bg.setEnergy(Math.min(1, energy * 1.2));
    core.setLevel(energy);

    const hearing = energy > 0.04;
    els.micBadge.hidden = !hearing && state.ai !== "Listening";

    // Always visually respond to sound, even mid-task
    if (hearing && !state.busy) {
      setAiState("Listening");
      setPipeline("Listening");
    } else if (!hearing && !state.busy && state.ai === "Listening") {
      setAiState("Idle");
      setPipeline(null);
      els.micBadge.hidden = true;
    } else if (hearing && state.busy) {
      // Keep core reactive during missions
      core.setLevel(Math.max(energy, 0.25));
      els.micBadge.hidden = false;
    }
  },
  onClap: (energy) => {
    sound.listen();
    core.setLevel(Math.max(energy, 0.9));
    bg.setEnergy(1);
    els.micBadge.hidden = false;
    els.thinkLine.textContent = "Sound detected";
    if (!state.busy) {
      setAiState("Listening");
      setPipeline("Voice Recognition");
      window.setTimeout(() => {
        if (!state.busy) setPipeline("Listening");
      }, 450);
    }
  },
});

function setAiState(label) {
  state.ai = label;
  els.coreState.textContent = label === "Weather" ? "Weather" : label;
  els.statusPill.textContent = label === "Weather" ? "Weather" : label;
  els.intelCore.dataset.state = label.toLowerCase();
  core.setState(label.toLowerCase());

  const hints = {
    Idle: "Ready when you are",
    Listening: "Hearing you in real time",
    Thinking: "Working through the request",
    Searching: "Scanning knowledge and tools",
    Planning: "Structuring the approach",
    Coding: "Preparing implementation detail",
    Writing: "Streaming the answer",
    Speaking: "Responding out loud",
    Weather: "Live conditions loaded",
    Finished: "Ready for the next step",
  };
  els.coreHint.textContent = hints[label] || "In progress";
  els.sysCpu.textContent =
    label === "Idle" || label === "Finished" ? "3%" : `${16 + Math.floor(Math.random() * 24)}%`;
}

function setPipeline(active) {
  const order = PIPELINE;
  const activeIndex = active ? order.indexOf(active) : -1;
  els.pipeline.querySelectorAll("li").forEach((li, idx) => {
    li.classList.remove("active", "done");
    if (activeIndex === -1) return;
    if (idx < activeIndex) li.classList.add("done");
    if (idx === activeIndex) li.classList.add("active");
  });
}

function setActivity(partial = {}) {
  const map = {
    think: els.aThink,
    memory: els.aMemory,
    search: els.aSearch,
    tools: els.aTools,
    gen: els.aGen,
  };
  for (const [key, el] of Object.entries(map)) {
    if (partial[key] !== undefined) el.textContent = partial[key];
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBootSequence() {
  const stages = [
    { label: "Initializing Core...", target: 41, ms: 700 },
    { label: "Loading Memory...", target: 78, ms: 700 },
    { label: "Connecting Intelligence Engine...", target: 100, ms: 650 },
  ];

  els.bootLines.innerHTML = "";
  const rows = stages.map((stage) => {
    const row = document.createElement("div");
    row.className = "boot-row";
    row.innerHTML = `
      <div class="label"><span>${stage.label}</span><b>0%</b></div>
      <div class="boot-bar"><span></span></div>
    `;
    els.bootLines.appendChild(row);
    return { row, stage };
  });

  const checks = document.createElement("ul");
  checks.className = "boot-checks";
  checks.innerHTML = `
    <li data-check>Voice Online</li>
    <li data-check>Knowledge Loaded</li>
    <li data-check>Memory Synced</li>
    <li data-check>Agents Ready</li>
  `;
  els.bootLines.appendChild(checks);

  sound.startup();
  await sound.humStart();

  for (const { row, stage } of rows) {
    row.classList.add("show");
    const pct = row.querySelector("b");
    const bar = row.querySelector(".boot-bar > span");
    const steps = 12;
    for (let i = 1; i <= steps; i += 1) {
      const value = Math.round((stage.target * i) / steps);
      pct.textContent = `${value}%`;
      bar.style.width = `${value}%`;
      await wait(stage.ms / steps);
    }
    sound.click();
  }

  for (const li of checks.querySelectorAll("li")) {
    li.classList.add("show");
    await wait(180);
  }

  els.bootWelcome.hidden = false;
  await wait(700);
}

async function enableVoice() {
  await sound.unlock();
  await voice.start();
  els.voiceBtn.setAttribute("aria-pressed", "true");
  sound.listen();
  setAiState("Listening");
  setPipeline("Listening");
  window.setTimeout(() => {
    if (!state.busy) {
      setAiState("Idle");
      setPipeline(null);
    }
  }, 900);
}

async function finishBootIntoApp() {
  els.boot.hidden = true;
  const seen = localStorage.getItem("cloudy_onboarded") === "1";
  if (!seen) {
    els.onboarding.hidden = false;
    els.app.hidden = true;
  } else {
    els.onboarding.hidden = true;
    els.app.hidden = false;
    renderMemory(localStorage.getItem("cloudy_goals") || "Custom workspace");
    // Retrigger core enter animation
    els.intelCore.classList.remove("core-enter");
    void els.intelCore.offsetWidth;
    els.intelCore.classList.add("core-enter");
    setAiState("Idle");
  }
}

function renderGoals() {
  els.goalGrid.innerHTML = "";
  for (const goal of GOALS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "goal";
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = `<span class="emoji">${goal.emoji}</span><span class="label">${goal.label}</span>`;
    btn.addEventListener("click", () => {
      sound.click();
      if (state.goals.has(goal.id)) state.goals.delete(goal.id);
      else state.goals.add(goal.id);
      btn.setAttribute("aria-pressed", String(state.goals.has(goal.id)));
      els.goalCount.textContent = `${state.goals.size} selected`;
      els.startBtn.disabled = state.goals.size === 0;
    });
    els.goalGrid.appendChild(btn);
  }
}

function renderSideNav() {
  els.sideNav.innerHTML = "";
  for (const label of SIDE_LINKS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "side-link";
    btn.textContent = label;
    if (label === "Home") btn.classList.add("is-active");
    btn.addEventListener("click", () => {
      sound.click();
      els.sideNav.querySelectorAll(".side-link").forEach((el) => {
        el.classList.toggle("is-active", el.textContent === label);
      });
      if (label === "Chat" || label === "Home") showChatWorkspace();
      else showPanel(label);
    });
    els.sideNav.appendChild(btn);
  }
}

function renderPipeline() {
  els.pipeline.innerHTML = PIPELINE.map(
    (step) => `<li data-step="${step}"><span class="tick">✓</span><span>${step}</span></li>`,
  ).join("");
}

function renderMemory(goalsText) {
  const items = MEMORY_SEED.map((item) =>
    item.title === "Goals" ? { ...item, body: goalsText || item.body } : item,
  );
  els.memoryPanel.innerHTML = items
    .map(
      (item) =>
        `<div class="memory-item"><strong>${item.title}</strong><span>${item.body}</span></div>`,
    )
    .join("");
}

function renderSuggestions() {
  els.suggestions.innerHTML = "";
  for (const text of SUGGESTIONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suggestion";
    btn.textContent = text;
    btn.addEventListener("click", () => {
      els.prompt.value = text;
      els.prompt.focus();
    });
    els.suggestions.appendChild(btn);
  }
}

function showChatWorkspace() {
  els.panelView.hidden = true;
  els.chatSection.hidden = els.chatStream.children.length === 0;
  els.coreSection.hidden = els.chatStream.children.length > 0;
}

function showPanel(label) {
  els.coreSection.hidden = true;
  els.chatSection.hidden = true;
  els.panelView.hidden = false;
  const cards =
    {
      Projects: [
        ["CRM Mission", "Architecture in progress"],
        ["Trading SaaS", "Queued"],
      ],
      Knowledge: [
        ["Vision", "Live project brain"],
        ["Decisions", "Updated during missions"],
      ],
      Voice: [
        ["Live reactivity", "Mic + clap"],
        ["Style", "Natural · interruptible"],
      ],
      Settings: [
        ["Wake Word", "Hey Cloudy"],
        ["Appearance", "Graphite glass"],
        ["Voice", "Realtime core response"],
      ],
    }[label] || [["Cloudy", "Premium AI operating system"]];

  els.panelView.innerHTML = `
    <h1 style="margin:0 0 1rem;font-size:1.4rem;font-weight:700;letter-spacing:-0.02em">${label}</h1>
    <div class="panel-grid">
      ${cards
        .map(([title, desc]) => `<article class="card"><h3>${title}</h3><p>${desc}</p></article>`)
        .join("")}
    </div>
  `;
}

function openStage(stage) {
  els.stageEyebrow.textContent = "Mission stage";
  els.stageTitle.textContent = stage.name;
  els.stageBody.innerHTML = `<ul>${stage.detail.map((d) => `<li>${d}</li>`).join("")}</ul>`;
  els.stageModal.hidden = false;
  sound.click();
}

async function enterAppFromOnboarding() {
  const labels = [...state.goals]
    .map((id) => GOALS.find((g) => g.id === id)?.label)
    .filter(Boolean);
  els.confirmLine.hidden = false;
  els.startBtn.disabled = true;
  localStorage.setItem("cloudy_onboarded", "1");
  localStorage.setItem("cloudy_goals", labels.join(" · ") || "Custom workspace");
  await wait(850);
  els.onboarding.hidden = true;
  els.app.hidden = false;
  renderMemory(labels.join(" · ") || "Custom workspace");
  setAiState("Idle");
  setPipeline(null);
  setActivity({ think: "—", memory: "ready", search: "—", tools: "—", gen: "—" });
  els.currentTask.textContent = "Waiting for input";
}

async function handlePrompt(prompt) {
  const text = prompt.trim();
  if (!text || state.busy) return;
  state.busy = true;
  els.sendBtn.disabled = true;
  els.suggestions.hidden = true;
  els.coreSection.hidden = true;
  els.panelView.hidden = true;
  els.chatSection.hidden = false;

  const kind = detectExperience(text);
  els.currentTask.textContent =
    kind === "crm"
      ? "Build CRM mission"
      : kind === "weather"
        ? "Weather briefing"
        : kind === "search"
          ? "Knowledge search"
          : "Planning response";

  const working = els.memoryPanel.querySelector(".memory-item span");
  if (working) working.textContent = text;

  const hooks = {
    chatStream: els.chatStream,
    onState: setAiState,
    onPipeline: setPipeline,
    onActivity: setActivity,
    onTokens: (tokens, latency) => {
      els.sysTokens.textContent = String(tokens);
      els.sysLatency.textContent = `${latency} ms`;
    },
    onLine: (line) => {
      els.thinkLine.textContent = line;
    },
    onOpenStage: openStage,
    sound,
  };

  try {
    setPipeline("Understanding Intent");
    if (kind === "crm") await runCrmMission(hooks);
    else if (kind === "weather") await runWeatherExperience(hooks);
    else if (kind === "search") await runSearchExperience({ ...hooks, prompt: text });
    else await runGeneralExperience({ ...hooks, prompt: text });

    const items = els.memoryPanel.querySelectorAll(".memory-item");
    if (items[1]) items[1].querySelector("span").textContent = els.currentTask.textContent;
    if (items[2]) items[2].querySelector("span").textContent = els.currentTask.textContent;
  } finally {
    state.busy = false;
    els.sendBtn.disabled = false;
    els.prompt.value = "";
    els.prompt.focus();
    els.thinkLine.textContent = "";
    if (voice.active) {
      setAiState("Idle");
      setPipeline(null);
    }
  }
}

els.voiceBtn.addEventListener("click", async () => {
  try {
    if (voice.active) {
      voice.stop();
      sound.humStop();
      els.voiceBtn.setAttribute("aria-pressed", "false");
      els.micBadge.hidden = true;
      setAiState("Idle");
      setPipeline(null);
      return;
    }
    await enableVoice();
    await sound.humStart();
  } catch (error) {
    els.voiceBtn.setAttribute("aria-pressed", "false");
    els.thinkLine.textContent =
      error instanceof Error ? error.message : "Microphone permission required";
  }
});

els.enableAudioBtn.addEventListener("click", async () => {
  try {
    els.bootNote.textContent = "";
    await enableVoice();
    await finishBootIntoApp();
  } catch (error) {
    els.bootNote.textContent =
      error instanceof Error ? error.message : "Microphone permission is required for live core.";
  }
});

document.querySelectorAll(".top-link").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".top-link").forEach((el) => el.classList.remove("is-active"));
    btn.classList.add("is-active");
    if (btn.dataset.route === "home") showChatWorkspace();
    else showPanel(btn.textContent?.trim() || "Workspace");
  });
});

els.composer.addEventListener("submit", (e) => {
  e.preventDefault();
  void handlePrompt(els.prompt.value);
});

els.prompt.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    void handlePrompt(els.prompt.value);
  }
});

els.startBtn.addEventListener("click", () => void enterAppFromOnboarding());
els.closeStage.addEventListener("click", () => {
  els.stageModal.hidden = true;
});

renderGoals();
renderSideNav();
renderPipeline();
renderMemory();
renderSuggestions();

// Boot first — never jump straight into chat
els.onboarding.hidden = true;
els.app.hidden = true;
void (async () => {
  await runBootSequence();
  // Prefer auto mic; if blocked, show enable button on boot card
  try {
    await enableVoice();
    await finishBootIntoApp();
  } catch {
    els.enableAudioBtn.hidden = false;
    els.bootNote.textContent =
      "Allow the microphone so the intelligence core can react to voice and claps.";
  }
})();
