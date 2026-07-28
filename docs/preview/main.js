import {
  AGENTS,
  BUILD_STEPS,
  GOALS,
  INTEGRATIONS,
  KNOWLEDGE,
  KNOWLEDGE_BODY,
  NAV,
  PORTALS,
  SETTINGS,
  SKILLS,
} from "./js/data.js";
import { createWakeController } from "./js/wake.js";
import { createWorld } from "./js/world.js";

const state = {
  goals: new Set(),
  view: "world",
  knowledgeTab: "Vision",
  world: null,
};

const els = {
  body: document.body,
  gate: document.getElementById("gate"),
  gateNote: document.getElementById("gateNote"),
  enableBtn: document.getElementById("enableBtn"),
  enterBtn: document.getElementById("enterBtn"),
  wakeStage: document.getElementById("wakeStage"),
  orb: document.getElementById("orb"),
  wakeTranscript: document.getElementById("wakeTranscript"),
  goalGrid: document.getElementById("goalGrid"),
  selectionCount: document.getElementById("selectionCount"),
  confirmGoals: document.getElementById("confirmGoals"),
  welcomeLine: document.getElementById("welcomeLine"),
  railNav: document.getElementById("railNav"),
  viewKicker: document.getElementById("viewKicker"),
  viewTitle: document.getElementById("viewTitle"),
  goalChip: document.getElementById("goalChip"),
  inspectorBody: document.getElementById("inspectorBody"),
  buildBtn: document.getElementById("buildBtn"),
  buildOverlay: document.getElementById("buildOverlay"),
  buildSteps: document.getElementById("buildSteps"),
  closeBuild: document.getElementById("closeBuild"),
  fx: document.getElementById("fx"),
};

function showScreen(name) {
  document.querySelectorAll("[data-screen-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.screenPanel !== name;
  });
  els.body.dataset.screen = name;
}

function setWakeState(wake) {
  els.body.dataset.wake = wake;
}

function inspect(title, fields) {
  els.inspectorBody.innerHTML = `
    <h3>${title}</h3>
    <dl>
      ${fields
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
        .join("")}
    </dl>
  `;
}

function renderGoals() {
  els.goalGrid.innerHTML = "";
  for (const goal of GOALS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "goal";
    btn.dataset.id = goal.id;
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = `<span class="emoji">${goal.emoji}</span><span class="label">${goal.label}</span>`;
    btn.addEventListener("click", () => {
      if (state.goals.has(goal.id)) state.goals.delete(goal.id);
      else state.goals.add(goal.id);
      btn.setAttribute("aria-pressed", String(state.goals.has(goal.id)));
      els.selectionCount.textContent = `${state.goals.size} selected`;
      els.confirmGoals.disabled = state.goals.size === 0;
    });
    els.goalGrid.appendChild(btn);
  }
}

function renderNav() {
  els.railNav.innerHTML = "";
  for (const item of NAV) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = item.label;
    btn.dataset.view = item.id;
    btn.addEventListener("click", () => setView(item.id));
    els.railNav.appendChild(btn);
  }
}

function setView(id) {
  state.view = id;
  const meta = NAV.find((n) => n.id === id);
  if (meta) {
    els.viewKicker.textContent = meta.kicker;
    els.viewTitle.textContent = meta.title;
  }
  document.querySelectorAll(".rail-nav button").forEach((btn) => {
    btn.setAttribute("aria-current", btn.dataset.view === id ? "page" : "false");
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.hidden = view.dataset.view !== id;
  });
  if (id === "world") ensureWorld();
}

function ensureWorld() {
  const host = document.getElementById("view-world");
  if (host.dataset.ready === "1") return;
  host.dataset.ready = "1";
  host.innerHTML = `
    <div class="world-canvas-wrap">
      <canvas id="worldCanvas"></canvas>
      <p class="world-hint">Drag to orbit · Click a node to open it</p>
    </div>
  `;
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("worldCanvas"));
  state.world = createWorld(canvas, {
    onSelect(node) {
      inspect(node.label, [
        ["Type", node.group],
        ["Node", node.id],
        ["Action", "Opened from the living neural graph"],
        ["Linked systems", "Projects · Agents · Memory · Tools"],
      ]);
      if (node.group === "agent") setView("configure");
      if (node.id === "integrations" || node.group === "integration") setView("integrations");
      if (node.id === "automations" || node.group === "automation") setView("automations");
      if (node.id === "documents" || node.group === "doc") setView("knowledge");
      if (node.id === "goals") setView("knowledge");
    },
  });
}

