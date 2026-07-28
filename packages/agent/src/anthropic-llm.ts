import Anthropic from "@anthropic-ai/sdk";
import type {
  ChatMessage,
  ContentBlock,
  LlmClient,
  LlmCompletion,
  LlmStreamEvent,
  LlmTool,
} from "./types.js";

type MutableToolUse = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export interface AnthropicLlmOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly maxTokens: number;
}

function toAnthropicMessages(messages: readonly ChatMessage[]): Anthropic.MessageParam[] {
  return messages.map((message) => {
    if (typeof message.content === "string") {
      return { role: message.role, content: message.content };
    }
    const content: Anthropic.ContentBlockParam[] = message.content.map((block) => {
      if (block.type === "text") {
        return { type: "text", text: block.text };
      }
      if (block.type === "tool_use") {
        return {
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input,
        };
      }
      return {
        type: "tool_result",
        tool_use_id: block.tool_use_id,
        content: block.content,
        ...(block.is_error !== undefined ? { is_error: block.is_error } : {}),
      };
    });
    return { role: message.role, content };
  });
}

function toAnthropicTools(tools: readonly LlmTool[]): Anthropic.Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object" as const,
      properties: tool.input_schema.properties,
      ...(tool.input_schema.required ? { required: [...tool.input_schema.required] } : {}),
    },
  }));
}

function extractCompletion(message: Anthropic.Message): LlmCompletion {
  const toolUses: MutableToolUse[] = [];
  const textParts: string[] = [];

  for (const block of message.content) {
    if (block.type === "text") {
      textParts.push(block.text);
    } else if (block.type === "tool_use") {
      toolUses.push({
        id: block.id,
        name: block.name,
        input: (block.input ?? {}) as Record<string, unknown>,
      });
    }
  }

  return {
    text: textParts.join(""),
    toolUses,
    stopReason: message.stop_reason,
  };
}

export function createAnthropicLlm(options: AnthropicLlmOptions): LlmClient {
  const client = new Anthropic({ apiKey: options.apiKey });

  return {
    async complete({ system, messages, tools, maxTokens }) {
      const response = await client.messages.create({
        model: options.model,
        max_tokens: maxTokens ?? options.maxTokens,
        system,
        messages: toAnthropicMessages(messages),
        ...(tools && tools.length > 0 ? { tools: toAnthropicTools(tools) } : {}),
      });
      return extractCompletion(response);
    },

    async *stream({ system, messages, tools, maxTokens }): AsyncGenerator<LlmStreamEvent> {
      const stream = client.messages.stream({
        model: options.model,
        max_tokens: maxTokens ?? options.maxTokens,
        system,
        messages: toAnthropicMessages(messages),
        ...(tools && tools.length > 0 ? { tools: toAnthropicTools(tools) } : {}),
      });

      const pendingTools = new Map<number, { id: string; name: string; inputJson: string }>();

      for await (const event of stream) {
        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          pendingTools.set(event.index, {
            id: event.content_block.id,
            name: event.content_block.name,
            inputJson: "",
          });
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            yield { type: "text_delta", text: event.delta.text };
          } else if (event.delta.type === "input_json_delta") {
            const tool = pendingTools.get(event.index);
            if (tool) {
              tool.inputJson += event.delta.partial_json;
            }
          }
        } else if (event.type === "content_block_stop") {
          const tool = pendingTools.get(event.index);
          if (tool) {
            let input: Record<string, unknown> = {};
            try {
              input = tool.inputJson ? (JSON.parse(tool.inputJson) as Record<string, unknown>) : {};
            } catch {
              input = {};
            }
            yield {
              type: "tool_use",
              id: tool.id,
              name: tool.name,
              input,
            };
            pendingTools.delete(event.index);
          }
        } else if (event.type === "message_delta") {
          // stop_reason arrives with message_delta
        }
      }

      const finalMessage = await stream.finalMessage();
      yield { type: "message_stop", stopReason: finalMessage.stop_reason };
    },
  };
}

/** Collect a streamed completion into text + tool uses (for internal loop steps). */
export async function collectStream(
  client: LlmClient,
  params: Parameters<LlmClient["stream"]>[0],
): Promise<LlmCompletion & { readonly deltas: string }> {
  const toolUses: MutableToolUse[] = [];
  const textParts: string[] = [];
  let stopReason: string | null = null;

  for await (const event of client.stream(params)) {
    if (event.type === "text_delta") {
      textParts.push(event.text);
    } else if (event.type === "tool_use") {
      toolUses.push({ id: event.id, name: event.name, input: event.input });
    } else if (event.type === "message_stop") {
      stopReason = event.stopReason;
    }
  }

  const text = textParts.join("");
  return { text, toolUses, stopReason, deltas: text };
}

export function assistantBlocksFromCompletion(completion: LlmCompletion): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  if (completion.text.trim().length > 0) {
    blocks.push({ type: "text", text: completion.text });
  }
  for (const tool of completion.toolUses) {
    blocks.push({
      type: "tool_use",
      id: tool.id,
      name: tool.name,
      input: tool.input,
    });
  }
  return blocks;
}
