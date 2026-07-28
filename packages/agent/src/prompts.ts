import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentId } from "@zero/shared";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

function findRepoRoot(): string {
  let current = MODULE_DIR;
  for (let i = 0; i < 8; i += 1) {
    if (
      existsSync(join(current, "CLAUDE.md")) ||
      existsSync(join(current, "pnpm-workspace.yaml"))
    ) {
      return current;
    }
    current = dirname(current);
  }
  return resolve(process.cwd());
}

export function loadClaudeSystemPrompt(repoRoot = findRepoRoot()): string {
  const path = join(repoRoot, "CLAUDE.md");
  if (!existsSync(path)) {
    return FALLBACK_SYSTEM_PROMPT;
  }
  return readFileSync(path, "utf8").trim();
}

export const SPECIALIST_PROMPTS: Record<Exclude<AgentId, "orchestrator">, string> = {
  "lead-generation":
    "You are Zero's Lead Generation specialist. Focus on prospect quality, outreach angles, and pipeline velocity. Be precise and actionable.",
  "email-copywriter":
    "You are Zero's Email Copywriter. Draft concise, personalised copy in the user's voice. Prefer short paragraphs and clear CTAs.",
  "ads-analyst":
    "You are Zero's Ads Analyst. Evaluate spend, ROAS, creatives, and pause/scale recommendations with clear rationale.",
  "business-analyst":
    "You are Zero's Business Analyst. Synthesize metrics, clients, MRR, and operational health into a calm executive brief.",
  research:
    "You are Zero's Research specialist. Gather facts, cite uncertainty explicitly, and separate verified data from inference.",
  calendar:
    "You are Zero's Calendar specialist. Prioritize conflicts, prep notes, and scheduling recommendations.",
  operations:
    "You are Zero's Operations specialist. Track blockers, recurring tasks, and tomorrow's priorities.",
  "memory-manager":
    "You are Zero's Memory Manager. Identify what should be remembered long-term vs. ephemeral daily context.",
};

export function buildSystemPrompt(options: {
  readonly base?: string;
  readonly agentId?: AgentId;
  readonly append?: string;
}): string {
  const parts = [options.base ?? loadClaudeSystemPrompt()];
  if (options.agentId && options.agentId !== "orchestrator") {
    parts.push(`\n## Active specialist\n${SPECIALIST_PROMPTS[options.agentId]}`);
  }
  if (options.append) {
    parts.push(`\n## Session context\n${options.append}`);
  }
  return parts.join("\n");
}

export const PLAN_INSTRUCTION = `Before taking action, produce a brief numbered plan (3–7 steps) for how you will solve the user's request.
Respond with ONLY the plan lines, each starting with a number and a period (e.g. "1. Review daily metrics").
Do not call tools in this planning step.`;

export const REFLECT_INSTRUCTION = `Reflect on whether the user's request is fully satisfied given the conversation so far.
Respond with exactly this JSON object and nothing else:
{"complete":boolean,"assessment":"one or two calm sentences"}`;

const FALLBACK_SYSTEM_PROMPT = `You are Zero, a calm British butler AI assistant.
Be concise, intelligent, slightly formal, and never robotic or overly cheerful.
Use tools when they improve accuracy. Prefer action over vague advice.`;
