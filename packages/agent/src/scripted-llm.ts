import type { ChatMessage, LlmClient, LlmCompletion, LlmStreamEvent, LlmTool } from "./types.js";

export interface ScriptedResponse {
  readonly match?: RegExp | string;
  readonly text?: string;
  readonly toolUses?: LlmCompletion["toolUses"];
  readonly stopReason?: string | null;
}

/**
 * Deterministic LLM for unit tests — no network.
 */
export function createScriptedLlm(responses: ScriptedResponse[]): LlmClient {
  let cursor = 0;

  function next(messages: readonly ChatMessage[]): LlmCompletion {
    const last = messages[messages.length - 1];
    const haystack =
      typeof last?.content === "string" ? last.content : JSON.stringify(last?.content ?? "");

    const indexed = responses[cursor];
    const matched =
      responses.find((response) => {
        if (!response.match) return false;
        if (typeof response.match === "string") return haystack.includes(response.match);
        return response.match.test(haystack);
      }) ?? indexed;

    cursor += 1;
    return {
      text: matched?.text ?? "Acknowledged.",
      toolUses: matched?.toolUses ?? [],
      stopReason: matched?.stopReason ?? (matched?.toolUses?.length ? "tool_use" : "end_turn"),
    };
  }

  async function* asStream(completion: LlmCompletion): AsyncGenerator<LlmStreamEvent> {
    if (completion.text) {
      yield { type: "text_delta", text: completion.text };
    }
    for (const tool of completion.toolUses) {
      yield { type: "tool_use", id: tool.id, name: tool.name, input: tool.input };
    }
    yield { type: "message_stop", stopReason: completion.stopReason };
  }

  return {
    complete: async ({ messages }) => next(messages),
    stream: ({
      messages,
      tools: _tools,
    }: {
      system: string;
      messages: readonly ChatMessage[];
      tools?: readonly LlmTool[];
      maxTokens?: number;
    }) => asStream(next(messages)),
  };
}
