import { describe, expect, it } from "vitest";
import { createAgentOrchestrator, createScriptedLlm, selectSwarmAgents } from "@zero/agent";
import { createToolRegistry } from "@zero/tools";

describe("selectSwarmAgents", () => {
  it("picks ads and business specialists for recap prompts", () => {
    const agents = selectSwarmAgents("Zero, give me today's recap and Meta ROAS");
    expect(agents).toContain("business-analyst");
    expect(agents).toContain("ads-analyst");
  });

  it("honours explicit agent lists", () => {
    expect(selectSwarmAgents("hello", ["research", "orchestrator"])).toEqual(["research"]);
  });
});

describe("createAgentOrchestrator", () => {
  it("reports partial health without an API key", async () => {
    const agent = createAgentOrchestrator({
      registerBuiltins: true,
      logLevel: "error",
    });
    const health = await agent.health();
    expect(health.healthy).toBe(true);
    expect(health.details).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("returns a butler message when Anthropic is not configured", async () => {
    const agent = createAgentOrchestrator({ logLevel: "error" });
    const turn = await agent.run("Good evening Zero.");
    expect(turn.role).toBe("assistant");
    expect(turn.content).toMatch(/Anthropic API key/i);
  });

  it("runs plan → tool → answer with a scripted LLM", async () => {
    const tools = createToolRegistry();
    const llm = createScriptedLlm([
      { text: "1. Check the time\n2. Reply" },
      {
        text: "",
        toolUses: [{ id: "tool_1", name: "get_current_time", input: {} }],
        stopReason: "tool_use",
      },
      { text: "Good evening. The systems clock is synchronised." },
      { text: '{"complete":true,"assessment":"The user was greeted with the time."}' },
    ]);

    const agent = createAgentOrchestrator({
      llm,
      tools,
      registerBuiltins: true,
      logLevel: "error",
      maxRetries: 0,
    });

    const events = [];
    for await (const event of agent.runStream("Good evening Zero.")) {
      events.push(event);
    }

    expect(events.some((e) => e.type === "plan")).toBe(true);
    expect(events.some((e) => e.type === "tool_call")).toBe(true);
    expect(events.some((e) => e.type === "tool_result")).toBe(true);
    expect(events.some((e) => e.type === "reflect")).toBe(true);

    const done = events.find((e) => e.type === "done");
    expect(done?.type).toBe("done");
    if (done?.type === "done") {
      expect(done.turn.content).toMatch(/synchronised|synchronized|Good evening/i);
    }
  });

  it("registers builtin daily-context tools", async () => {
    const agent = createAgentOrchestrator({ logLevel: "error" });
    const names = agent
      .getTools()
      .list()
      .map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(["get_current_time", "list_daily_context", "read_daily_context"]),
    );
  });
});
