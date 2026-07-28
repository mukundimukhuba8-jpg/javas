import type { AgentId } from "@zero/shared";

/** Specialists that participate in a default evening-recap style swarm. */
export const DEFAULT_SWARM_AGENTS: readonly AgentId[] = [
  "business-analyst",
  "ads-analyst",
  "operations",
  "calendar",
] as const;

export const ALL_SPECIALISTS: readonly AgentId[] = [
  "orchestrator",
  "lead-generation",
  "email-copywriter",
  "ads-analyst",
  "business-analyst",
  "research",
  "calendar",
  "operations",
  "memory-manager",
] as const;

export function selectSwarmAgents(
  prompt: string,
  requested?: readonly AgentId[],
): readonly AgentId[] {
  if (requested && requested.length > 0) {
    return requested.filter((id) => id !== "orchestrator");
  }

  const lower = prompt.toLowerCase();
  const selected = new Set<AgentId>();

  if (/recap|summary|today|metrics|mrr|revenue|client/.test(lower)) {
    selected.add("business-analyst");
    selected.add("operations");
  }
  if (/ad|roas|meta|creative|campaign|spend/.test(lower)) {
    selected.add("ads-analyst");
  }
  if (/email|copy|outreach|subject/.test(lower)) {
    selected.add("email-copywriter");
  }
  if (/lead|prospect|pipeline/.test(lower)) {
    selected.add("lead-generation");
  }
  if (/meeting|calendar|schedule|book/.test(lower)) {
    selected.add("calendar");
  }
  if (/research|search|look up|find out/.test(lower)) {
    selected.add("research");
  }
  if (/remember|memory|preference/.test(lower)) {
    selected.add("memory-manager");
  }

  if (selected.size === 0) {
    return DEFAULT_SWARM_AGENTS;
  }
  return [...selected];
}
