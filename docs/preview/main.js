import {
  AI_STATES,
  GOALS,
  MEMORY_SEED,
  SIDE_LINKS,
  SUGGESTIONS,
  planFor,
} from "./js/data.js";
import { createIntelligenceCore } from "./js/core.js";
import { runClaudeStyleTurn } from "./js/chat.js";

const els = {
  onboarding: document.getElementById("onboarding"),
  app: document.getElementById("app"),
  goalGrid: document.getElementById("goalGrid"),
  goalCount: document.getElementById("goalCount"),
  startBtn: document.getElementById("startBtn"),
  confirmLine: document.getElementById("confirmLine"),
  sideNav: document.getElementById("sideNav"),
  coreCanvas: document.getElementById("coreCanvas"),
  coreState: document.getElementById("coreState"),
  coreHint: document.getElementById("coreHint"),
  intelCore: document.getElementById("intelCore"),
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
  statusList: document.getElementById("statusList"),
  memoryPanel: document.getElementById("memoryPanel"),
  aThink: document.getElementById("aThink"),
  aMemory: document.getElementById("aMemory"),
  aSearch: document.getElementById("aSearch"),
  aTools: document.getElementById("aTools"),
  aGen: document.getElementById("aGen"),
  sysCpu: document.getElementById("sysCpu"),
  sysTokens: document.getElementById("sysTokens"),
  sysLatency: document.getElementById("sysLatency"),
};

const state = {
  goals: new Set(),
  busy: false,
};

const core = createIntelligenceCore(els.coreCanvas);

function setAiState(label) {
  const normalized = label || "Idle";
  els.coreState.textContent = normalized;
  els.statusPill.textContent = normalized;
  els.intelCore.dataset.state = normalized.toLowerCase();
  core.setState(normalized.toLowerCase());

  const hints = {
    Idle: "Ready when you are",
    Thinking: "Working through the request",
    Researching: "Gathering relevant context",
    Planning: "Structuring the approach",
    Coding: "Preparing implementation detail",
    Searching: "Looking through knowledge",
    Learning: "Updating memory pathways",
    Executing: "Running tools and actions",
    Writing: "Composing the answer",
    Finished: "Ready for the next step",
  };
  els.coreHint.textContent = hints[normalized] || "In progress";

  els.statusList.querySelectorAll("li").forEach((li) => {
    li.classList.toggle("is-on", li.dataset.state === normalized);
  });

  if (normalized === "Idle" || normalized === "Finished") {
    els.sysCpu.textContent = "4%";
  } else {
    els.sysCpu.textContent = `${18 + Math.floor(Math.random() * 22)}%`;
  }
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

function renderGoals() {
  els.goalGrid.innerHTML = "";
  for (const goal of GOALS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "goal";
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = `<span class="emoji">${goal.emoji}</span><span class="label">${goal.label}</span>`;
    btn.addEventListener("click", () => {
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
      els.sideNav.querySelectorAll(".side-link").forEach((el) => {
        el.classList.toggle("is-active", el.textContent === label);
      });
      if (label === "Chat" || label === "Home") showChatWorkspace();
      else showPanel(label);
    });
    els.sideNav.appendChild(btn);
  }
}

function renderStatusList() {
  els.statusList.innerHTML = AI_STATES.map((s) => `<li data-state="${s}">${s}</li>`).join("");
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
  els.composer.parentElement.hidden = false;
}

function showPanel(label) {
  els.coreSection.hidden = true;
  els.chatSection.hidden = true;
  els.panelView.hidden = false;

  const content = {
    Projects: [
      ["Trading SaaS", "Scaffolded workspace"],
      ["CRM", "Awaiting first build"],
      ["Client Portal", "Draft"],
    ],
    Knowledge: [
      ["Vision", "Living project brain"],
      ["Roadmap", "Updated as Cloudy works"],
      ["Decisions", "Architecture choices"],
    ],
    Tasks: [
      ["Define MVP slice", "Todo"],
      ["Design data model", "In progress"],
      ["Wire auth", "Queued"],
    ],
    Agents: [
      ["CEO Agent", "Strategy · approvals"],
      ["Developer Agent", "Implementation"],
      ["Research Agent", "Discovery"],
    ],
    Automation: [
      ["Signup → onboarding", "Ready"],
      ["Weekly recap", "Scheduled"],
    ],
    Documents: [
      ["PRD", "Knowledge"],
      ["API outline", "Knowledge"],
    ],
    Code: [
      ["apps/web", "Next.js"],
      ["services/api", "Node"],
    ],
    Voice: [
      ["Wake word", "Hey Cloudy"],
      ["Style", "Conversational · interruptible"],
    ],
    Analytics: [
      ["Latency", "Live"],
      ["Tokens", "Session counter"],
    ],
    Marketplace: [
      ["Skill packs", "Coming online"],
      ["Agent templates", "Browse"],
    ],
    Settings: [
      ["Profile", "Workspace identity"],
      ["Wake Word", "Hey Cloudy"],
      ["AI Models", "Claude-class routing"],
      ["API Keys", "Secure vault"],
      ["Memory Controls", "Retention & privacy"],
      ["Appearance", "Graphite · glass"],
    ],
  };

  const cards = content[label] || [["Cloudy", "Premium operating workspace"]];
  els.panelView.innerHTML = `
    <h1 style="margin:0 0 1rem;font-size:1.4rem;font-weight:700;letter-spacing:-0.02em">${label}</h1>
    <div class="panel-grid">
      ${cards
        .map(([title, desc]) => `<article class="card"><h3>${title}</h3><p>${desc}</p></article>`)
        .join("")}
    </div>
  `;
}

async function enterApp() {
  const labels = [...state.goals]
    .map((id) => GOALS.find((g) => g.id === id)?.label)
    .filter(Boolean);
  els.confirmLine.hidden = false;
  els.startBtn.disabled = true;
  await wait(900);
  els.onboarding.hidden = true;
  els.app.hidden = false;
  renderMemory(labels.join(" · ") || "Custom workspace");
  setAiState("Idle");
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

  const plan = planFor(text);
  els.currentTask.textContent = plan.task;
  const working = els.memoryPanel.querySelector(".memory-item span");
  if (working) working.textContent = text;

  try {
    await runClaudeStyleTurn({
      prompt: text,
      plan,
      chatStream: els.chatStream,
      onState: setAiState,
      onActivity: (a) => setActivity(a),
      onTokens: (tokens, latency) => {
        els.sysTokens.textContent = String(tokens);
        els.sysLatency.textContent = `${latency} ms`;
      },
    });
    const items = els.memoryPanel.querySelectorAll(".memory-item");
    if (items[1]) items[1].querySelector("span").textContent = plan.task;
    if (items[2]) items[2].querySelector("span").textContent = plan.task;
  } finally {
    state.busy = false;
    els.sendBtn.disabled = false;
    els.prompt.value = "";
    els.prompt.focus();
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

els.startBtn.addEventListener("click", () => {
  void enterApp();
});

els.app.hidden = true;
els.onboarding.hidden = false;
renderGoals();
renderSideNav();
renderStatusList();
renderMemory();
renderSuggestions();
setAiState("Idle");
