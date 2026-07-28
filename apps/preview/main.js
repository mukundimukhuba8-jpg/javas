const timeline = document.getElementById("timeline");
const toolFeed = document.getElementById("toolFeed");
const playDemo = document.getElementById("playDemo");
const agentName = document.getElementById("agentName");
const mic = document.querySelector(".mic");
const clock = document.getElementById("clock");
const canvas = document.getElementById("wave");
const ctx = canvas.getContext("2d");

const demoScript = [
  {
    delay: 400,
    agent: "Orchestrator",
    mic: "listening",
    user: "Good evening Zero. Give me today’s recap.",
  },
  {
    delay: 900,
    mic: "speaking",
    agent: "Business Analyst",
    tool: { name: "read_daily_context", state: "active" },
  },
  {
    delay: 700,
    tool: { name: "read_daily_context", state: "done" },
  },
  {
    delay: 500,
    tool: { name: "list_daily_context", state: "active" },
    agent: "Ads Analyst",
  },
  {
    delay: 800,
    tool: { name: "list_daily_context", state: "done" },
  },
  {
    delay: 600,
    agent: "Orchestrator",
    assistant:
      "Today your agency onboarded three new clients. Monthly recurring revenue increased by $2,600. Lead generation discovered forty-two qualified prospects. Twenty personalized emails were queued. Eight replies were received. Three meetings have been booked. Meta Ads generated a 5.8 ROAS. One campaign is underperforming — I recommend pausing it. Would you like me to pause it now?",
  },
  {
    delay: 1600,
    mic: "listening",
    user: "Yes.",
  },
  {
    delay: 900,
    mic: "speaking",
    agent: "Operations",
    tool: { name: "meta.pause_campaign", state: "active" },
  },
  {
    delay: 1000,
    tool: { name: "meta.pause_campaign", state: "done" },
    assistant: "Done. The campaign has been paused.",
    mic: "idle",
    agent: "Orchestrator",
  },
];

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

updateClock();
setInterval(updateClock, 1000);

function addTurn(role, text) {
  const el = document.createElement("article");
  el.className = `turn ${role}`;
  el.innerHTML = `<span class="who">${role === "user" ? "You" : "Zero"}</span><p class="body"></p>`;
  timeline.appendChild(el);
  const body = el.querySelector(".body");
  timeline.scrollTop = timeline.scrollHeight;
  return typeText(body, text);
}

async function typeText(node, text) {
  node.textContent = "";
  for (const char of text) {
    node.textContent += char;
    timeline.scrollTop = timeline.scrollHeight;
    await wait(char === " " ? 8 : 12);
  }
}

function setTool(name, state) {
  let item = [...toolFeed.children].find((li) => li.dataset.name === name);
  if (!item) {
    item = document.createElement("li");
    item.dataset.name = name;
    item.textContent = name;
    toolFeed.prepend(item);
  }
  item.className = state;
  item.textContent = state === "active" ? `${name} · running` : `${name} · ok`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let playing = false;

async function runDemo() {
  if (playing) return;
  playing = true;
  playDemo.disabled = true;
  timeline.innerHTML = "";
  toolFeed.innerHTML = "";
  agentName.textContent = "Orchestrator";
  mic.dataset.state = "idle";

  for (const step of demoScript) {
    await wait(step.delay);
    if (step.agent) agentName.textContent = step.agent;
    if (step.mic) mic.dataset.state = step.mic;
    if (step.tool) setTool(step.tool.name, step.tool.state);
    if (step.user) await addTurn("user", step.user);
    if (step.assistant) await addTurn("assistant", step.assistant);
  }

  playDemo.disabled = false;
  playing = false;
}

playDemo.addEventListener("click", () => {
  void runDemo();
});

// Waveform
let phase = 0;
let energy = 0.18;

function drawWave() {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const mid = height / 2;
  const listening = mic.dataset.state === "listening" || mic.dataset.state === "speaking";
  const target = listening ? (mic.dataset.state === "speaking" ? 0.85 : 0.55) : 0.16;
  energy += (target - energy) * 0.06;

  ctx.beginPath();
  for (let x = 0; x <= width; x += 1) {
    const n =
      Math.sin(x * 0.045 + phase) * 10 +
      Math.sin(x * 0.11 + phase * 1.7) * 5 +
      Math.sin(x * 0.02 + phase * 0.6) * 7;
    const y = mid + n * energy;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = `rgba(212, 184, 140, ${0.35 + energy * 0.45})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  phase += 0.08 + energy * 0.08;
  requestAnimationFrame(drawWave);
}

drawWave();

// Auto-run once so the page isn't empty
void runDemo();
