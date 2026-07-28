function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Lightweight markdown for streamed premium chat (no bubbles). */
export function renderMarkdown(md) {
  let html = escapeHtml(md);
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/^\|(.+)\|$/gm, (row) => {
    const cells = row
      .trim()
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
    if (cells.every((c) => /^:?-{3,}:?$/.test(c))) return "<!--table-sep-->";
    return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  });
  html = html.replace(
    /(?:<tr>.*<\/tr>\n?<!--table-sep-->\n?)?(?:<tr>.*<\/tr>\n?)+/g,
    (block) => `<table>${block.replaceAll("<!--table-sep-->\n", "")}</table>`,
  );
  html = html.replace(/^(?!<[hptu]|<tr|<table|<pre)(.+)$/gm, "<p>$1</p>");
  return html;
}

export async function runClaudeStyleTurn({
  prompt,
  plan,
  chatStream,
  onState,
  onActivity,
  onTokens,
}) {
  const user = document.createElement("article");
  user.className = "msg user";
  user.innerHTML = `<p class="msg-role">You</p><div class="msg-body"></div>`;
  user.querySelector(".msg-body").textContent = prompt;
  chatStream.appendChild(user);

  const assistant = document.createElement("article");
  assistant.className = "msg assistant";
  assistant.innerHTML = `
    <p class="msg-role">Cloudy</p>
    <div class="thinking" id="thinkingBox"></div>
    <div class="msg-body" id="answerBody" hidden></div>
  `;
  chatStream.appendChild(assistant);
  chatStream.parentElement.scrollTop = chatStream.parentElement.scrollHeight;

  const thinkingBox = assistant.querySelector("#thinkingBox");
  const answerBody = assistant.querySelector("#answerBody");

  onState?.("Thinking");
  onActivity?.({ think: "active", memory: "read", search: "—", tools: "—", gen: "—" });

  for (let i = 0; i < plan.steps.length; i += 1) {
    const step = plan.steps[i];
    const mapped =
      plan.stateSequence[Math.min(i, plan.stateSequence.length - 1)] || "Thinking";
    onState?.(mapped);
    if (mapped === "Researching" || mapped === "Searching") {
      onActivity?.({ search: "active" });
    }
    if (mapped === "Coding" || mapped === "Executing") {
      onActivity?.({ tools: "active", gen: "active" });
    }

    const row = document.createElement("div");
    row.className = "thinking-row active";
    row.innerHTML = `<span class="mark">…</span><span>${step}</span>`;
    thinkingBox.appendChild(row);
    chatStream.parentElement.scrollTop = chatStream.parentElement.scrollHeight;

    // Pace similar to deliberate model planning (not theatrical lag)
    await wait(280 + Math.min(420, step.length * 12));
    row.classList.remove("active");
    row.classList.add("done");
    row.querySelector(".mark").textContent = "✔";
  }

  thinkingBox.insertAdjacentHTML(
    "beforeend",
    `<div class="thinking-row done"><span class="mark">✔</span><span>Streaming answer…</span></div>`,
  );

  onState?.("Writing");
  onActivity?.({ think: "done", gen: "streaming", tools: "—", search: "—" });
  answerBody.hidden = false;

  let tokens = 0;
  const text = plan.answer;
  // Token-like chunks (words / punctuation) for Claude-like streaming feel
  const chunks = text.match(/\s+|\S+/g) || [text];
  let out = "";
  const started = performance.now();

  for (const chunk of chunks) {
    out += chunk;
    tokens += 1;
    answerBody.innerHTML = renderMarkdown(out);
    onTokens?.(tokens, Math.max(12, Math.round(performance.now() - started)));
    chatStream.parentElement.scrollTop = chatStream.parentElement.scrollHeight;
    await wait(chunk.trim().length > 12 ? 28 : 14);
  }

  onState?.("Finished");
  onActivity?.({ think: "done", memory: "updated", search: "—", tools: "—", gen: "done" });
  return { tokens, latency: Math.round(performance.now() - started) };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