function renderConfigure() {
  const host = document.getElementById("view-configure");
  host.innerHTML = `<div class="card-grid"></div>`;
  const grid = host.querySelector(".card-grid");
  for (const agent of AGENTS) {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <h3>${agent.name}</h3>
      <p>${agent.personality}</p>
      <div class="tag-row">
        <span class="tag">${agent.model}</span>
        <span class="tag">Create</span>
      </div>
    `;
    card.addEventListener("click", () => {
      host.querySelectorAll(".card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      inspect(agent.name, [
        ["Personality", agent.personality],
        ["Model", agent.model],
        ["Permissions", agent.permissions],
        ["Memory", agent.memory],
        ["Goals", agent.goals],
        ["Tools", agent.tools],
      ]);
    });
    grid?.appendChild(card);
  }
}

function renderKnowledge() {
  const host = document.getElementById("view-knowledge");
  host.innerHTML = `
    <div class="knowledge-layout">
      <div class="knowledge-nav" id="knowledgeNav"></div>
      <div class="knowledge-body" id="knowledgeBody"></div>
    </div>
  `;
  const nav = host.querySelector("#knowledgeNav");
  const body = host.querySelector("#knowledgeBody");

  function paint(tab) {
    state.knowledgeTab = tab;
    nav?.querySelectorAll("button").forEach((btn) => {
      btn.setAttribute("aria-current", btn.dataset.tab === tab ? "true" : "false");
    });
    const content = KNOWLEDGE_BODY[tab];
    if (Array.isArray(content)) {
      body.innerHTML = `<h3>${tab}</h3><ul>${content.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    } else {
      body.innerHTML = `<h3>${tab}</h3><p class="muted">${content}</p>`;
    }
    inspect(tab, [
      ["Layer", "Project brain"],
      ["Updated by", "Cloudy · continuous"],
      ["Visibility", "Workspace + portals with permission"],
    ]);
  }

  for (const tab of KNOWLEDGE) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = tab;
    btn.dataset.tab = tab;
    btn.addEventListener("click", () => paint(tab));
    nav?.appendChild(btn);
  }
  paint("Vision");
}

function renderSkills() {
  const host = document.getElementById("view-skills");
  host.innerHTML = `<div class="card-grid"></div>`;
  const grid = host.querySelector(".card-grid");
  for (const skill of SKILLS) {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<h3>${skill}</h3><p>Reusable ability · attach to any agent</p><div class="tag-row"><span class="tag">Skill</span></div>`;
    card.addEventListener("click", () => {
      inspect(skill, [
        ["Type", "Reusable skill"],
        ["Attach to", "Developer · Designer · Marketing · Research"],
        ["Output", "Artifacts + knowledge updates"],
      ]);
    });
    grid?.appendChild(card);
  }
}

function renderIntegrations() {
  const host = document.getElementById("view-integrations");
  host.innerHTML = `<div class="card-grid"></div>`;
  const grid = host.querySelector(".card-grid");
  for (const name of INTEGRATIONS) {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<h3>${name}</h3><p>Connect · discover data · grant tools</p><div class="tag-row"><span class="tag">Integration</span></div>`;
    card.addEventListener("click", () => {
      inspect(name, [
        ["Status", "Ready to connect"],
        ["Discovery", "Cloudy maps entities automatically"],
        ["Used by", "Agents · Automations · Portals"],
      ]);
    });
    grid?.appendChild(card);
  }
}

function renderAutomations() {
  const host = document.getElementById("view-automations");
  const sample =
    "When someone signs up, create a project, send them a welcome email, notify Slack, generate onboarding tasks, and remind me tomorrow.";
  host.innerHTML = `
    <div class="flow">
      <p class="muted">Describe the workflow in plain language. Cloudy builds it visually.</p>
      <textarea class="flow-input" id="flowInput">${sample}</textarea>
      <button type="button" class="btn primary" id="compileFlow">Build workflow</button>
      <div class="flow-graph" id="flowGraph"></div>
    </div>
  `;
  const compile = () => {
    const steps = [
      "Signup trigger",
      "Create project",
      "Send welcome email",
      "Notify Slack",
      "Generate onboarding tasks",
      "Remind tomorrow",
    ];
    const graph = host.querySelector("#flowGraph");
    if (!graph) return;
    graph.innerHTML = steps
      .map(
        (step, i) =>
          `<span class="flow-node">${step}</span>${i < steps.length - 1 ? '<span class="flow-arrow">→</span>' : ""}`,
      )
      .join("");
    inspect("Signup automation", [
      ["Trigger", "New user signup"],
      ["Steps", String(steps.length)],
      ["Channels", "Email · Slack · Tasks · Reminder"],
    ]);
  };
  host.querySelector("#compileFlow")?.addEventListener("click", compile);
  compile();
}

