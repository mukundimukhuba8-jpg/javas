import { CRM_STAGES, THINKING_LINES } from "./data.js";

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
  html = html.replace(/^(?!<[hptu]|<tr|<table|<pre)(.+)$/gm, "<p>$1</p>");
  return html;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function streamText(el, text, onToken) {
  const chunks = text.match(/\s+|\S+/g) || [text];
  let out = "";
  let tokens = 0;
  const started = performance.now();
  for (const chunk of chunks) {
    out += chunk;
    tokens += 1;
    el.innerHTML = renderMarkdown(out);
    onToken?.(tokens, Math.round(performance.now() - started));
    await wait(chunk.trim().length > 10 ? 26 : 12);
  }
  return { tokens, latency: Math.round(performance.now() - started) };
}

function speak(text, { onStart, onEnd, onBoundary } = {}) {
  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.96;
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

export async function runThinkingPreface({
  box,
  lines = THINKING_LINES,
  onLine,
  onState,
}) {
  onState?.("Thinking");
  for (const line of lines) {
    onLine?.(line);
    const row = document.createElement("div");
    row.className = "thinking-row active";
    row.innerHTML = `<span class="mark">…</span><span>${line}</span>`;
    box.appendChild(row);
    await wait(320);
    row.classList.remove("active");
    row.classList.add("done");
    row.querySelector(".mark").textContent = "✔";
  }
}

export async function runCrmMission({
  chatStream,
  onState,
  onPipeline,
  onActivity,
  onTokens,
  onOpenStage,
  sound,
}) {
  const userPrompt = "Build me a CRM";
  appendUser(chatStream, userPrompt);

  const card = document.createElement("article");
  card.className = "msg assistant";
  card.innerHTML = `
    <p class="msg-role">Cloudy</p>
    <div class="mission" id="mission">
      <p class="mission-title">Mission Accepted</p>
      <div id="missionStages"></div>
    </div>
    <div class="msg-body" id="answerBody" hidden></div>
  `;
  chatStream.appendChild(card);
  scroll(chatStream);

  const stagesEl = card.querySelector("#missionStages");
  const answerBody = card.querySelector("#answerBody");
  const stageRefs = [];

  for (const stage of CRM_STAGES) {
    const row = document.createElement("div");
    row.className = "mission-stage";
    row.innerHTML = `
      <span class="name">${stage.name}</span>
      <span class="state">Waiting...</span>
      <div class="bar"><span></span></div>
    `;
    row.addEventListener("click", () => onOpenStage?.(stage));
    stagesEl.appendChild(row);
    stageRefs.push({ stage, row });
  }

  onPipeline?.("Understanding Intent");
  onActivity?.({ think: "active", memory: "read" });
  sound?.think?.();

  for (const { stage, row } of stageRefs) {
    row.classList.add("active");
    row.querySelector(".state").textContent = "Running...";
    onState?.(stage.id === "ui" || stage.id === "backend" ? "Coding" : "Planning");
    onPipeline?.(stage.id === "architecture" ? "Planning" : "Running AI Tools");
    onActivity?.({ tools: "active", gen: "active" });

    const fill = row.querySelector(".bar > span");
    for (let p = 0; p <= 100; p += 8) {
      fill.style.width = `${p}%`;
      await wait(45);
    }
    row.classList.remove("active");
    row.classList.add("done");
    row.querySelector(".state").textContent = "Complete";
    sound?.click?.();
  }

  onState?.("Writing");
  onPipeline?.("Generating");
  answerBody.hidden = false;
  const answer = `CRM mission scaffold is live.

## Delivered so far
- Architecture plan
- Database outline
- UI surfaces
- Auth approach
- Backend modules
- Deployment path

Click any stage above to open its workspace detail.

Next, I can generate schema SQL, API routes, or the deal board UI.`;

  const stats = await streamText(answerBody, answer, onTokens);
  onState?.("Finished");
  onPipeline?.(null);
  onActivity?.({ think: "done", tools: "done", gen: "done", memory: "updated" });
  sound?.done?.();
  return stats;
}

export async function runWeatherExperience({
  chatStream,
  onState,
  onPipeline,
  onActivity,
  onTokens,
  onLine,
  sound,
}) {
  appendUser(chatStream, "What's the weather?");
  const card = document.createElement("article");
  card.className = "msg assistant";
  card.innerHTML = `
    <p class="msg-role">Cloudy</p>
    <div class="thinking" id="thinkingBox"></div>
    <div class="weather-card" id="weatherCard" hidden></div>
    <div class="msg-body" id="answerBody" hidden></div>
  `;
  chatStream.appendChild(card);
  scroll(chatStream);

  const box = card.querySelector("#thinkingBox");
  const steps = [
    { text: "📍 Detecting your location...", pipeline: "Running AI Tools" },
    { text: "✓ Pretoria, South Africa", pipeline: "Validating Results" },
    { text: "Checking live weather...", pipeline: "Running AI Tools" },
    { text: "Reading satellite data...", pipeline: "Searching Knowledge" },
    { text: "Analyzing temperature...", pipeline: "Validating Results" },
    { text: "Checking rain probability...", pipeline: "Validating Results" },
    { text: "Done.", pipeline: "Generating Response" },
  ];

  onState?.("Searching");
  onActivity?.({ search: "active", tools: "active", think: "active" });
  for (const step of steps) {
    onPipeline?.(step.pipeline);
    onLine?.(step.text);
    const row = document.createElement("div");
    row.className = "thinking-row active";
    row.innerHTML = `<span class="mark">…</span><span>${step.text}</span>`;
    box.appendChild(row);
    scroll(chatStream);
    await wait(380);
    row.classList.remove("active");
    row.classList.add("done");
    row.querySelector(".mark").textContent = "✔";
    sound?.click?.();
  }

  onState?.("Weather");
  const weather = card.querySelector("#weatherCard");
  weather.hidden = false;
  weather.innerHTML = `
    <p class="weather-city">Pretoria</p>
    <div class="weather-main">
      <div>
        <div class="weather-temp">☀ 18°C</div>
        <div class="weather-condition">Partly cloudy</div>
      </div>
      <div class="weather-meta">Feels like 17°C</div>
    </div>
    <div class="weather-grid">
      <div><span>Humidity</span><b>63%</b></div>
      <div><span>Wind</span><b>12 km/h</b></div>
      <div><span>Rain</span><b>4%</b></div>
      <div><span>UV</span><b>Moderate</b></div>
    </div>
  `;

  const spoken =
    "Good morning. It’s currently 18°C in Pretoria with partly cloudy skies. It’s comfortable outside today, and there’s only a small chance of rain. If you’re heading out, you probably won’t need an umbrella.";
  const answerBody = card.querySelector("#answerBody");
  answerBody.hidden = false;
  onState?.("Writing");
  onPipeline?.("Generating Response");
  const stats = await streamText(answerBody, spoken, onTokens);

  onState?.("Speaking");
  onPipeline?.("Speaking");
  onActivity?.({ gen: "done", search: "done", tools: "done" });
  sound?.listen?.();
  await speak(spoken, {
    onBoundary: () => onState?.("Speaking"),
  });
  onState?.("Finished");
  onPipeline?.(null);
  sound?.done?.();
  return stats;
}

export async function runSearchExperience({
  prompt,
  chatStream,
  onState,
  onPipeline,
  onActivity,
  onTokens,
  onLine,
  sound,
}) {
  appendUser(chatStream, prompt);
  const card = document.createElement("article");
  card.className = "msg assistant";
  card.innerHTML = `
    <p class="msg-role">Cloudy</p>
    <div class="thinking" id="thinkingBox"></div>
    <div class="msg-body" id="answerBody" hidden></div>
  `;
  chatStream.appendChild(card);
  scroll(chatStream);

  const isTesla = prompt.toLowerCase().includes("tesla");
  const steps = [
    "Searching Memory...",
    "Searching Web...",
    "Finding Trusted Sources...",
    "Comparing Information...",
    "Building Summary...",
  ];
  onState?.("Searching");
  onPipeline?.("Searching Memory");
  onActivity?.({ memory: "active", search: "active", tools: "active" });
  sound?.think?.();

  await runThinkingPreface({
    box: card.querySelector("#thinkingBox"),
    lines: steps,
    onLine,
    onState: () => {
      onPipeline?.("Searching Knowledge");
      onState?.("Searching");
    },
  });

  onPipeline?.("Validating Results");
  await wait(280);

  const answerBody = card.querySelector("#answerBody");
  answerBody.hidden = false;
  onState?.("Writing");
  onPipeline?.("Generating Response");
  const answer = isTesla
    ? `**Tesla — concise briefing**

Tesla designs and manufactures electric vehicles, energy storage, and solar products. Its software-led approach (OTA updates, Autopilot / FSD ambitions) is as central as its hardware.

**Useful context**
- Core products: Model 3 / Y / S / X, Cybertruck, Powerwall, Megapack
- Moat signals: charging network, manufacturing scale, brand demand
- Watch items: margins, competition, autonomy timelines, energy growth

I can go deeper on vehicles, energy, or competitive positioning next.`
    : `I searched memory, project knowledge, and connected tools.

**Findings**
- Prefer magic-link auth for CRM MVP
- Keep RBAC at workspace + role level
- Store audit events beside deals and contacts

I can draft the auth flow or generate the schema next.`;
  const stats = await streamText(answerBody, answer, onTokens);
  onState?.("Finished");
  onPipeline?.(null);
  onActivity?.({ memory: "updated", search: "done", tools: "done", gen: "done" });
  sound?.done?.();
  return stats;
}

export async function runGeneralExperience({
  prompt,
  chatStream,
  onState,
  onPipeline,
  onActivity,
  onTokens,
  onLine,
  sound,
}) {
  appendUser(chatStream, prompt);
  const card = document.createElement("article");
  card.className = "msg assistant";
  card.innerHTML = `
    <p class="msg-role">Cloudy</p>
    <div class="thinking" id="thinkingBox"></div>
    <div class="msg-body" id="answerBody" hidden></div>
  `;
  chatStream.appendChild(card);
  scroll(chatStream);

  onPipeline?.("Understanding Intent");
  onActivity?.({ think: "active", memory: "read" });
  sound?.think?.();
  await runThinkingPreface({
    box: card.querySelector("#thinkingBox"),
    onLine,
    onState: () => onState?.("Thinking"),
  });

  const answerBody = card.querySelector("#answerBody");
  answerBody.hidden = false;
  onState?.("Writing");
  onPipeline?.("Generating");
  const answer = `Understood. I’ll handle this as an operating-system task.

1. Capture the outcome in memory  
2. Plan the thinnest useful slice  
3. Execute with visible status  
4. Keep knowledge updated  

Tell me the result you want first, and I’ll begin.`;
  const stats = await streamText(answerBody, answer, onTokens);
  onState?.("Finished");
  onPipeline?.(null);
  onActivity?.({ think: "done", memory: "updated", gen: "done" });
  sound?.done?.();
  return stats;
}

function appendUser(chatStream, prompt) {
  const user = document.createElement("article");
  user.className = "msg user";
  user.innerHTML = `<p class="msg-role">You</p><div class="msg-body"></div>`;
  user.querySelector(".msg-body").textContent = prompt;
  chatStream.appendChild(user);
}

function scroll(chatStream) {
  const scroller = chatStream.parentElement;
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
}
