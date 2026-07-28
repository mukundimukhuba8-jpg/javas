import { describe, expect, it } from "vitest";
import { envSchema, integrationStatuses, loadConfig } from "@zero/config";

describe("envSchema", () => {
  it("applies development defaults", () => {
    const parsed = envSchema.parse({});
    expect(parsed.NODE_ENV).toBe("development");
    expect(parsed.VECTOR_DB_PROVIDER).toBe("lancedb");
    expect(parsed.WAKE_WORD_ENGINE).toBe("porcupine");
    expect(parsed.ZERO_ALWAYS_ON).toBe(true);
  });

  it("treats empty strings as unset", () => {
    const parsed = envSchema.parse({ ANTHROPIC_API_KEY: "" });
    expect(parsed.ANTHROPIC_API_KEY).toBeUndefined();
  });
});

describe("loadConfig", () => {
  it("loads a valid development env", () => {
    const result = loadConfig({
      processEnv: { NODE_ENV: "development", ZERO_LOG_LEVEL: "error" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isProduction).toBe(false);
      expect(result.value.integrations.length).toBeGreaterThan(0);
    }
  });

  it("requires Anthropic key in production", () => {
    const result = loadConfig({
      processEnv: { NODE_ENV: "production", ZERO_LOG_LEVEL: "error" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.some((i) => i.includes("ANTHROPIC_API_KEY"))).toBe(true);
    }
  });

  it("marks configured integrations", () => {
    const env = envSchema.parse({
      ANTHROPIC_API_KEY: "sk-test",
      DEEPGRAM_API_KEY: "dg-test",
    });
    const statuses = integrationStatuses(env);
    expect(statuses.find((s) => s.id === "anthropic")?.configured).toBe(true);
    expect(statuses.find((s) => s.id === "deepgram")?.configured).toBe(true);
    expect(statuses.find((s) => s.id === "telegram")?.configured).toBe(false);
  });
});
