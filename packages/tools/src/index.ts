import {
  type HealthStatus,
  type PackageManifest,
  type ToolCallRequest,
  type ToolCallResult,
  createLogger,
} from "@zero/shared";

const logger = createLogger("info", { package: "tools" });

export const manifest: PackageManifest = {
  name: "@zero/tools",
  version: "0.1.0",
  phase: 5,
  status: "stub",
};

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface ToolRegistry {
  health(): Promise<HealthStatus>;
  list(): readonly ToolDefinition[];
  register(tool: ToolDefinition, handler: ToolHandler): void;
  invoke(request: ToolCallRequest): Promise<ToolCallResult>;
}

export type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

export function createToolRegistry(): ToolRegistry {
  logger.info("Tool registry stub created — integrations begin in Phase 5");

  const tools = new Map<string, { definition: ToolDefinition; handler: ToolHandler }>();

  return {
    health: async () => ({
      name: "@zero/tools",
      healthy: true,
      details: `Stub ready — ${tools.size} tools registered`,
      checkedAt: new Date().toISOString(),
    }),
    list: () => [...tools.values()].map((t) => t.definition),
    register: (definition, handler) => {
      tools.set(definition.name, { definition, handler });
    },
    invoke: async (request) => {
      const entry = tools.get(request.name);
      if (!entry) {
        return {
          id: request.id,
          name: request.name,
          ok: false,
          output: null,
          error: `Unknown tool: ${request.name}`,
        };
      }
      try {
        const output = await entry.handler(request.input);
        return { id: request.id, name: request.name, ok: true, output };
      } catch (error) {
        return {
          id: request.id,
          name: request.name,
          ok: false,
          output: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
