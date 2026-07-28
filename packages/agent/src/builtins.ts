import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ToolRegistry } from "@zero/tools";

export function registerBuiltinTools(
  registry: ToolRegistry,
  options: { readonly businessDailyPath: string },
): void {
  registry.register(
    {
      name: "get_current_time",
      description: "Return the current date and time in ISO-8601 format (UTC and local).",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    async () => {
      const now = new Date();
      return {
        isoUtc: now.toISOString(),
        local: now.toString(),
        unixMs: now.getTime(),
      };
    },
  );

  registry.register(
    {
      name: "list_daily_context",
      description:
        "List Markdown business context files available under business/daily for today's operating picture.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    async () => {
      const entries = await readdir(options.businessDailyPath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
        .map((entry) => entry.name)
        .sort();
    },
  );

  registry.register(
    {
      name: "read_daily_context",
      description:
        "Read one business/daily Markdown file by filename (e.g. metrics.md, clients.md).",
      inputSchema: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "Filename within business/daily, such as daily.md",
          },
        },
        required: ["filename"],
        additionalProperties: false,
      },
    },
    async (input) => {
      const filename = String(input["filename"] ?? "");
      if (
        !filename ||
        filename.includes("..") ||
        filename.includes("/") ||
        filename.includes("\\")
      ) {
        throw new Error("Invalid filename");
      }
      if (!filename.endsWith(".md")) {
        throw new Error("Only .md daily context files can be read");
      }
      const path = join(options.businessDailyPath, filename);
      const content = await readFile(path, "utf8");
      return { filename, content };
    },
  );
}

export function toolsToLlmSchema(registry: ToolRegistry): {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: readonly string[];
  };
}[] {
  return registry.list().map((tool) => {
    const properties =
      typeof tool.inputSchema["properties"] === "object" && tool.inputSchema["properties"] !== null
        ? (tool.inputSchema["properties"] as Record<string, unknown>)
        : {};
    const required = Array.isArray(tool.inputSchema["required"])
      ? (tool.inputSchema["required"] as string[])
      : undefined;
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object" as const,
        properties,
        ...(required ? { required } : {}),
      },
    };
  });
}
