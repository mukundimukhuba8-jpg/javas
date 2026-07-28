import { config as loadDotenv } from "dotenv";
import { createLogger, type Result, err, ok } from "@zero/shared";
import { envSchema, integrationStatuses, type Env } from "./schema.js";

export type { Env } from "./schema.js";
export { envSchema, integrationStatuses } from "./schema.js";

export class ConfigError extends Error {
  readonly issues: readonly string[];

  constructor(message: string, issues: readonly string[]) {
    super(message);
    this.name = "ConfigError";
    this.issues = issues;
  }
}

export interface ZeroConfig {
  readonly env: Env;
  readonly integrations: ReturnType<typeof integrationStatuses>;
  readonly isProduction: boolean;
}

/**
 * Load and validate environment configuration.
 * Missing API keys are allowed in development (stubs); production requires Anthropic at minimum.
 */
export function loadConfig(options?: {
  readonly envPath?: string;
  readonly processEnv?: NodeJS.ProcessEnv;
}): Result<ZeroConfig, ConfigError> {
  loadDotenv({ path: options?.envPath ?? ".env", quiet: true });

  const source = options?.processEnv ?? process.env;
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    return err(new ConfigError("Invalid environment configuration", issues));
  }

  const env = parsed.data;
  const isProduction = env.NODE_ENV === "production";

  if (isProduction && !env.ANTHROPIC_API_KEY) {
    return err(
      new ConfigError("Production configuration incomplete", [
        "ANTHROPIC_API_KEY is required when NODE_ENV=production",
      ]),
    );
  }

  const integrations = integrationStatuses(env);
  const logger = createLogger(env.ZERO_LOG_LEVEL, { component: "config" });
  const configured = integrations.filter((i) => i.configured).map((i) => i.id);
  const pending = integrations.filter((i) => !i.configured).map((i) => i.id);

  logger.info("Configuration loaded", {
    nodeEnv: env.NODE_ENV,
    configuredIntegrations: configured,
    pendingIntegrations: pending,
  });

  return ok({
    env,
    integrations,
    isProduction,
  });
}