function renderPortals() {
  const host = document.getElementById("view-portals");
  host.innerHTML = `<div class="card-grid"></div>`;
  const grid = host.querySelector(".card-grid");
  for (const portal of PORTALS) {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<h3>${portal.name}</h3><p>${portal.desc}</p><div class="tag-row"><span class="tag">AI</span><span class="tag">Docs</span><span class="tag">Chat</span></div>`;
    card.addEventListener("click", () => {
      inspect(portal.name, [
        ["Includes", "AI assistant · documents · chat · dashboards"],
        ["Permissions", "Role-based shared knowledge"],
        ["Purpose", portal.desc],
      ]);
    });
    grid?.appendChild(card);
  }
}

function renderSettings() {
  const host = document.getElementById("view-settings");
  host.innerHTML = `<div class="settings-grid"></div>`;
  const grid = host.querySelector(".settings-grid");
  for (const [title, desc] of SETTINGS) {
    const card = document.createElement("article");
    card.className = "setting";
    card.innerHTML = `<h3>${title}</h3><p>${desc}</p>`;
    card.addEventListener("click", () => {
      inspect(title, [
        ["Section", "Settings"],
        ["Details", desc],
        ["Wake word", title === "Wake Word" ? "Hey Cloudy" : "Configured globally"],
      ]);
    });
    grid?.appendChild(card);
  }
}

function enterWelcome() {
  showScreen("welcome");
  els.welcomeLine.hidden = true;
}

function enterOS() {
  const labels = [...state.goals]
    .map((id) => GOALS.find((g) => g.id === id)?.label)
    .filter(Boolean);
  els.goalChip.textContent = labels.length ? labels.slice(0, 2).join(" · ") : "Goals ready";
  showScreen("os");
  setView("world");
  inspect("Workspace ready", [
    ["Goals", labels.join(", ") || "Custom"],
    ["Mode", "AI operating system"],
    ["Next", "Explore World or run an autonomous build"],
  ]);
}

async function runBuildDemo() {
  els.buildOverlay.hidden = false;
  els.closeBuild.hidden = true;
  els.buildSteps.innerHTML = BUILD_STEPS.map((step) => `<li>${step}</li>`).join("");
  const items = [...els.buildSteps.querySelectorAll("li")];
  for (let i = 0; i < items.length; i += 1) {
    items.forEach((el, idx) => {
      el.classList.toggle("active", idx === i);
      el.classList.toggle("done", idx < i);
    });
    await wait(420);
  }
  items.forEach((el) => {
    el.classList.add("done");
    el.classList.remove("active");
  });
  els.closeBuild.hidden = false;
  if (!state.goals.has("trading") && !state.goals.has("startup")) {
    state.goals.add("trading");
    state.goals.add("startup");
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bootFx() {
  const canvas = els.fx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const sparks = Array.from({ length: 40 }, () => ({
    x: Math.random(),
    y: Math.random(),
    p: Math.random() * Math.PI * 2,
  }));
  function resize() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }
  function frame() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    if (els.body.dataset.screen !== "boot") {
      requestAnimationFrame(frame);
      return;
    }
    for (const s of sparks) {
      s.p += 0.01;
      ctx.fillStyle = `rgba(34,211,238,${0.1 + Math.sin(s.p) * 0.08})`;
      ctx.beginPath();
      ctx.arc(s.x * w + Math.sin(s.p) * 6, s.y * h, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
}

const wake = createWakeController({
  orb: els.orb,
  transcriptEl: els.wakeTranscript,
  setWakeState,
  onAwake: () => {
    wake.stop();
    enterWelcome();
  },
});

els.enableBtn.addEventListener("click", async () => {
  els.gateNote.textContent = "";
  try {
    await wake.enable();
    els.gate.hidden = true;
    els.wakeStage.hidden = false;
  } catch (error) {
    els.gateNote.textContent =
      error instanceof Error ? error.message : "Microphone permission is required for wake mode.";
  }
});

els.enterBtn.addEventListener("click", () => {
  enterWelcome();
});

els.confirmGoals.addEventListener("click", async () => {
  els.welcomeLine.hidden = false;
  els.confirmGoals.disabled = true;
  // Soft spoken confirmation when available
  try {
    const utter = new SpeechSynthesisUtterance(
      "Great. I’ll build your workspace around these goals.",
    );
    utter.rate = 0.95;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  } catch {
    /* ignore */
  }
  await wait(1200);
  enterOS();
});

els.buildBtn.addEventListener("click", () => {
  void runBuildDemo();
});

els.closeBuild.addEventListener("click", () => {
  els.buildOverlay.hidden = true;
  setView("world");
  state.world?.select("trading");
  inspect("Trading SaaS", [
    ["Status", "Scaffolded by Cloudy"],
    ["Team", "CEO · Developer · Marketing · Research"],
    ["Next", "Open Knowledge and continue the roadmap"],
  ]);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "w" && els.body.dataset.screen === "boot" && !els.wakeStage.hidden) {
    wake.wakeManual();
  }
});

renderGoals();
renderNav();
renderConfigure();
renderKnowledge();
renderSkills();
renderIntegrations();
renderAutomations();
renderPortals();
renderSettings();
bootFx();
showScreen("boot");
setWakeState("boot");
